/**
 * Le journal de l'app, une ligne par évènement dans la sortie du serveur (`docker compose logs -f
 * server`, ou le terminal de `bun run dev:server`), à l'heure de Paris, en couleur et avec un emoji
 * par évènement :
 *
 *   16/10 14:03:12  🔓 compte      Connexion : moi@exemple.fr · IP 1.2.3.4
 *
 * - `compte` : connexion (réussie, refusée, bloquée), création du compte, déconnexion (`auth.ts`) ;
 * - `collection` et `achats` : ce qui change dans le document synchronisé, comparé à la version
 *   d'avant (`documentChanges`, `collection.ts`) : cartes ajoutées, possédées, commandes, budget… ;
 * - `données` : l'export et l'import, que le navigateur signale (`POST /api/journal`) : le serveur
 *   ne les voit pas autrement ;
 * - `vitrine` : une visite du Pokédex public ;
 * - `serveur` : son démarrage (`banner`), une erreur imprévue de l'API.
 * Jamais un mot de passe ; l'adresse du visiteur quand le tunnel la donne (`cf-connecting-ip`).
 * Sans couleurs avec `NO_COLOR` (la convention des terminaux).
 */

import { Elysia, t } from 'elysia'
import { ORDER_STATE_LABELS } from '@/config/shopping'
import { formatEuro, plural } from '@/lib/format'
import { cardCount, orderSpent, supplierLabel } from '@/lib/orders'
import type { SyncDocument } from '@/lib/sync'
import type { CollectionData, Order, ShoppingData } from '@/types'
import type { accountRoutes } from './auth'

export type JournalTopic = 'compte' | 'collection' | 'achats' | 'données' | 'vitrine' | 'serveur'

/** Le ton d'un évènement : la couleur de son message. */
export type JournalTone = 'ok' | 'info' | 'warn' | 'bad'

/** Une ligne du journal : son thème, son emoji, son message. */
export interface JournalEntry {
  topic: JournalTopic
  icon: string
  message: string
  tone?: JournalTone
}

/* Les couleurs du terminal (codes ANSI) */

const COLOR = !process.env.NO_COLOR
const paint = (code: string) => (text: string) => (COLOR ? `\x1b[${code}m${text}\x1b[0m` : text)
const dim = paint('2')
const bold = paint('1')
const red = paint('31')
const green = paint('32')
const yellow = paint('33')
const blue = paint('34')
const magenta = paint('35')
const cyan = paint('36')
const white = paint('97')

const TOPICS: Record<JournalTopic, (text: string) => string> = {
  compte: cyan,
  collection: magenta,
  achats: yellow,
  données: blue,
  vitrine: green,
  serveur: white,
}

const TONES: Record<JournalTone, (text: string) => string> = {
  ok: green,
  info: (text) => text,
  warn: yellow,
  bad: red,
}

/** « 16/10 14:03:12 », à l'heure de Paris (le VPS est à l'heure universelle). */
const TIME = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Écrit une ligne du journal ; `request` : pour l'adresse du visiteur. */
export function journal({ topic, icon, message, tone = 'info' }: JournalEntry, request?: Request) {
  const ip = request?.headers.get('cf-connecting-ip')
  const time = TIME.format(new Date())
  const label = TOPICS[topic](bold(topic.padEnd(10)))
  console.log(
    `${dim(time)}  ${icon} ${label} ${TONES[tone](message)}${ip ? dim(` · IP ${ip}`) : ''}`,
  )
}

/**
 * Le démarrage du serveur : une Poké Ball, l'adresse de l'API et du site, et le compte (ou
 * comment le créer).
 */
export function banner({
  api,
  site,
  account,
}: {
  api: string
  site: string
  account: string | null
}) {
  const ball = [
    red('      _.--""--._     '),
    red("    .'          `.   "),
    red('   /              \\  '),
    dim('  ;-------()-------; '),
    white('   \\              /  '),
    white("    `._        _.'   "),
    white("       `--..--'      "),
  ]
  const text = [
    '',
    bold(red('Pokédex')) + dim(' · cartes japonaises'),
    '',
    `${dim('API ')}   ${api}`,
    `${dim('Site')}   ${site}`,
    account
      ? `${dim('Compte')} ${account}`
      : yellow(`Pas encore de compte : ouvrez ${site} pour le créer`),
    '',
  ]
  console.log(['', ...ball.map((line, index) => `${line}  ${text[index] ?? ''}`), ''].join('\n'))
}

/** Au-delà, un import ou un effacement : le reste est compté, pas écrit. */
const MAX_LINES = 20

const entry = (
  topic: JournalTopic,
  icon: string,
  message: string,
  tone?: JournalTone,
): JournalEntry => ({ topic, icon, message, tone })

/** Ce qui a changé d'une version du document à l'autre ; `before` : `null` au premier envoi. */
export function documentChanges(before: SyncDocument | null, after: SyncDocument): JournalEntry[] {
  if (!before) {
    const cards = plural(Object.keys(after.collection.customCards).length, 'carte', 'cartes')
    const orders = plural(after.shopping.orders.length, 'commande', 'commandes')
    return [entry('collection', '🚀', `Premier envoi : ${cards}, ${orders}`, 'ok')]
  }
  const changes = [
    ...cardChanges(before.collection, after.collection),
    ...shoppingChanges(before.shopping, after.shopping),
  ]
  if (changes.length <= MAX_LINES) return changes
  const others = plural(changes.length - MAX_LINES, 'autre changement', 'autres changements')
  return [...changes.slice(0, MAX_LINES), entry('collection', '➕', `… et ${others}`)]
}

/** Les cartes : ajoutées, retirées, corrigées ; leur statut et leur prix payé. */
function cardChanges(before: CollectionData, after: CollectionData): JournalEntry[] {
  const removed = Object.keys(before.customCards).filter((id) => !after.customCards[id])
  if (removed.length > 0 && Object.keys(after.customCards).length === 0) {
    const cards = plural(removed.length, 'carte', 'cartes')
    return [entry('collection', '🧹', `Collection effacée : ${cards}`, 'warn')]
  }
  const lines: JournalEntry[] = []
  const add = (icon: string, message: string, tone?: JournalTone) =>
    lines.push(entry('collection', icon, message, tone))
  for (const [id, card] of Object.entries(after.customCards)) {
    const known = before.customCards[id]
    if (!known) add('🃏', `Carte ajoutée : ${card.reference}`)
    else if (JSON.stringify(known) !== JSON.stringify(card)) {
      add('📝', `Carte modifiée : ${card.reference}`)
    }
  }
  for (const id of removed) add('🔻', `Carte retirée : ${before.customCards[id]!.reference}`)

  for (const id of new Set([...Object.keys(before.cards), ...Object.keys(after.cards)])) {
    const reference = after.customCards[id]?.reference
    // Une carte retirée emporte son statut : la ligne « Carte retirée » le dit.
    if (!reference) continue
    const was = before.cards[id]
    const now = after.cards[id]
    const paid = now?.paidPrice === undefined ? '' : `, payée ${formatEuro(now.paidPrice)}`
    if (now?.status === 'owned' && was?.status !== 'owned') {
      add('⭐', `Carte possédée : ${reference}${paid}`, 'ok')
    } else if (now?.status === 'ordered' && was?.status !== 'ordered') {
      add('📦', `Carte commandée : ${reference}`)
    } else if (!now && was) {
      add('🔙', `Statut retiré : ${reference}`)
    } else if (now && now.paidPrice !== was?.paidPrice) {
      add(
        '💰',
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
function shoppingChanges(before: ShoppingData, after: ShoppingData): JournalEntry[] {
  const lines: JournalEntry[] = []
  const add = (icon: string, message: string, tone?: JournalTone) =>
    lines.push(entry('achats', icon, message, tone))
  const previous = new Map(before.orders.map((order) => [order.id, order]))
  for (const order of after.orders) {
    const known = previous.get(order.id)
    previous.delete(order.id)
    const state = ORDER_STATE_LABELS[order.state].toLowerCase()
    if (!known) add('🛒', `Commande enregistrée (${state}) : ${orderText(order)}`, 'ok')
    else if (known.state !== order.state) {
      if (order.state === 'received') add('📬', `Commande reçue : ${orderText(order)}`, 'ok')
      else if (order.state === 'cancelled') {
        add('🚫', `Commande annulée : ${orderText(order)}`, 'warn')
      } else add('🔁', `Commande remise en cours : ${orderText(order)}`)
    } else if (orderContent(known) !== orderContent(order)) {
      add('📝', `Commande modifiée : ${orderText(order)}`)
    }
  }
  for (const order of previous.values()) {
    add('❌', `Commande supprimée : ${orderText(order)}`, 'warn')
  }

  if (JSON.stringify(before.budget) !== JSON.stringify(after.budget)) {
    const { monthly, ceiling, shippingReserve } = after.budget
    add(
      '💶',
      `Budget : ${formatEuro(monthly)} par mois, plafond ${formatEuro(ceiling)}, port réservé ${formatEuro(shippingReserve)}`,
    )
  }
  return lines
}

const EVENTS = {
  export: entry('données', '💾', 'Collection exportée (fichier JSON)'),
  import: entry('données', '📥', 'Fichier importé : il remplace la collection', 'warn'),
}

/** `POST /api/journal` `{ event }` : ce que le navigateur fait seul (export, import). */
export const journalRoutes = (account: ReturnType<typeof accountRoutes>) =>
  new Elysia({ name: 'journal' }).use(account).post(
    '/journal',
    ({ body, request, status }) => {
      journal(EVENTS[body.event], request)
      return status(204, null)
    },
    {
      auth: true,
      body: t.Object({ event: t.Union([t.Literal('export'), t.Literal('import')]) }),
      detail: { summary: 'Note un export ou un import dans le journal du serveur' },
    },
  )
