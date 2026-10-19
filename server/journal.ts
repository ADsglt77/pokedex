/**
 * Le journal de l'app, dans la sortie du serveur (`docker compose logs -f server`, ou le terminal de
 * `bun run dev:server`) : une ligne par évènement, alignée, à l'heure de Paris, son niveau en
 * symbole de couleur, son thème, un message court et ses détails en `clé=valeur` :
 *
 *   16/10 14:03:12  ✔  compte      Connexion                  email=moi@exemple.fr ip=1.2.3.4
 *
 * - `compte` : connexion (réussie, refusée, bloquée), création du compte (ou son refus),
 *   déconnexion, mot de passe et pseudo changés, ancienne session fermée (`auth.ts`) ;
 * - `collection` et `achats` : ce qui change dans le document synchronisé, comparé à la version
 *   d'avant (`documentChanges`, `collection.ts`) : cartes ajoutées, possédées, commandes, budget… ;
 * - `données` : l'export et l'import, que le navigateur signale (`POST /api/journal`) : le serveur
 *   ne les voit pas autrement ;
 * - `vitrine` : une visite du Pokédex public, un lien partagé lu par un robot d'aperçu (une ligne
 *   par visiteur et par heure au plus, `vitrine.ts`) ;
 * - `serveur` : une erreur imprévue de l'API ou de Better Auth, une image que sa source n'a pas
 *   donnée (`images.ts`).
 * Pas les requêtes une à une : seulement ce qui se passe.
 * Au démarrage, une Poké Ball en pixel art (`banner`). Jamais un mot de passe ; l'adresse du
 * visiteur quand le tunnel la donne (`cf-connecting-ip`). Ce qu'un visiteur peut provoquer à
 * volonté (une connexion refusée, une visite) : une ligne par visiteur et par minute au plus
 * (`journalOnce`). Sans couleurs avec `NO_COLOR` (la convention des terminaux).
 */

import { Elysia, t } from 'elysia'
import { ORDER_STATE_LABELS } from '@/config/shopping'
import { formatEuro, formatInteger } from '@/lib/format'
import { cardCount, orderSpent, supplierLabel } from '@/lib/orders'
import type { SyncDocument } from '@/lib/sync'
import type { CollectionData, Order, ShoppingData } from '@/types'
import type { accountRoutes } from './auth'

type JournalTopic = 'compte' | 'collection' | 'achats' | 'données' | 'vitrine' | 'serveur'

/** Réussi, simple information, à surveiller, refusé ou en erreur. */
export type JournalLevel = 'ok' | 'info' | 'warn' | 'error'

interface JournalEntry {
  topic: JournalTopic
  level?: JournalLevel
  /** Court : ce qui s'est passé (« Carte possédée »). */
  message: string
  /** Le reste, en `clé=valeur` ; une valeur absente n'est pas écrite. */
  details?: Record<string, string | number | undefined>
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

const LEVELS: Record<JournalLevel, string> = {
  ok: green('✔'),
  info: cyan('•'),
  warn: yellow('▲'),
  error: red('✖'),
}

const TOPICS: Record<JournalTopic, (text: string) => string> = {
  compte: cyan,
  collection: magenta,
  achats: yellow,
  données: blue,
  vitrine: green,
  serveur: red,
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

/** La longueur d'une valeur écrite, au plus (un e-mail, une référence de carte y tiennent). */
const MAX_VALUE = 200

/** Coupé au-delà de `MAX_VALUE` caractères (« … » à la fin). */
const cut = (text: string) => (text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text)

/** Les caractères de contrôle (C0, DEL, C1 dont le CSI `\x9b`) en `\u00xx`. */
const escapeControls = (text: string) =>
  text.replace(/\p{Cc}/gu, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)

/**
 * Un texte venu d'ailleurs (un message de Better Auth, qui peut recopier ce qu'envoie un
 * visiteur), écrit tel quel mais sans danger : coupé et ses caractères de contrôle échappés (un
 * retour à la ligne lui ferait écrire une fausse ligne du journal, un échappement ANSI piloter le
 * terminal).
 */
export const safeText = (text: string) => escapeControls(cut(text))

/**
 * `carte="Pikachu ex (SV8 033)"` : entre guillemets, échappée comme en JSON, dès qu'il y a une
 * espace, un guillemet, un `=` ou un caractère de contrôle. Une valeur peut venir d'un visiteur
 * (l'e-mail ou le pseudo d'une connexion refusée) : un retour à la ligne lui ferait écrire une
 * fausse ligne du journal, un échappement ANSI piloter le terminal. Ceux que JSON laisse passer
 * (DEL, les contrôles C1) sont échappés aussi. Coupée au-delà de `MAX_VALUE` caractères : un
 * e-mail de 2 Mo ferait une ligne de 2 Mo, et quelques-unes suffiraient à faire tourner le journal
 * de Docker (3 × 10 Mo) et à effacer les connexions.
 */
const detail = (key: string, value: string | number) => {
  const text = cut(String(value))
  const shown = /[\s="\p{Cc}]/u.test(text) ? escapeControls(JSON.stringify(text)) : text
  return `${dim(`${key}=`)}${shown}`
}

/** La colonne du message : les détails commencent tous au même endroit. */
const WIDTH = 32

/** Le début de chaque ligne : l'heure, le niveau, le thème. */
const head = (symbol: string, topic: JournalTopic) =>
  `${dim(TIME.format(new Date()))}  ${symbol}  ${TOPICS[topic](topic.padEnd(10))}`

/**
 * Écrit une ligne du journal ; `request` : pour l'adresse du visiteur. Le message aussi est
 * rendu sans danger (`safeText`) : il n'est jamais censé venir d'un visiteur, mais un oubli ne
 * doit pas permettre d'écrire une fausse ligne.
 */
export function journal(
  { topic, level = 'info', message, details = {} }: JournalEntry,
  request?: Request,
) {
  const all: NonNullable<JournalEntry['details']> = {
    ...details,
    ip: request?.headers.get('cf-connecting-ip') ?? undefined,
  }
  const rest = Object.entries(all)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => detail(key, value))
    .join(' ')
  console.log(`${head(LEVELS[level], topic)}  ${safeText(message).padEnd(WIDTH)} ${rest}`.trimEnd())
}

/**
 * Le visiteur d'une requête, pour compter ses actions : son adresse (`cf-connecting-ip`), ramenée
 * à son réseau /64 pour une IPv6 (un fournisseur en donne des milliards à chacun) ; `''` sans tunnel
 * (en développement).
 */
export function visitorOf(request?: Request) {
  const ip = request?.headers.get('cf-connecting-ip') ?? ''
  if (!ip.includes(':')) return ip
  const [head = '', tail = ''] = ip.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = ip.includes('::')
    ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    : left
  return `${groups.slice(0, 4).join(':')}::/64`
}

/** Les lignes de `journalOnce` : leur clé, l'heure de la dernière écrite, celles tues depuis. */
const noted = new Map<string, { at: number; silenced: number }>()

/** Au-delà, les plus anciennes sont oubliées (pas toutes : on écrirait de nouveau pour chacun). */
const MAX_NOTED = 10_000

/**
 * Écrit une ligne au plus par `key` (un visiteur et ce qu'il fait) et par `windowMs` : un afflux de
 * requêtes (des connexions refusées, des visites) ne fait pas tourner le journal de Docker
 * (3 × 10 Mo), ce qui effacerait les connexions. Les lignes tues sont comptées, et dites par la
 * suivante (`tues=…`).
 */
export function journalOnce(
  key: string,
  entry: JournalEntry,
  request: Request | undefined,
  windowMs: number,
) {
  const now = Date.now()
  const known = noted.get(key)
  if (known && now - known.at < windowMs) {
    known.silenced++
    return
  }
  noted.delete(key)
  noted.set(key, { at: now, silenced: 0 })
  for (const oldest of noted.keys()) {
    if (noted.size <= MAX_NOTED) break
    noted.delete(oldest)
  }
  const tues = known?.silenced || undefined
  journal({ ...entry, details: { ...entry.details, tues } }, request)
}

/*
 * La Poké Ball du démarrage, 14 × 14 pixels : deux pixels par caractère (demi-bloc « ▀ », couleur
 * du haut en avant-plan, du bas en arrière-plan), en couleurs 24 bits. `.` : transparent.
 */

const PIXELS = [
  '....KKKKKK....',
  '..KKRRRRRRKK..',
  '.KRRhhRRRRRRK.',
  '.KRhRRRRRRRRK.',
  'KRRRRRRRRRRRRK',
  'KRRRRKKKKRRRRK',
  'KKKKKKWWKKKKKK',
  'KKKKKKWWKKKKKK',
  'KWWWWKKKKWWWWK',
  'KWWWWWWWWWWWWK',
  '.KWWWWWWWWWWK.',
  '.KWWWWWWWWSSK.',
  '..KKSWWWWSKK..',
  '....KKKKKK....',
]

const PALETTE: Record<string, readonly [number, number, number]> = {
  K: [38, 38, 44],
  R: [227, 53, 13],
  h: [255, 140, 120],
  W: [242, 242, 246],
  S: [190, 190, 200],
}

/** Deux rangées de pixels en une ligne de caractères. */
function pixelRow(top: string, bottom: string) {
  return [...top]
    .map((pixel, index) => {
      const above = PALETTE[pixel]
      const below = PALETTE[bottom[index]!]
      if (!above && !below) return ' '
      if (!above) return `\x1b[38;2;${below!.join(';')}m▄\x1b[0m`
      if (!below) return `\x1b[38;2;${above.join(';')}m▀\x1b[0m`
      return `\x1b[38;2;${above.join(';')};48;2;${below.join(';')}m▀\x1b[0m`
    })
    .join('')
}

/**
 * Le démarrage du serveur : la Poké Ball, et à côté l'adresse de l'API et du site, le compte (ou
 * où le créer), le mode, la version de Bun et le temps de démarrage. Sans couleurs, le texte seul.
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
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'développement'
  const ready = formatInteger(Math.round(performance.now()))
  const text = [
    '',
    `${bold('Pokédex')} ${dim('· le serveur de l’app')}`,
    dim('─'.repeat(38)),
    `${dim('API     ')}${api}`,
    `${dim('Site    ')}${site}`,
    `${dim('Compte  ')}${account ?? yellow(`à créer sur ${site}`)}`,
    dim(`${mode} · Bun ${Bun.version} · prêt en ${ready} ms`),
  ]
  const ball = COLOR
    ? Array.from({ length: PIXELS.length / 2 }, (_, row) =>
        pixelRow(PIXELS[row * 2]!, PIXELS[row * 2 + 1]!),
      )
    : []
  const lines = text.map((line, row) => (ball[row] ? `  ${ball[row]}   ${line}` : `  ${line}`))
  console.log(['', ...lines, ''].join('\n'))
}

/* Ce qui change dans la collection et les achats */

/** Au-delà, un import ou un effacement : le reste est compté, pas écrit. */
const MAX_LINES = 20

/** Ce qui a changé d'une version du document à l'autre ; `before` : `null` au premier envoi. */
export function documentChanges(before: SyncDocument | null, after: SyncDocument): JournalEntry[] {
  if (!before) {
    const cartes = Object.keys(after.collection.customCards).length
    const commandes = after.shopping.orders.length
    return [
      {
        topic: 'collection',
        level: 'ok',
        message: 'Premier envoi',
        details: { cartes, commandes },
      },
    ]
  }
  const changes = [
    ...cardChanges(before.collection, after.collection),
    ...shoppingChanges(before.shopping, after.shopping),
  ]
  if (changes.length <= MAX_LINES) return changes
  const nombre = changes.length - MAX_LINES
  return [
    ...changes.slice(0, MAX_LINES),
    { topic: 'collection', message: 'Autres changements', details: { nombre } },
  ]
}

/** Les cartes : ajoutées, retirées, corrigées ; leur statut et leur prix payé. */
function cardChanges(before: CollectionData, after: CollectionData): JournalEntry[] {
  const removed = Object.keys(before.customCards).filter((id) => !after.customCards[id])
  if (removed.length > 0 && Object.keys(after.customCards).length === 0) {
    const details = { cartes: removed.length }
    return [{ topic: 'collection', level: 'warn', message: 'Collection effacée', details }]
  }
  const lines: JournalEntry[] = []
  const add = (message: string, carte: string, level?: JournalLevel, payé?: string) =>
    lines.push({ topic: 'collection', level, message, details: { carte, payé } })
  for (const [id, card] of Object.entries(after.customCards)) {
    const known = before.customCards[id]
    if (!known) add('Carte ajoutée', card.reference)
    else if (JSON.stringify(known) !== JSON.stringify(card)) add('Carte modifiée', card.reference)
  }
  for (const id of removed) add('Carte retirée', before.customCards[id]!.reference)

  for (const id of new Set([...Object.keys(before.cards), ...Object.keys(after.cards)])) {
    const reference = after.customCards[id]?.reference
    // Une carte retirée emporte son statut : la ligne « Carte retirée » le dit.
    if (!reference) continue
    const was = before.cards[id]
    const now = after.cards[id]
    const paid = now?.paidPrice === undefined ? undefined : formatEuro(now.paidPrice)
    if (now?.status === 'owned' && was?.status !== 'owned') {
      add('Carte possédée', reference, 'ok', paid)
    } else if (now?.status === 'ordered' && was?.status !== 'ordered') {
      add('Carte commandée', reference)
    } else if (!now && was) {
      add('Statut retiré', reference)
    } else if (now && now.paidPrice !== was?.paidPrice) {
      add(paid ? 'Prix payé noté' : 'Prix payé effacé', reference, 'info', paid)
    }
  }
  return lines
}

/** Une commande en détails : fournisseur, référence, nombre de cartes, total. */
const orderDetails = (order: Order) => ({
  fournisseur: supplierLabel(order),
  réf: order.reference,
  cartes: cardCount(order.lines),
  total: formatEuro(orderSpent(order)),
})

/** Une commande sans sa date de modification : ce que l'utilisateur a changé. */
const orderContent = (order: Order) => JSON.stringify({ ...order, updatedAt: undefined })

/** Les commandes (nouvelles, reçues, annulées, supprimées, corrigées) et le budget. */
function shoppingChanges(before: ShoppingData, after: ShoppingData): JournalEntry[] {
  const lines: JournalEntry[] = []
  const add = (message: string, order: Order, level?: JournalLevel) =>
    lines.push({ topic: 'achats', level, message, details: orderDetails(order) })
  const previous = new Map(before.orders.map((order) => [order.id, order]))
  for (const order of after.orders) {
    const known = previous.get(order.id)
    previous.delete(order.id)
    if (!known) {
      const état = ORDER_STATE_LABELS[order.state].toLowerCase()
      lines.push({
        topic: 'achats',
        level: 'ok',
        message: 'Commande enregistrée',
        details: { état, ...orderDetails(order) },
      })
    } else if (known.state !== order.state) {
      if (order.state === 'received') add('Commande reçue', order, 'ok')
      else if (order.state === 'cancelled') add('Commande annulée', order, 'warn')
      else add('Commande remise en cours', order)
    } else if (orderContent(known) !== orderContent(order)) {
      add('Commande modifiée', order)
    }
  }
  for (const order of previous.values()) add('Commande supprimée', order, 'warn')

  if (JSON.stringify(before.budget) !== JSON.stringify(after.budget)) {
    const { monthly, ceiling, shippingReserve } = after.budget
    lines.push({
      topic: 'achats',
      message: 'Budget modifié',
      details: {
        mois: formatEuro(monthly),
        plafond: formatEuro(ceiling),
        port: formatEuro(shippingReserve),
      },
    })
  }
  return lines
}

const EVENTS: Record<'export' | 'import', JournalEntry> = {
  export: { topic: 'données', message: 'Collection exportée', details: { format: 'JSON' } },
  import: {
    topic: 'données',
    level: 'warn',
    message: 'Fichier importé',
    details: { effet: 'collection remplacée' },
  },
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
