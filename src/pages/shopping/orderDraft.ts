/**
 * La saisie d'une commande (`OrderForm`), sans React : le brouillon, des textes tels que tapés
 * (`toDraft` le tire d'une commande), et sa lecture à l'enregistrement (`readDraft`, testé : les
 * montants, les quantités et les dates qu'elle accepte ou refuse) ; et ce que dit chaque état.
 */

import { euroInput, parseEuros, parseLink, parseQuantity } from '@/lib/format'
import { previousOf, refundFits } from '@/lib/orders'
import { isDay } from '@/lib/transfer'
import type { CollectionData, Order, OrderLine, OrderState, Supplier } from '@/types'

/** Une ligne telle que saisie : la quantité et le prix en texte, lus à l'enregistrement. */
export interface DraftLine {
  cardId: string
  quantity: string
  unitPrice: string
}

/** Le formulaire tel que saisi : des textes, lus à l'enregistrement. */
export interface Draft {
  supplier: Supplier
  supplierName: string
  date: string
  reference: string
  state: OrderState
  receivedAt: string
  shipping: string
  fees: string
  refunded: string
  link: string
  note: string
  lines: DraftLine[]
}

/** Ce que fait chaque état d'une commande sur ses cartes (sous le choix de l'état). */
export const STATE_HINTS: Record<OrderState, string> = {
  pending: 'Ses cartes passent en « commandée », sauf celles déjà possédées.',
  received: 'Ses cartes passent en « possédée », datées du jour de réception.',
  cancelled:
    'Elle ne compte plus dans le budget ; ses cartes encore commandées retrouvent leur état d’avant.',
}

/** Une commande reçue ne repasse pas « en cours » (`canBePending`) : dit sous son état. */
export const RECEIVED_HINT =
  'Une commande reçue ne repasse pas en cours : ses cartes restent possédées.'

/** Un jour que l'import et le serveur refuseraient (`isDay`) : une année tapée en deux chiffres. */
const DAY_ERROR = 'L’année en quatre chiffres, par exemple 05/10/2026.'

/** Un montant facultatif : rien pour 0. */
const amountText = (value: number) => (value ? euroInput(value) : '')

export const toDraft = (order: Order): Draft => ({
  supplier: order.supplier,
  supplierName: order.supplierName ?? '',
  date: order.date,
  reference: order.reference ?? '',
  state: order.state,
  receivedAt: order.receivedAt ?? '',
  shipping: amountText(order.shipping),
  fees: amountText(order.fees),
  refunded: amountText(order.refunded),
  link: order.link ?? '',
  note: order.note ?? '',
  lines: order.lines.map((line) => ({
    cardId: line.cardId,
    quantity: String(line.quantity),
    unitPrice: euroInput(line.unitPrice),
  })),
})

/** Un montant facultatif : vide vaut 0. */
const optionalEuros = (text: string) => (text.trim() === '' ? 0 : parseEuros(text))

/**
 * Le brouillon → la commande, et les erreurs de saisie (vides si tout est lisible). `previous` :
 * l'état d'une carte avant la commande (`previousOf`, que le store relit à l'enregistrement).
 */
export function readDraft(
  draft: Draft,
  base: Order,
  stored: Order | null,
  collection: CollectionData,
) {
  const errors: Record<string, string> = {}
  const amount = (key: 'shipping' | 'fees' | 'refunded') => {
    const value = optionalEuros(draft[key])
    if (value === null) errors[key] = 'Montant en euros, par exemple 4,50.'
    return value ?? 0
  }
  const lines: OrderLine[] = draft.lines.map((line) => {
    // Illisible, la ligne compte pour 0 dans l'aperçu : l'erreur bloque l'enregistrement.
    const quantity = parseQuantity(line.quantity) ?? 0
    const unitPrice = parseEuros(line.unitPrice)
    if (quantity < 1) errors[`quantity-${line.cardId}`] = 'Un nombre entier, 1 ou plus.'
    if (unitPrice === null) errors[`price-${line.cardId}`] = 'Un montant, par exemple 12,50.'
    return {
      cardId: line.cardId,
      quantity,
      unitPrice: unitPrice ?? 0,
      previous: previousOf(line.cardId, stored, collection),
    }
  })
  // Les jours que l'import et le serveur acceptent (`isDay`) : « 05/10/26 » donnerait l'an 26, un
  // document que le serveur refuserait, compté au budget d'« octobre 26 ».
  if (!isDay(draft.date)) errors.date = draft.date ? DAY_ERROR : 'Indiquez la date d’achat.'
  if (draft.state === 'received' && draft.receivedAt && !isDay(draft.receivedAt)) {
    errors.receivedAt = DAY_ERROR
  }
  if (lines.length === 0) errors.lines = 'Ajoutez au moins une carte.'
  const link = draft.link.trim()
  if (link && !parseLink(link)) errors.link = 'Une adresse web, par exemple https://…'

  const order: Order = {
    ...base,
    supplier: draft.supplier,
    supplierName: draft.supplier === 'other' ? draft.supplierName.trim() || undefined : undefined,
    date: draft.date,
    reference: draft.reference.trim() || undefined,
    lines,
    shipping: amount('shipping'),
    fees: amount('fees'),
    refunded: amount('refunded'),
    state: draft.state,
    receivedAt: draft.state === 'received' ? draft.receivedAt || draft.date : undefined,
    link: link || undefined,
    note: draft.note.trim() || undefined,
  }
  if (!refundFits(order)) errors.refunded = 'Pas plus que le total de la commande.'
  return { order, errors }
}
