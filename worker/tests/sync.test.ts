/**
 * L'enregistrement de la collection, du navigateur au serveur : `store/account.ts` tel quel, contre
 * le Worker entier (`worker.request`). Une erreur ici perdrait des modifications sans un mot, ou
 * écraserait la collection d'un compte avec celle d'un autre. Couvert : une collection refusée
 * (« Envoi refusé ») reste à enregistrer, jamais relue ni renvoyée telle quelle ; « Se
 * reconnecter » au même compte envoie ce qui attendait, et rien ne part tant que la session est
 * fermée ; au retour sur la page, une collection inchangée n'est pas remplacée (« Annuler » garde
 * ses références), changée ailleurs elle est relue ; celle d'un autre compte (connecté dans un
 * autre onglet) n'est jamais prise ; un envoi dont la réponse s'est perdue est reconnu, et la
 * modification suivante part, même si ce renvoi est refusé, ou si un autre compte se connecte
 * entre-temps (jamais « Session expirée ») ; une réponse 200 coupée laisse l'envoi à renvoyer tel
 * quel (jamais « Rechargée ») ; trop d'envois d'affilée (429) font réessayer, jamais « Envoi
 * refusé » ; une modification faite pendant la compression d'un envoi part aussi ; les envois
 * partent compressés, ou tels quels sans `CompressionStream` ; la page passée en arrière-plan
 * envoie aussitôt ce qui attend ; un autre onglet qui enregistre fait relire la collection ; une
 * modification faite pendant cette relecture n'affiche jamais « Enregistrée » tant qu'elle attend.
 * Une version d'ici remplacée par celle du serveur (409) alors que des modifications attendaient
 * est mise de côté, telle qu'au moment du remplacement (deux appareils, deux onglets, deux conflits
 * d'affilée, une modification faite pendant l'envoi refusé ou pendant la relecture) : reconnecté au
 * même compte, elle reste ; pas exportée, quitter la page le demande ; oubliée ou un autre compte
 * connecté, elle disparaît, et aucune n'est gardée à tort. Le navigateur est simulé (`window`,
 * `document`, `BroadcastChannel`, `fetch` vers le Worker) ; ni interface, ni DOM. On attend l'état
 * voulu (`until`), jamais une durée fixe, sauf pour vérifier que rien ne se passe (`quietly` : trop
 * court, le test passerait à tort, il n'échouerait jamais à tort).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import type { CollectionData, CollectionResponse } from '@/types'
import { card } from '../../tests/fixtures'
import worker from '../index'
import { call, createAccount, ORIGIN, sleep } from './helpers'

/**
 * Les onglets d'un même navigateur (`BroadcastChannel`, que le moteur de Cloudflare n'a pas) : un
 * message posté sur un canal arrive, aussitôt après, aux autres canaux du même nom.
 */
class Channel {
  static open = new Set<Channel>()
  name: string
  onmessage: ((event: { data: unknown }) => void) | null = null
  constructor(name: string) {
    this.name = name
    Channel.open.add(this)
  }
  postMessage(data: unknown) {
    for (const other of Channel.open) {
      if (other !== this && other.name === this.name) {
        queueMicrotask(() => other.onmessage?.({ data }))
      }
    }
  }
  close() {
    Channel.open.delete(this)
  }
}

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
 * mais sa réponse se perd (délai dépassé, réseau coupé) ; `cutNextAnswer` : il arrive, le serveur
 * répond 200, mais le corps de la réponse est coupé (illisible) ; `failNextPut` : le prochain envoi
 * n'arrive pas au serveur, et reçoit ce statut (502 d'un relais, 400) ; `duringNextGet` : ce qui
 * se passe dans la page pendant la prochaine lecture. `exchanges` : chaque échange avec
 * `/api/collection`, dans l'ordre (« GET ?version=3 », « PUT gzip »).
 */
const browser = {
  cookie: '',
  loseNextAnswer: false,
  cutNextAnswer: false,
  failNextPut: 0,
  duringNextGet: null as (() => void) | null,
  exchanges: [] as string[],
}

/**
 * `store/account.ts`, chargé par une adresse calculée, que TypeScript ne suit pas : il parle au
 * navigateur (`window`, `document`), dont les types manquent exprès aux tests
 * (`tsconfig.worker.json`). Ce que le test en emploie.
 */
interface AccountStore {
  signIn: (account: { id: string; name: string }) => Promise<boolean>
  save: () => void
  hasUnsavedChanges: () => boolean
  accountDeleted: () => Promise<void>
  setAsideExported: (id: number) => void
  forgetSetAside: (id: number) => void
  useAccountStore: {
    getState: () => {
      status: string
      refusal: string | null
      setAside: { id: number; document: { collection: CollectionData }; exported: boolean }[]
    }
    subscribe: (listener: (state: { status: string }) => void) => () => void
  }
}
const ACCOUNT_STORE: string = '@/store/account'

const fetchSpy = vi.spyOn(globalThis, 'fetch')
let store: AccountStore
let collectionStore: typeof import('@/store/collection')

beforeAll(async () => {
  // Le store pose ses écouteurs à son chargement : les faux d'abord.
  Object.assign(globalThis, {
    window: { addEventListener: page.addEventListener },
    document: page,
    BroadcastChannel: Channel,
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
    if (init?.method === 'PUT' && browser.failNextPut) {
      const status = browser.failNextPut
      browser.failNextPut = 0
      return new Response('null', { status })
    }
    const response = await worker.request(url.href, { ...init, headers })
    if (init?.method === 'PUT' && browser.loseNextAnswer) {
      browser.loseNextAnswer = false
      throw new TypeError('Réponse perdue')
    }
    if (init?.method === 'PUT' && browser.cutNextAnswer) {
      browser.cutNextAnswer = false
      return new Response((await response.text()).slice(0, 5), response)
    }
    if (init?.method === 'GET' && browser.duringNextGet) {
      const during = browser.duringNextGet
      browser.duringNextGet = null
      during()
    }
    return response
  }) as typeof fetch)
  store = (await import(ACCOUNT_STORE)) as AccountStore
  collectionStore = await import('@/store/collection')
})

// Chaque test part d'un navigateur sans doublure en attente ni page cachée : un test qui échoue
// avant d'avoir consommé la sienne ne fait pas échouer le suivant à tort. La session (`cookie`)
// reste : chaque test se connecte lui-même (`signedIn`).
beforeEach(() => {
  Object.assign(browser, {
    loseNextAnswer: false,
    cutNextAnswer: false,
    failNextPut: 0,
    duringNextGet: null,
    exchanges: [],
  })
  page.visibilityState = 'visible'
})

afterAll(async () => {
  await store.accountDeleted()
  fetchSpy.mockRestore()
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'document')
  Reflect.deleteProperty(globalThis, 'BroadcastChannel')
})

/** Attend que `done` soit vrai : le Worker répond dans le même processus ; 3 s au plus. */
async function until(done: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 3_000
  while (!(await done())) {
    if (Date.now() > deadline) throw new Error('L’état attendu n’est pas venu en 3 s')
    await sleep(10)
  }
}
/** Laisse passer un moment, pour vérifier que rien ne se passe. */
const quietly = () => sleep(150)

const status = () => store.useAccountStore.getState().status
const inMemory = () => collectionStore.useCollectionStore.getState().collection
const cardsInMemory = () => Object.keys(inMemory().customCards).sort()
/** Chaque état pris par le menu, à partir de maintenant ; `stop` cesse de les noter. */
function statuses() {
  const seen: string[] = []
  const stop = store.useAccountStore.subscribe(({ status }) => {
    if (seen.at(-1) !== status) seen.push(status)
  })
  return { seen, stop }
}
/** Tout est enregistré : rien n'attend, et le menu le dit. */
const isSaved = () => status() === 'saved' && !store.hasUnsavedChanges()
/** Les cartes de chaque version mise de côté, de la plus ancienne à la plus récente. */
const setAsideCards = () =>
  store.useAccountStore
    .getState()
    .setAside.map(({ document }) => Object.keys(document.collection.customCards).sort())

/** Une carte de plus en mémoire. */
const addCard = (id: string) =>
  collectionStore.useCollectionStore.getState().saveCard(card(id, [25]))
/** Une modification (une carte de plus), et son envoi, sans attendre la demi-seconde. */
const change = (id: string) => {
  addCard(id)
  store.save()
}

/**
 * `run` sans minuterie : la demi-seconde d'attente d'une modification n'est pas programmée, et
 * seul ce que teste le test peut l'envoyer.
 */
function withoutTimers(run: () => void) {
  const timers = vi.spyOn(globalThis, 'setTimeout').mockImplementation((() => 0) as never)
  try {
    run()
  } finally {
    timers.mockRestore()
  }
}

/** Le compte `pseudo`, créé, et connecté dans ce navigateur. */
async function signedIn(pseudo: string) {
  const { user, cookie } = await createAccount(pseudo)
  browser.cookie = cookie
  const account = { id: user!.id, name: pseudo }
  expect(await store.signIn(account)).toBe(true)
  return { account, cookie }
}

/** La collection du serveur pour la session `cookie`, telle que la lit un appareil. */
async function read(cookie: string) {
  const response = await call('/api/collection', { headers: { Cookie: cookie } })
  return (await response.json()) as CollectionResponse
}

/** La collection enregistrée sur le serveur pour la session `cookie`. */
async function onServer(cookie: string) {
  const body = await read(cookie)
  return { version: body.version, cards: Object.keys(body.collection?.customCards ?? {}).sort() }
}
/** Les cartes enregistrées sur le serveur sont `ids`. */
const serverHas = (cookie: string, ids: string[]) => async () =>
  JSON.stringify((await onServer(cookie)).cards) === JSON.stringify(ids)

/** Un autre appareil (ou un autre onglet) du compte enregistre une carte de plus. */
async function elsewhere(cookie: string, id: string) {
  const body = await read(cookie)
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
  const saved = await call('/api/collection', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify(sent),
  })
  expect(saved.status).toBe(200)
  return body.version + 1
}

describe('store/account.ts : rien de perdu sans un mot, rien d’écrasé', () => {
  test('« Envoi refusé » : la collection refusée reste à enregistrer, jamais relue ni renvoyée telle quelle', async () => {
    const { cookie } = await signedIn('Refus')
    change('a')
    await until(isSaved)
    // Une carte abîmée (son id n'est pas sa clé) : le serveur refuse le document (400).
    const valid = inMemory()
    const broken = {
      ...valid,
      customCards: { ...valid.customCards, a: { ...valid.customCards.a!, id: 'z' } },
    }
    collectionStore.useCollectionStore.getState().replaceCollection(broken)
    store.save()
    await until(() => status() === 'refused')
    expect(store.useAccountStore.getState().refusal).toBeTruthy()
    // Pas enregistrée : la déconnexion propose l'export, quitter la page le demande d'abord.
    expect(store.hasUnsavedChanges()).toBe(true)
    expect(leavingWarns()).toBe(true)
    // Au retour sur la page : rien n'est relu ni renvoyé, la collection d'ici reste.
    const exchanges = browser.exchanges.length
    showPage()
    store.save()
    await quietly()
    expect(browser.exchanges.length).toBe(exchanges)
    expect(inMemory()).toBe(broken)
    expect(status()).toBe('refused')
    // « Annuler » (la collection d'avant) : une nouvelle modification, qui part.
    collectionStore.useCollectionStore.getState().replaceCollection(valid)
    store.save()
    await until(isSaved)
    expect((await onServer(cookie)).cards).toEqual(['a'])
  })

  test('« Se reconnecter » au même compte : ce qui attendait part ; rien ne part tant que la session est fermée', async () => {
    const { account, cookie } = await signedIn('Reconnexion')
    change('a')
    await until(isSaved)
    // Une connexion sur un autre appareil a fermé la session : 401.
    browser.cookie = ''
    change('b')
    await until(() => status() === 'expired')
    expect(store.hasUnsavedChanges()).toBe(true)
    // Tant qu'elle est fermée : ni nouvel envoi (le document entier pour un 401), ni relecture.
    const exchanges = browser.exchanges.length
    change('c')
    showPage()
    await quietly()
    expect(browser.exchanges.length).toBe(exchanges)
    // Reconnecté au même compte : la collection d'ici reste, et part.
    browser.cookie = cookie
    expect(await store.signIn(account)).toBe(true)
    await until(isSaved)
    expect(cardsInMemory()).toEqual(['a', 'b', 'c'])
    expect((await onServer(cookie)).cards).toEqual(['a', 'b', 'c'])
    // Rien n'a changé ailleurs : rien n'est mis de côté.
    expect(setAsideCards()).toEqual([])
  })

  test('au retour sur la page : inchangée, la collection n’est pas remplacée ; changée ailleurs, elle est relue', async () => {
    const { cookie } = await signedIn('Retour')
    change('a')
    await until(isSaved)
    const before = inMemory()
    const { version } = await onServer(cookie)
    showPage()
    // Demandée depuis sa version : inchangée, rien n'est remplacé (« Annuler » marche encore).
    await until(() => browser.exchanges.at(-1) === `GET ?version=${version}`)
    await quietly()
    expect(inMemory()).toBe(before)
    // Changée sur un autre appareil : relue.
    await elsewhere(cookie, 'ailleurs')
    showPage()
    await until(() => cardsInMemory().includes('ailleurs'))
    expect(cardsInMemory()).toEqual(['a', 'ailleurs'])
    await until(isSaved)
    // Rien n'attendait ici : rien n'est mis de côté.
    expect(setAsideCards()).toEqual([])
  })

  test('la collection d’un autre compte (connecté dans un autre onglet) n’est jamais prise, ni écrasée', async () => {
    const { account, cookie } = await signedIn('Premier')
    change('a')
    await until(isSaved)
    // Un autre onglet de ce navigateur se connecte à un autre compte : la session change.
    const other = await createAccount('Second')
    browser.cookie = other.cookie
    const before = inMemory()
    showPage()
    await until(() => status() === 'expired')
    expect(inMemory()).toBe(before)
    // Une modification ici ne part pas vers l'autre compte.
    change('b')
    await quietly()
    expect(await onServer(other.cookie)).toEqual({ version: 0, cards: [] })
    // Reconnecté au premier : elle part chez lui.
    browser.cookie = cookie
    expect(await store.signIn(account)).toBe(true)
    await until(serverHas(cookie, ['a', 'b']))
  })

  test('une réponse perdue : l’envoi est renvoyé tel quel et reconnu, puis la modification suivante part', async () => {
    const { cookie } = await signedIn('Perdue')
    change('a')
    await until(isSaved)
    // Le serveur enregistre « b », mais sa réponse se perd : « Hors ligne ».
    browser.loseNextAnswer = true
    change('b')
    await until(() => status() === 'offline')
    expect((await onServer(cookie)).cards).toEqual(['a', 'b'])
    // La modification suivante : rien de perdu, rien de « Rechargée ».
    change('c')
    await until(isSaved)
    expect((await onServer(cookie)).cards).toEqual(['a', 'b', 'c'])
    expect(cardsInMemory()).toEqual(['a', 'b', 'c'])
    // Chaque envoi est parti compressé.
    const puts = browser.exchanges.filter((exchange) => exchange.startsWith('PUT'))
    expect(puts.length).toBeGreaterThan(0)
    expect(puts.every((exchange) => exchange === 'PUT gzip')).toBe(true)
  })

  test('une réponse perdue, puis un autre compte connecté : son envoi part, jamais « Session expirée »', async () => {
    const first = await signedIn('Perduea')
    change('a')
    await until(isSaved)
    // « b » est enregistré, mais sa réponse se perd : un envoi reste sans réponse.
    browser.loseNextAnswer = true
    change('b')
    await until(() => status() === 'offline')
    // Un autre compte se connecte : l'envoi d'avant, celui du premier compte, ne repart pas.
    const states = statuses()
    const { cookie } = await signedIn('Perdueb')
    change('x')
    await until(isSaved)
    states.stop()
    expect(states.seen).not.toContain('expired')
    expect((await onServer(cookie)).cards).toEqual(['x'])
    expect((await onServer(first.cookie)).cards).toEqual(['a', 'b'])
  })

  test('une réponse 200 coupée : « Hors ligne », l’envoi renvoyé tel quel et reconnu, jamais « Rechargée »', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { cookie } = await signedIn('Coupee')
      change('a')
      await until(isSaved)
      // « b » est enregistré, mais la réponse arrive coupée : illisible, l'envoi reste à renvoyer.
      browser.cutNextAnswer = true
      const states = statuses()
      change('b')
      await until(() => status() === 'offline')
      expect((await onServer(cookie)).cards).toEqual(['a', 'b'])
      change('c')
      await until(isSaved)
      states.stop()
      expect(states.seen).not.toContain('reloaded')
      expect((await onServer(cookie)).cards).toEqual(['a', 'b', 'c'])
      expect(cardsInMemory()).toEqual(['a', 'b', 'c'])
    } finally {
      errors.mockRestore()
    }
  })

  test('un envoi resté sans réponse, renvoyé et refusé : la modification suivante part quand même', async () => {
    const { cookie } = await signedIn('Refusrenvoi')
    change('a')
    await until(isSaved)
    // « b » ne passe pas un relais (502) : il attend, sans réponse.
    browser.failNextPut = 502
    change('b')
    await until(() => status() === 'offline')
    // « c », puis le renvoi de « b » refusé (400) : « c » part, sans attendre une autre occasion.
    browser.failNextPut = 400
    withoutTimers(() => addCard('c'))
    store.save()
    await until(serverHas(cookie, ['a', 'b', 'c']))
    await until(isSaved)
  })

  test('trop d’envois d’affilée (429) : la modification attend et repart, jamais « Envoi refusé »', async () => {
    const { cookie } = await signedIn('Limite')
    change('a')
    await until(isSaved)
    browser.failNextPut = 429
    change('b')
    await until(() => status() === 'offline')
    expect(store.hasUnsavedChanges()).toBe(true)
    // Le nouvel essai (ici sans attendre ses 30 s) : elle part.
    store.save()
    await until(serverHas(cookie, ['a', 'b']))
    await until(isSaved)
  })

  test('une modification faite pendant la compression d’un envoi part aussi', async () => {
    const { cookie } = await signedIn('Pendant')
    change('a')
    await until(isSaved)
    // Le clic arrive pendant que l'envoi de « b » est compressé (ici, au début de la compression).
    const Original = CompressionStream
    let once = true
    class Clicked extends Original {
      constructor(format: ConstructorParameters<typeof CompressionStream>[0]) {
        super(format)
        if (!once) return
        once = false
        queueMicrotask(() => addCard('pendant'))
      }
    }
    Object.assign(globalThis, { CompressionStream: Clicked })
    try {
      change('b')
      await until(serverHas(cookie, ['a', 'b', 'pendant']))
      await until(isSaved)
    } finally {
      Object.assign(globalThis, { CompressionStream: Original })
    }
  })

  test('sans `CompressionStream` (Safari avant 16.4, Firefox avant 113) : l’envoi part tel quel', async () => {
    const { cookie } = await signedIn('Vieux')
    const Original = CompressionStream
    Object.assign(globalThis, { CompressionStream: undefined })
    try {
      change('a')
      await until(isSaved)
    } finally {
      Object.assign(globalThis, { CompressionStream: Original })
    }
    expect(browser.exchanges.at(-1)).toBe('PUT')
    expect((await onServer(cookie)).cards).toEqual(['a'])
  })

  test('la page passe en arrière-plan : ce qui attend part aussitôt, sans attendre la demi-seconde', async () => {
    const { cookie } = await signedIn('Arriere')
    // Sans minuterie : seul le passage en arrière-plan peut l'envoyer.
    withoutTimers(() => addCard('a'))
    hidePage()
    await until(serverHas(cookie, ['a']))
    page.visibilityState = 'visible'
  })

  test('un autre onglet enregistre : celui-ci, sans rien en attente, relit la collection', async () => {
    const { account, cookie } = await signedIn('Onglets')
    change('a')
    await until(isSaved)
    const version = await elsewhere(cookie, 'onglet')
    const channel = new Channel('collection')
    channel.postMessage({ account: account.id, version })
    channel.close()
    await until(() => cardsInMemory().includes('onglet'))
    expect(cardsInMemory()).toEqual(['a', 'onglet'])
    expect(setAsideCards()).toEqual([])
  })

  test('une modification faite pendant la relecture : « Enregistrée » n’est pas affiché tant qu’elle attend', async () => {
    const { cookie } = await signedIn('Lecture')
    change('a')
    await until(isSaved)
    // Une modification refusée (409, changée ailleurs) : relue, « Rechargée ».
    await elsewhere(cookie, 'ailleurs')
    change('b')
    await until(() => status() === 'reloaded')
    // Changée ailleurs encore : le retour sur la page la relit, et une modification arrive pendant
    // la lecture (sans minuterie : seul ce que fait le test l'enverrait).
    await elsewhere(cookie, 'encore')
    browser.duringNextGet = () => withoutTimers(() => addCard('pendant'))
    showPage()
    await until(() => browser.duringNextGet === null)
    await quietly()
    expect(store.hasUnsavedChanges()).toBe(true)
    expect(status()).toBe('reloaded')
    // Elle part ensuite, depuis la version d'avant (changée ailleurs : refusée, puis relue) : la
    // version d'ici, avec elle, est mise de côté après la première.
    store.save()
    await until(() => !store.hasUnsavedChanges())
    expect(setAsideCards()).toEqual([
      ['a', 'b'],
      ['a', 'ailleurs', 'pendant'],
    ])
  })
})

describe('store/account.ts : une version d’ici remplacée par celle du serveur est mise de côté', () => {
  test('deux appareils : reconnecté après une écriture ailleurs, la version d’ici est mise de côté', async () => {
    const { account, cookie } = await signedIn('Appareils')
    change('a')
    await until(isSaved)
    // Une connexion sur l'autre appareil ferme la session d'ici, où une modification attend.
    browser.cookie = ''
    change('b')
    await until(() => status() === 'expired')
    // L'autre appareil enregistre ; reconnecté ici, l'envoi est refusé (409) et la collection relue.
    await elsewhere(cookie, 'ailleurs')
    browser.cookie = cookie
    expect(await store.signIn(account)).toBe(true)
    await until(() => status() === 'reloaded')
    expect(cardsInMemory()).toEqual(['a', 'ailleurs'])
    expect(setAsideCards()).toEqual([['a', 'b']])
    // Plus rien n'attend, mais la version n'est pas exportée : quitter la page le demande.
    expect(store.hasUnsavedChanges()).toBe(false)
    expect(leavingWarns()).toBe(true)
  })

  test('reconnecté au même compte sans rien en attente : la version mise de côté reste, la collection est relue', async () => {
    const { account, cookie } = await signedIn('Memecompte')
    change('a')
    await until(isSaved)
    await elsewhere(cookie, 'ailleurs')
    change('b')
    await until(() => status() === 'reloaded')
    // La session tombe (vu au retour sur la page), l'autre appareil enregistre encore, puis
    // « Se reconnecter » au même compte.
    browser.cookie = ''
    showPage()
    await until(() => status() === 'expired')
    await elsewhere(cookie, 'encore')
    browser.cookie = cookie
    expect(await store.signIn(account)).toBe(true)
    await until(isSaved)
    expect(setAsideCards()).toEqual([['a', 'b']])
    expect(leavingWarns()).toBe(true)
    expect(cardsInMemory()).toEqual(['a', 'ailleurs', 'encore'])
  })

  test('deux onglets : l’autre enregistre pendant qu’une modification attend ici, elle est mise de côté', async () => {
    const { account, cookie } = await signedIn('Deuxonglets')
    change('a')
    await until(isSaved)
    // Une modification attend ici (sans minuterie : seul le test l'envoie) ; l'autre onglet enregistre.
    withoutTimers(() => addCard('b'))
    const version = await elsewhere(cookie, 'onglet')
    const channel = new Channel('collection')
    channel.postMessage({ account: account.id, version })
    channel.close()
    await quietly()
    // Rien n'est relu tant qu'elle attend : elle part, est refusée (409), puis mise de côté.
    expect(cardsInMemory()).toEqual(['a', 'b'])
    store.save()
    await until(() => status() === 'reloaded')
    expect(cardsInMemory()).toEqual(['a', 'onglet'])
    expect(setAsideCards()).toEqual([['a', 'b']])
  })

  test('deux conflits d’affilée : chaque version remplacée est gardée, la plus ancienne d’abord', async () => {
    const { cookie } = await signedIn('Affilee')
    change('a')
    await until(isSaved)
    await elsewhere(cookie, 'ailleurs')
    change('b')
    await until(() => status() === 'reloaded')
    await elsewhere(cookie, 'encore')
    change('c')
    await until(() => setAsideCards().length === 2)
    expect(setAsideCards()).toEqual([
      ['a', 'b'],
      ['a', 'ailleurs', 'c'],
    ])
    await until(() => status() === 'reloaded')
    expect(cardsInMemory()).toEqual(['a', 'ailleurs', 'encore'])
  })

  test('une modification faite pendant l’envoi refusé est dans la version mise de côté', async () => {
    const { cookie } = await signedIn('Concurrence')
    change('a')
    await until(isSaved)
    await elsewhere(cookie, 'ailleurs')
    // Le clic arrive pendant la compression de l'envoi de « b » : après le document envoyé, avant
    // le refus (409). La version mise de côté est celle du moment du remplacement, pas celle envoyée.
    const Original = CompressionStream
    let once = true
    class Clicked extends Original {
      constructor(format: ConstructorParameters<typeof CompressionStream>[0]) {
        super(format)
        if (!once) return
        once = false
        queueMicrotask(() => withoutTimers(() => addCard('pendant')))
      }
    }
    Object.assign(globalThis, { CompressionStream: Clicked })
    try {
      change('b')
      await until(() => setAsideCards().length === 1)
    } finally {
      Object.assign(globalThis, { CompressionStream: Original })
    }
    expect(setAsideCards()).toEqual([['a', 'b', 'pendant']])
    expect(cardsInMemory()).toEqual(['a', 'ailleurs'])
    await until(() => status() === 'reloaded')
  })

  test('une modification faite pendant la relecture d’un conflit est mise de côté avec les autres', async () => {
    const { cookie } = await signedIn('Relecture')
    change('a')
    await until(isSaved)
    await elsewhere(cookie, 'z')
    // « b » est refusé (409) ; pendant la relecture qui suit, « d » arrive : rien n'est remplacé
    // tant qu'elle attend, puis son envoi est refusé à son tour, et la collection relue. Une seule
    // version mise de côté, avec les deux, jamais une version prise avant la relecture.
    browser.duringNextGet = () => addCard('d')
    change('b')
    await until(() => status() === 'reloaded')
    expect(setAsideCards()).toEqual([['a', 'b', 'd']])
    expect(cardsInMemory()).toEqual(['a', 'z'])
  })

  test('exportée, elle ne retient plus la page ; oubliée, elle disparaît ; un autre compte ne la voit jamais', async () => {
    const { cookie } = await signedIn('Oubli')
    change('a')
    await until(isSaved)
    await elsewhere(cookie, 'ailleurs')
    change('b')
    await until(() => status() === 'reloaded')
    const [kept] = store.useAccountStore.getState().setAside
    expect(kept!.exported).toBe(false)
    store.setAsideExported(kept!.id)
    expect(leavingWarns()).toBe(false)
    expect(setAsideCards()).toEqual([['a', 'b']])
    store.forgetSetAside(kept!.id)
    expect(setAsideCards()).toEqual([])
    // Une autre, puis la connexion à un autre compte : elle ne le suit pas.
    await elsewhere(cookie, 'encore')
    change('c')
    await until(() => setAsideCards().length === 1)
    await signedIn('Oubliautre')
    expect(setAsideCards()).toEqual([])
    expect(cardsInMemory()).toEqual([])
    expect(leavingWarns()).toBe(false)
  })
})
