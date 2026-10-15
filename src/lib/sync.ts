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

/** Une version du document : son numéro chez le serveur et son empreinte. */
export interface SyncVersion {
  version: number
  hash: string
}

/**
 * - `noop` : rien à faire, les deux sont d'accord ;
 * - `push` : envoyer celle de cet appareil (lui seul a changé) ;
 * - `adopt` : reprendre celle du serveur (lui seul a changé, ou c'est la même) ;
 * - `conflict` : les deux ont changé, l'utilisateur choisit.
 */
export type SyncStep = 'noop' | 'push' | 'adopt' | 'conflict'

/** L'empreinte d'un document (SHA-256 de son JSON) : deux documents égaux ont la même. */
export async function documentHash(document: SyncDocument): Promise<string> {
  const text = JSON.stringify({ collection: document.collection, shopping: document.shopping })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Un document sans rien à perdre : aucune carte, aucune préférence d'achat, aucune commande, le
 * budget par défaut (un budget réglé serait perdu, remplacé par celui de l'autre version).
 */
export const isEmptyDocument = ({ collection, shopping }: SyncDocument) =>
  Object.keys(collection.cards).length === 0 &&
  Object.keys(collection.customCards).length === 0 &&
  Object.keys(shopping.preferences).length === 0 &&
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
  server: { version: number; hash: string | null; empty: boolean },
): SyncStep {
  // Le premier appareil connecté envoie la sienne.
  if (server.version === 0) return local.empty ? 'noop' : 'push'
  // Déjà la même : il suffit de noter la version.
  if (local.hash === server.hash) return base?.version === server.version ? 'noop' : 'adopt'
  // Première connexion de cet appareil : il garde celle qui a quelque chose, ou il faut choisir.
  if (!base) return local.empty ? 'adopt' : server.empty ? 'push' : 'conflict'
  // Le serveur en est à une version plus ancienne que celle échangée (sa base restaurée d'une
  // sauvegarde) : la reprendre perdrait sans rien dire ce qu'il avait reçu depuis.
  if (server.version < base.version) return 'conflict'
  const changedHere = local.hash !== base.hash
  if (base.version === server.version) return changedHere ? 'push' : 'noop'
  return changedHere ? 'conflict' : 'adopt'
}
