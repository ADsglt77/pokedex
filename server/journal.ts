/**
 * Le journal de l'app, une ligne par évènement dans la sortie du serveur (`docker compose logs -f
 * server`, ou le terminal de `bun run dev:server`), à l'heure de Paris :
 *
 *   16/10/2026 14:03:12 [compte] Connexion : moi@exemple.fr (IP 1.2.3.4)
 *
 * - `compte` : connexion (réussie ou refusée), création du compte, déconnexion (`auth.ts`) ;
 * - `collection` et `achats` : ce qui change dans le document synchronisé, comparé à la version
 *   d'avant (`documentChanges`, `collection.ts`) : cartes ajoutées, possédées, commandes, budget… ;
 * - `données` : l'export et l'import, que le navigateur signale (`POST /api/journal`) : le serveur
 *   ne les voit pas autrement ;
 * - `vitrine` : une visite du Pokédex public.
 * Jamais un mot de passe ; l'adresse du visiteur quand le tunnel la donne (`cf-connecting-ip`).
 */

import { Elysia, t } from 'elysia'
import { ORDER_STATE_LABELS } from '@/config/shopping'
import { formatEuro, plural } from '@/lib/format'
import { cardCount, orderSpent, supplierLabel } from '@/lib/orders'
import type { SyncDocument } from '@/lib/sync'
import type { CollectionData, Order, ShoppingData } from '@/types'
import type { accountRoutes } from './auth'

export type JournalTopic = 'compte' | 'collection' | 'achats' | 'données' | 'vitrine'

const TIME = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  dateStyle: 'short',
  timeStyle: 'medium',
})

/** Écrit une ligne du journal ; `request` : pour l'adresse du visiteur. */
export function journal(topic: JournalTopic, message: string, request?: Request) {
  const ip = request?.headers.get('cf-connecting-ip')
  console.log(`${TIME.format(new Date())} [${topic}] ${message}${ip ? ` (IP ${ip})` : ''}`)
}

/** Au-delà, un import ou un effacement : le reste est compté, pas écrit. */
const MAX_LINES = 20

/** Ce qui a changé d'une version du document à l'autre ; `before` : `null` au premier envoi. */
export function documentChanges(
  before: SyncDocument | null,
  after: SyncDocument,
): [JournalTopic, string][] {
  if (!before) {
    const cards = plural(Object.keys(after.collection.customCards).length, 'carte', 'cartes')
    const orders = plural(after.shopping.orders.length, 'commande', 'commandes')
    return [['collection', `Premier envoi : ${cards}, ${orders}`]]
  }
  const changes = [
    ...cardChanges(before.collection, after.collection),
    ...shoppingChanges(before.shopping, after.shopping),
  ]
  if (changes.length <= MAX_LINES) return changes
  const others = plural(changes.length - MAX_LINES, 'autre changement', 'autres changements')
  return [...changes.slice(0, MAX_LINES), ['collection', `… et ${others}`]]
}

/** Les cartes : ajoutées, retirées, corrigées ; leur statut et leur prix payé. */
function cardChanges(before: CollectionData, after: CollectionData): [JournalTopic, string][] {
  const removed = Object.keys(before.customCards).filter((id) => !after.customCards[id])
  if (removed.length > 0 && Object.keys(after.customCards).length === 0) {
    return [['collection', `Collection effacée : ${plural(removed.length, 'carte', 'cartes')}`]]
  }
  const lines: [JournalTopic, string][] = []
  const add = (message: string) => lines.push(['collection', message])
  for (const [id, card] of Object.entries(after.customCards)) {
    const known = before.customCards[id]
    if (!known) add(`Carte ajoutée : ${card.reference}`)
    else if (JSON.stringify(known) !== JSON.stringify(card))
      add(`Carte modifiée : ${card.reference}`)
  }
  for (const id of removed) add(`Carte retirée : ${before.customCards[id]!.reference}`)

  for (const id of new Set([...Object.keys(before.cards), ...Object.keys(after.cards)])) {
    const reference = after.customCards[id]?.reference
    // Une carte retirée emporte son statut : la ligne « Carte retirée » le dit.
    if (!reference) continue
    const was = before.cards[id]
    const now = after.cards[id]
    const paid = now?.paidPrice === undefined ? '' : `, payée ${formatEuro(now.paidPrice)}`
    if (now?.status !== was?.status) {
      add(
        now?.status === 'owned'
          ? `Carte possédée : ${reference}${paid}`
          : now?.status === 'ordered'
            ? `Carte commandée : ${reference}`
            : `Statut retiré : ${reference}`,
      )
    } else if (now && now.paidPrice !== was?.paidPrice) {
      add(
        now.paidPrice === undefined
          ? `Prix payé effacé : ${reference}`
          : `Prix payé noté : ${reference}${paid}`,
      )
    }
  }
  return lines
}

/** « Cardmarket CM-1, 3 cartes, 42,50 € » */
const orderText = (order: Order) =>
  `${supplierLabel(order)}${order.reference ? ` ${order.reference}` : ''}, ${plural(cardCount(order.lines), 'carte', 'cartes')}, ${formatEuro(orderSpent(order))}`

/** Une commande sans sa date de modification : ce que l'utilisateur a changé. */
const orderContent = (order: Order) => JSON.stringify({ ...order, updatedAt: undefined })

/** Les commandes (nouvelles, reçues, annulées, supprimées, corrigées) et le budget. */
function shoppingChanges(before: ShoppingData, after: ShoppingData): [JournalTopic, string][] {
  const lines: [JournalTopic, string][] = []
  const add = (message: string) => lines.push(['achats', message])
  const previous = new Map(before.orders.map((order) => [order.id, order]))
  for (const order of after.orders) {
    const known = previous.get(order.id)
    previous.delete(order.id)
    const state = ORDER_STATE_LABELS[order.state].toLowerCase()
    if (!known) add(`Commande enregistrée (${state}) : ${orderText(order)}`)
    else if (known.state !== order.state) {
      add(
        order.state === 'received'
          ? `Commande reçue : ${orderText(order)}`
          : order.state === 'cancelled'
            ? `Commande annulée : ${orderText(order)}`
            : `Commande remise en cours : ${orderText(order)}`,
      )
    } else if (orderContent(known) !== orderContent(order)) {
      add(`Commande modifiée : ${orderText(order)}`)
    }
  }
  for (const order of previous.values()) add(`Commande supprimée : ${orderText(order)}`)

  if (JSON.stringify(before.budget) !== JSON.stringify(after.budget)) {
    const { monthly, ceiling, shippingReserve } = after.budget
    add(
      `Budget : ${formatEuro(monthly)} par mois, plafond ${formatEuro(ceiling)}, port réservé ${formatEuro(shippingReserve)}`,
    )
  }
  return lines
}

const EVENTS = {
  export: 'Collection exportée (fichier JSON)',
  import: 'Fichier importé : il remplace la collection',
}

/** `POST /api/journal` `{ event }` : ce que le navigateur fait seul (export, import). */
export const journalRoutes = (account: ReturnType<typeof accountRoutes>) =>
  new Elysia({ name: 'journal' }).use(account).post(
    '/journal',
    ({ body, request, status }) => {
      journal('données', EVENTS[body.event], request)
      return status(204, null)
    },
    {
      auth: true,
      body: t.Object({ event: t.Union([t.Literal('export'), t.Literal('import')]) }),
      detail: { summary: 'Note un export ou un import dans le journal du serveur' },
    },
  )
