/**
 * Le registre des commandes : ce qu'une commande a coûté, et son report sur la collection.
 * Une commande en cours passe ses cartes en « commandée », une commande reçue en « possédée » ;
 * annulée ou supprimée, chaque carte retrouve son état d'avant. Une possession n'est jamais retirée.
 */

import { SUPPLIER_LABELS } from '@/config/shopping'
import { formatDate } from '@/lib/format'
import { daysBetween } from '@/lib/time'
import type { CardOwnership, CollectionData, Order, OrderLine, OrderState } from '@/types'

/** « Cardmarket », ou le nom donné à un autre fournisseur. */
export const supplierLabel = (order: Pick<Order, 'supplier' | 'supplierName'>) =>
  (order.supplier === 'other' && order.supplierName) || SUPPLIER_LABELS[order.supplier]

/** Une commande à remplir : Cardmarket, en cours, datée du jour donné. */
export const newOrder = (date: string, lines: OrderLine[] = [], shipping = 0): Order => ({
  id: crypto.randomUUID(),
  supplier: 'cardmarket',
  date,
  lines,
  shipping,
  fees: 0,
  refunded: 0,
  state: 'pending',
  updatedAt: '',
})

/** Au centime : les sommes de prix à virgule ne tombent pas juste. */
export const cents = (value: number) => Math.round(value * 100) / 100

export const cardCount = (lines: readonly Pick<OrderLine, 'quantity'>[]) =>
  lines.reduce((count, line) => count + line.quantity, 0)

/** Le prix des cartes, hors port et frais. */
export const linesTotal = (lines: readonly Pick<OrderLine, 'quantity' | 'unitPrice'>[]) =>
  cents(lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0))

/**
 * Ce que la commande a coûté : cartes, port et frais, moins le remboursé. Une commande annulée
 * ne coûte rien. Le port appartient à la commande : il n'est compté qu'une fois.
 */
export const orderSpent = (order: Order) =>
  order.state === 'cancelled'
    ? 0
    : cents(linesTotal(order.lines) + order.shipping + order.fees - order.refunded)

/** Le remboursé ne dépasse pas la commande : sinon le budget compterait une dépense négative. */
export const refundFits = (order: Pick<Order, 'lines' | 'shipping' | 'fees' | 'refunded'>) =>
  order.refunded <= cents(linesTotal(order.lines) + order.shipping + order.fees)

/**
 * Le prix de revient d'une carte de chaque ligne : son prix, plus sa part du port et des frais,
 * moins sa part du remboursé, au prorata de son prix (à parts égales si les cartes sont
 * gratuites), au centime. Les centimes que l'arrondi perd ou ajoute vont aux lignes d'une seule
 * carte, la plus grosse part d'arrondi d'abord, en plusieurs tours s'il le faut, sans passer une
 * carte sous 0 € : les prix de revient font le total de la commande dès qu'une ligne d'une seule
 * carte peut les prendre. (Une ligne de plusieurs cartes ne peut pas prendre un centime sans le
 * multiplier.)
 */
export function unitCosts(
  order: Pick<Order, 'lines' | 'shipping' | 'fees' | 'refunded'>,
): number[] {
  const extra = order.shipping + order.fees - order.refunded
  const subtotal = linesTotal(order.lines)
  const count = cardCount(order.lines)
  // En centimes, pour compter juste.
  const exact = order.lines.map(
    (line) =>
      (line.unitPrice + (subtotal > 0 ? (extra * line.unitPrice) / subtotal : extra / count)) * 100,
  )
  const costs = exact.map(Math.round)
  const total = Math.round((subtotal + extra) * 100)
  let rest = order.lines.reduce((sum, line, index) => sum - line.quantity * costs[index]!, total)
  const step = Math.sign(rest)
  const singles = order.lines
    .flatMap((line, index) => (line.quantity === 1 ? [index] : []))
    .sort((a, b) => step * (exact[b]! - costs[b]! - (exact[a]! - costs[a]!)))
  while (rest !== 0) {
    const takers = singles.filter((index) => costs[index]! + step >= 0)
    if (takers.length === 0) break
    for (const index of takers.slice(0, Math.abs(rest))) {
      costs[index] = costs[index]! + step
      rest -= step
    }
  }
  return costs.map((cost) => cost / 100)
}

/**
 * L'état d'une carte avant une commande : celui que garde la version enregistrée de la commande
 * (`null` : aucun statut), sinon son état actuel (carte ajoutée à la commande).
 */
export function previousOf(cardId: string, stored: Order | null, collection: CollectionData) {
  const line = stored?.lines.find((known) => known.cardId === cardId)
  return line ? line.previous : (collection.cards[cardId] ?? null)
}

/** La commande de `orders` dans cet état qui contient la carte ; `undefined` s'il n'y en a pas. */
const orderWith = (orders: readonly Order[], cardId: string, state: OrderState) =>
  orders.find(
    (order) => order.state === state && order.lines.some((line) => line.cardId === cardId),
  )

/** Midi, heure locale, du jour donné : la date d'obtention d'une carte reçue. */
const noonOf = (day: string) => new Date(`${day}T12:00:00`).toISOString()

/**
 * Reporte sur la collection le passage d'une commande de `before` à `after` (`null` : création,
 * suppression). `others` : les autres commandes, pour ne pas défaire ce qu'elles ont fait.
 * - les cartes qui quittent une commande active (annulation, suppression, ligne retirée)
 *   retrouvent leur état d'avant la commande, si elles sont encore « commandée ». Une autre
 *   commande en cours qui les contient les garde « commandée », à son prix de revient. Un état
 *   d'avant « commandée » venait d'une autre commande, disparue depuis : la carte perd alors son
 *   statut ;
 * - celles qui quittent une commande reçue restent possédées, mais sans la date ni le prix payé
 *   qu'elle leur avait donnés : ceux d'avant la commande, aucun (elles n'étaient pas possédées) ;
 * - les cartes d'une commande en cours deviennent « commandée », sauf si elles sont déjà possédées ;
 * - les cartes d'une commande reçue deviennent « possédée », datées du jour de réception (une date
 *   de réception corrigée les suit) ;
 * - une carte déjà possédée avant la commande (doublon) n'est jamais modifiée ;
 * - le prix payé est le prix de revient (port, frais et remboursé répartis).
 */
export function applyOrder(
  collection: CollectionData,
  before: Order | null,
  after: Order | null,
  others: readonly Order[],
  now: string,
): CollectionData {
  const cards = { ...collection.cards }
  const active = after?.state === 'cancelled' ? null : after
  const kept = new Set(active?.lines.map((line) => line.cardId))

  for (const line of before?.state === 'cancelled' ? [] : (before?.lines ?? [])) {
    const current = cards[line.cardId]
    if (kept.has(line.cardId)) continue
    // Possédée grâce à cette commande : elle le reste (une possession n'est jamais retirée), sans
    // la date ni le prix payé que la commande lui avait donnés.
    if (
      before?.state === 'received' &&
      current?.status === 'owned' &&
      line.previous?.status !== 'owned'
    ) {
      cards[line.cardId] = { status: 'owned', updatedAt: now, acquiredAt: null }
      continue
    }
    if (current?.status !== 'ordered') continue
    // Une autre commande en cours la garde « commandée » : à son prix de revient à elle.
    const other = orderWith(others, line.cardId, 'pending')
    if (other) {
      const index = other.lines.findIndex((known) => known.cardId === line.cardId)
      cards[line.cardId] = { ...current, updatedAt: now, paidPrice: unitCosts(other)[index] }
      continue
    }
    if (line.previous && line.previous.status !== 'ordered') cards[line.cardId] = line.previous
    else delete cards[line.cardId]
  }

  const costs = active ? unitCosts(active) : []
  active?.lines.forEach((line, index) => {
    const current = cards[line.cardId]
    if (line.previous?.status === 'owned') return
    const paidPrice = costs[index]
    let next: CardOwnership | null = null
    if (active.state === 'received') {
      // Possédée avant la réception de cette commande : elle garde sa date. Sinon, la date de
      // réception, même corrigée après coup.
      const acquiredAt =
        current?.status === 'owned' && before?.state !== 'received'
          ? current.acquiredAt
          : noonOf(active.receivedAt ?? active.date)
      next = { status: 'owned', updatedAt: now, acquiredAt, paidPrice }
    } else if (current?.status !== 'owned') {
      next = { status: 'ordered', updatedAt: now, acquiredAt: null, paidPrice }
    }
    if (next && !sameOwnership(current, next)) cards[line.cardId] = next
  })

  const changed = Object.keys({ ...cards, ...collection.cards }).some(
    (cardId) => cards[cardId] !== collection.cards[cardId],
  )
  return changed ? { ...collection, cards, updatedAt: now } : collection
}

/** Même état, à la date de modification près : rien à réécrire. */
const sameOwnership = (a: CardOwnership | undefined, b: CardOwnership) =>
  a?.status === b.status && a.acquiredAt === b.acquiredAt && a.paidPrice === b.paidPrice

/**
 * Pourquoi une carte d'une commande est peut-être en double ; `null` si elle ne l'est pas. Déjà
 * reçue avec une autre commande, elle est signalée : reçue de nouveau, elle prendrait le prix payé
 * de la dernière commande reçue.
 */
export function duplicateReason(line: OrderLine, others: readonly Order[]): string | null {
  if (line.previous?.status === 'owned') return 'Déjà possédée avant cette commande'
  const pending = orderWith(others, line.cardId, 'pending')
  if (pending) return `Déjà dans la commande en cours du ${formatDate(pending.date)}`
  const received = orderWith(others, line.cardId, 'received')
  return received
    ? `Déjà reçue avec la commande du ${formatDate(received.date)} : à la réception de cette commande-ci, son prix payé sera remplacé`
    : null
}

/** Au-delà de ce délai depuis l'achat, en jours, une commande en cours est en retard. */
export const LATE_AFTER_DAYS = 28

/**
 * Les commandes en cours achetées il y a plus de `LATE_AFTER_DAYS` jours (`today` : YYYY-MM-DD) :
 * à réclamer au vendeur.
 */
export const latePendingOrders = (orders: readonly Order[], today: string) =>
  orders.filter(
    (order) => order.state === 'pending' && daysBetween(order.date, today) > LATE_AFTER_DAYS,
  )

/** La plus récente d'abord (date d'achat, puis dernière modification). */
export const sortOrders = (orders: readonly Order[]) =>
  [...orders].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
