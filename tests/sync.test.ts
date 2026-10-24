/**
 * L'enregistrement de la collection, du navigateur au serveur : `store/account.ts` tel quel, contre
 * le serveur entier (`createApp`, `tests/server.ts`). Une erreur ici perdrait des modifications
 * sans un mot, ou écraserait la collection d'un compte avec celle d'un autre. Couvert : une
 * collection refusée (« Envoi refusé ») reste à enregistrer, jamais relue ni renvoyée telle quelle ;
 * « Se reconnecter » au même compte envoie ce qui attendait, et rien ne part tant que la session est
 * fermée ; au retour sur la page, une collection inchangée n'est pas remplacée (« Annuler » garde
 * ses références), changée ailleurs elle est relue ; celle d'un autre compte (connecté dans un autre
 * onglet) n'est jamais prise ; un envoi dont la réponse s'est perdue est reconnu, et la
 * modification suivante part ; les envois partent compressés ; la page passée en arrière-plan
 * envoie aussitôt ce qui attend ; un autre onglet qui enregistre fait relire la collection. Le
 * navigateur est simulé (`window`, `document`, `fetch` vers le serveur) ; ni interface, ni DOM.
 */

import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test'
import type { CollectionData, CollectionResponse } from '@/types'
import { card } from './fixtures'
import { openServer, ORIGIN } from './server'

// Le journal du serveur : muet pendant ces tests.
const log = spyOn(console, 'log').mockImplementation(() => {})
afterAll(() => log.mockRestore())

const { server, createAccount } = await openServer()

/** Ce que `store/account.ts` écoute : la page (`document`) et la fenêtre (`window`). */
const listeners = new Map<string, (event?: unknown) => void>()
const page = {
  visibilityState: 'visible',
  addEventListener: (type: string, listener: (event?: unknown) => void) =>
    listeners.set(type, listener),
}
/** La page revient au premier plan, ou passe en arrière-plan. */
const showPage = () => {
  page.visibilityState = 'visible'
  listeners.get('visibilitychange')!()
}
const hidePage = () => {
  page.visibilityState = 'hidden'
  listeners.get('visibilitychange')!()
}
/** Quitter la page : le navigateur le demande-t-il d'abord (`beforeunload`) ? */
const leavingWarns = () => {
  let warned = false
  listeners.get('beforeunload')!({ preventDefault: () => (warned = true) })
  return warned
}

/**
 * Le navigateur : sa session (`cookie`) ; `loseNextAnswer` : le prochain envoi arrive au serveur,
 * mais sa réponse se perd (délai dépassé, réseau coupé). `exchanges` : chaque échange avec
 * `/api/collection`, dans l'ordre (« GET ?version=3 », « PUT gzip »).
 */
const browser = { cookie: '', loseNextAnswer: false, exchanges: [] as string[] }

/**
 * `store/account.ts`, chargé par une adresse calculée, que TypeScript ne suit pas : il parle au
 * navigateur (`window`, `document`), dont les types manquent exprès aux tests
 * (`tsconfig.bun.json`). Ce que le test en emploie.
 */
interface AccountStore {
  signIn: (account: { id: string; name: string }) => Promise<boolean>
  save: () => void
  hasUnsavedChanges: () => boolean
  accountDeleted: () => Promise<void>
  useAccountStore: { getState: () => { status: string; refusal: string | null } }
}
const ACCOUNT_STORE: string = '@/store/account'

const fetchSpy = spyOn(globalThis, 'fetch')
let store: AccountStore
let collectionStore: typeof import('@/store/collection')

beforeAll(async () => {
  // Le store pose ses écouteurs à son chargement : les faux d'abord.
  Object.assign(globalThis, {
    window: { addEventListener: page.addEventListener },
    document: page,
  })
  fetchSpy.mockImplementation((async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), ORIGIN)
    const headers = new Headers(init?.headers)
    headers.set('Origin', ORIGIN)
    headers.set('Cookie', browser.cookie)
    if (url.pathname === '/api/collection') {
      const gzip = headers.get('content-encoding') === 'gzip' ? ' gzip' : ''
      browser.exchanges.push(`${init?.method ?? 'GET'}${url.search ? ` ${url.search}` : ''}${gzip}`)
    }
    const response = await server.handle(new Request(url.href, { ...init, headers }))
    if (init?.method === 'PUT' && browser.loseNextAnswer) {
      browser.loseNextAnswer = false
      throw new TypeError('Réponse perdue')
    }
    return response
  }) as typeof fetch)
  store = (await import(ACCOUNT_STORE)) as AccountStore
  collectionStore = await import('@/store/collection')
})

afterAll(async () => {
  await store.accountDeleted()
  fetchSpy.mockRestore()
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
})

/** Laisse finir les échanges en cours : le serveur répond dans le même processus. */
const settle = () => Bun.sleep(150)
/** Une modification (une carte de plus), puis son envoi, sans attendre la demi-seconde. */
const edit = async (id: string) => {
  collectionStore.useCollectionStore.getState().saveCard(card(id, [25]))
  store.save()
  await settle()
}
const status = () => store.useAccountStore.getState().status
const inMemory = () => collectionStore.useCollectionStore.getState().collection

/** Le compte `pseudo`, créé, et connecté dans ce navigateur. */
async function signedIn(pseudo: string) {
  const { user, cookie } = await createAccount(pseudo)
  browser.cookie = cookie
  const account = { id: user!.id, name: pseudo }
  expect(await store.signIn(account)).toBe(true)
  return { account, cookie }
}

/** La collection enregistrée sur le serveur pour la session `cookie`. */
async function onServer(cookie: string) {
  const response = await server.handle(
    new Request(`${ORIGIN}/api/collection`, { headers: { Cookie: cookie } }),
  )
  const body = (await response.json()) as CollectionResponse
  return { version: body.version, cards: Object.keys(body.collection?.customCards ?? {}) }
}

/** Un autre appareil (ou un autre onglet) du compte enregistre une carte de plus. */
async function elsewhere(cookie: string, id: string) {
  const response = await server.handle(
    new Request(`${ORIGIN}/api/collection`, { headers: { Cookie: cookie } }),
  )
  const body = (await response.json()) as CollectionResponse
  const collection = body.collection!
  const sent = {
    account: body.account,
    baseVersion: body.version,
    collection: {
      ...collection,
      customCards: { ...collection.customCards, [id]: card(id, [4]) },
      favorites: { ...collection.favorites, 4: id },
    } satisfies CollectionData,
    shopping: body.shopping,
  }
  const saved = await server.handle(
    new Request(`${ORIGIN}/api/collection`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
      body: JSON.stringify(sent),
    }),
  )
  expect(saved.status).toBe(200)
  return body.version + 1
}

describe('store/account.ts : rien de perdu sans un mot, rien d’écrasé', () => {
  test('« Envoi refusé » : la collection refusée reste à enregistrer, jamais relue ni renvoyée telle quelle', async () => {
    const { cookie } = await signedIn('Refus')
    await edit('a')
    expect(status()).toBe('saved')
    // Une carte abîmée (son id n'est pas sa clé) : le serveur refuse le document (400).
    const valid = inMemory()
    const broken = {
      ...valid,
      customCards: { ...valid.customCards, a: { ...valid.customCards.a!, id: 'z' } },
    }
    collectionStore.useCollectionStore.getState().replaceCollection(broken)
    store.save()
    await settle()
    expect(status()).toBe('refused')
    expect(store.useAccountStore.getState().refusal).toBeTruthy()
    // Pas enregistrée : la déconnexion propose l'export, quitter la page le demande d'abord.
    expect(store.hasUnsavedChanges()).toBe(true)
    expect(leavingWarns()).toBe(true)
    // Au retour sur la page : rien n'est relu ni renvoyé, la collection d'ici reste.
    const exchanges = browser.exchanges.length
    showPage()
    store.save()
    await settle()
    expect(browser.exchanges.length).toBe(exchanges)
    expect(inMemory()).toBe(broken)
    expect(status()).toBe('refused')
    // « Annuler » (la collection d'avant) : une nouvelle modification, qui part.
    collectionStore.useCollectionStore.getState().replaceCollection(valid)
    store.save()
    await settle()
    expect(status()).toBe('saved')
    expect(store.hasUnsavedChanges()).toBe(false)
    expect((await onServer(cookie)).cards).toEqual(['a'])
  })

  test('« Se reconnecter » au même compte : ce qui attendait part ; rien ne part tant que la session est fermée', async () => {
    const { account, cookie } = await signedIn('Reconnexion')
    await edit('a')
    // Une connexion sur un autre appareil a fermé la session : 401.
    browser.cookie = ''
    await edit('b')
    expect(status()).toBe('expired')
    expect(store.hasUnsavedChanges()).toBe(true)
    // Tant qu'elle est fermée : ni nouvel envoi (le document entier pour un 401), ni relecture.
    const exchanges = browser.exchanges.length
    await edit('c')
    showPage()
    await settle()
    expect(browser.exchanges.length).toBe(exchanges)
    // Reconnecté au même compte : la collection d'ici reste, et part.
    browser.cookie = cookie
    expect(await store.signIn(account)).toBe(true)
    await settle()
    expect(status()).toBe('saved')
    expect(store.hasUnsavedChanges()).toBe(false)
    expect(Object.keys(inMemory().customCards).sort()).toEqual(['a', 'b', 'c'])
    expect((await onServer(cookie)).cards.sort()).toEqual(['a', 'b', 'c'])
  })

  test('au retour sur la page : inchangée, la collection n’est pas remplacée ; changée ailleurs, elle est relue', async () => {
    const { cookie } = await signedIn('Retour')
    await edit('a')
    const before = inMemory()
    const { version } = await onServer(cookie)
    showPage()
    await settle()
    // Demandée depuis sa version : inchangée, rien n'est remplacé (« Annuler » marche encore).
    expect(browser.exchanges.at(-1)).toBe(`GET ?version=${version}`)
    expect(inMemory()).toBe(before)
    // Changée sur un autre appareil : relue.
    await elsewhere(cookie, 'ailleurs')
    showPage()
    await settle()
    expect(Object.keys(inMemory().customCards).sort()).toEqual(['a', 'ailleurs'])
    expect(status()).toBe('saved')
  })

  test('la collection d’un autre compte (connecté dans un autre onglet) n’est jamais prise, ni écrasée', async () => {
    const { account, cookie } = await signedIn('Premier')
    await edit('a')
    // Un autre onglet de ce navigateur se connecte à un autre compte : la session change.
    const other = await createAccount('Second')
    browser.cookie = other.cookie
    const before = inMemory()
    showPage()
    await settle()
    expect(inMemory()).toBe(before)
    expect(status()).toBe('expired')
    // Une modification ici ne part pas vers l'autre compte.
    await edit('b')
    expect(await onServer(other.cookie)).toEqual({ version: 0, cards: [] })
    // Reconnecté au premier : elle part chez lui.
    browser.cookie = cookie
    expect(await store.signIn(account)).toBe(true)
    await settle()
    expect((await onServer(cookie)).cards.sort()).toEqual(['a', 'b'])
  })

  test('une réponse perdue : l’envoi est renvoyé tel quel et reconnu, puis la modification suivante part', async () => {
    const { cookie } = await signedIn('Perdue')
    await edit('a')
    // Le serveur enregistre « b », mais sa réponse se perd : « Hors ligne ».
    browser.loseNextAnswer = true
    await edit('b')
    expect(status()).toBe('offline')
    expect((await onServer(cookie)).cards.sort()).toEqual(['a', 'b'])
    // La modification suivante : rien de perdu, rien de « Rechargée ».
    await edit('c')
    expect(status()).toBe('saved')
    expect((await onServer(cookie)).cards.sort()).toEqual(['a', 'b', 'c'])
    expect(Object.keys(inMemory().customCards).sort()).toEqual(['a', 'b', 'c'])
    // Chaque envoi est parti compressé.
    const puts = browser.exchanges.filter((exchange) => exchange.startsWith('PUT'))
    expect(puts.length).toBeGreaterThan(0)
    expect(puts.every((exchange) => exchange === 'PUT gzip')).toBe(true)
  })

  test('la page passe en arrière-plan : ce qui attend part aussitôt, sans attendre la demi-seconde', async () => {
    const { cookie } = await signedIn('Arriere')
    collectionStore.useCollectionStore.getState().saveCard(card('a', [25]))
    hidePage()
    await Bun.sleep(100)
    expect((await onServer(cookie)).cards).toEqual(['a'])
    page.visibilityState = 'visible'
  })

  test('un autre onglet enregistre : celui-ci, sans rien en attente, relit la collection', async () => {
    const { account, cookie } = await signedIn('Onglets')
    await edit('a')
    const version = await elsewhere(cookie, 'onglet')
    const channel = new BroadcastChannel('collection')
    channel.postMessage({ account: account.id, version })
    channel.close()
    await settle()
    expect(Object.keys(inMemory().customCards).sort()).toEqual(['a', 'onglet'])
  })
})
