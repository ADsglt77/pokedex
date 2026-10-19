/**
 * La règle de la synchronisation (`store/sync.ts`) : ce que fait cet appareil, connecté, quand il
 * compare sa collection à celle du serveur. Un seul document (collection et achats ensemble : une
 * commande modifie les deux), numéroté par le serveur. Jamais de fusion : quand les deux ont
 * changé, c'est à l'utilisateur de choisir.
 */

import { DEFAULT_BUDGET } from '@/config/shopping'
import type { CollectionData, ShoppingData } from '@/types'

/** Ce que les appareils d'un compte partagent. */
export interface SyncDocument {
  collection: CollectionData
  shopping: ShoppingData
}

/**
 * Une version du document : son numéro chez le serveur, l'empreinte de son document, et celle que
 * lui donne le serveur (`tag`, d'après ce qu'il a enregistré) : après une restauration de sa
 * base, un numéro peut revenir, pour un autre document.
 */
export interface SyncVersion {
  version: number
  hash: string
  tag?: string
}

/**
 * - `noop` : rien à faire, les deux sont d'accord ;
 * - `push` : envoyer celle de cet appareil (lui seul a changé) ;
 * - `adopt` : reprendre celle du serveur (lui seul a changé, ou c'est la même) ;
 * - `conflict` : les deux ont changé, l'utilisateur choisit.
 */
type SyncStep = 'noop' | 'push' | 'adopt' | 'conflict'

const hashes = new WeakMap<object, WeakMap<object, Promise<string>>>()

/**
 * L'empreinte d'un document (SHA-256 de son JSON) : deux documents égaux ont la même. Calculée une
 * fois par document (la collection et les achats, objets jamais modifiés) : chaque retour sur la
 * page relance une synchronisation, qui la demande.
 */
export function documentHash(document: SyncDocument): Promise<string> {
  let byShopping = hashes.get(document.collection)
  if (!byShopping) hashes.set(document.collection, (byShopping = new WeakMap()))
  let hash = byShopping.get(document.shopping)
  if (!hash) {
    const text = JSON.stringify({ collection: document.collection, shopping: document.shopping })
    hash = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(text))
      .then((digest) =>
        [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
      )
    byShopping.set(document.shopping, hash)
  }
  return hash
}

/**
 * Un document sans rien à perdre : aucune carte, aucune commande, le budget par défaut (un budget réglé serait perdu, remplacé par celui de l'autre version).
 */
export const isEmptyDocument = ({ collection, shopping }: SyncDocument) =>
  Object.keys(collection.cards).length === 0 &&
  Object.keys(collection.customCards).length === 0 &&
  shopping.orders.length === 0 &&
  shopping.budget.monthly === DEFAULT_BUDGET.monthly &&
  shopping.budget.ceiling === DEFAULT_BUDGET.ceiling &&
  shopping.budget.shippingReserve === DEFAULT_BUDGET.shippingReserve

/**
 * Que faire ? `local` : le document de cet appareil (son empreinte, s'il est vide) ; `base` : la
 * dernière version échangée avec le serveur par cet appareil pour ce compte (`null` : jamais) ;
 * `server` : celle du serveur (`version` 0 : aucun appareil n'a encore rien envoyé ; `empty` : rien
 * à perdre).
 */
export function decide(
  local: { hash: string; empty: boolean },
  base: SyncVersion | null,
  server: { version: number; hash: string | null; tag?: string; empty: boolean },
): SyncStep {
  // Le premier appareil connecté envoie la sienne.
  if (server.version === 0) return local.empty ? 'noop' : 'push'
  // Déjà la même : il suffit de noter la version.
  if (local.hash === server.hash) {
    return base?.version === server.version && base.tag === server.tag ? 'noop' : 'adopt'
  }
  // Première connexion de cet appareil : il garde celle qui a quelque chose, ou il faut choisir.
  if (!base) return local.empty ? 'adopt' : server.empty ? 'push' : 'conflict'
  // Le serveur en est à une version plus ancienne que celle échangée (sa base restaurée d'une
  // sauvegarde) : la reprendre perdrait sans rien dire ce qu'il avait reçu depuis. Même chose
  // pour le même numéro, mais un autre document (la base restaurée, puis un autre appareil revenu
  // à ce numéro) : l'envoyer écraserait ce que l'autre appareil y a mis.
  if (server.version < base.version) return 'conflict'
  if (server.version === base.version && base.tag && server.tag && base.tag !== server.tag) {
    return 'conflict'
  }
  const changedHere = local.hash !== base.hash
  if (base.version === server.version) return changedHere ? 'push' : 'noop'
  return changedHere ? 'conflict' : 'adopt'
}
