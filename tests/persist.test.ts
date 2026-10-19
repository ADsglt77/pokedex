/**
 * La reprise entre onglets (`persist`) : une valeur reprise d'un autre onglet n'est jamais
 * réécrite. Sans quoi un onglet qui traite d'affilée deux changements en attente (gelé en
 * arrière-plan, ou occupé) réécrit le premier par-dessus le second, et les deux onglets se
 * renvoient ces valeurs jusqu'à s'arrêter sur une ancienne : les dernières modifications (une
 * carte possédée, un prix payé, une commande) perdues, puis envoyées ainsi au serveur.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { createStore } from 'zustand/vanilla'
import { persist } from '@/store/persist'

const KEY = 'essai'

/** Un onglet : sa fenêtre (où arrivent les évènements `storage`) et ceux qui l'attendent. */
interface Tab {
  window: EventTarget
  waiting: { key: string; newValue: string | null }[]
  writes: number
}

let tabs: Tab[] = []
let writer: Tab | undefined

/** Le stockage partagé : chaque changement de valeur attend dans les autres onglets. */
const values = new Map<string, string>()
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem(key: string, value: string) {
    writer!.writes++
    if (values.get(key) === value) return
    values.set(key, value)
    for (const tab of tabs) if (tab !== writer) tab.waiting.push({ key, newValue: value })
  },
  removeItem: (key: string) => values.delete(key),
}

const saved = { window: globalThis.window, localStorage: globalThis.localStorage }
Object.assign(globalThis, { localStorage: storage })
afterAll(() => Object.assign(globalThis, saved))

/** Un onglet ouvert, avec son store suivi par `persist`. */
function open() {
  const tab: Tab = { window: new EventTarget(), waiting: [], writes: 0 }
  tabs.push(tab)
  const store = createStore(() => ({ value: 0 }))
  Object.assign(globalThis, { window: tab.window })
  persist(
    store,
    KEY,
    (state) => state.value,
    (text) => ({ value: Number(text) }),
  )
  return { tab, store }
}

/** Deux onglets neufs, sur un stockage vide : chaque test part de là. */
function twoTabs() {
  tabs = []
  values.clear()
  return [open(), open()] as const
}

/** Cet onglet agit : son changement est enregistré à la fin de la tâche. */
async function act(tab: Tab, change: () => void) {
  writer = tab
  change()
  await Promise.resolve()
}

/** L'onglet traite d'affilée les évènements qui l'attendent, chacun dans sa tâche. */
async function deliver(tab: Tab) {
  writer = tab
  for (const { key, newValue } of tab.waiting.splice(0)) {
    tab.window.dispatchEvent(Object.assign(new Event('storage'), { key, newValue }))
    await Promise.resolve()
  }
}

describe('persist : entre deux onglets', () => {
  test('deux changements en attente, traités d’affilée : rien de réécrit, le dernier gagne', async () => {
    const [a, b] = twoTabs()
    await act(a.tab, () => a.store.setState({ value: 1 }))
    await act(a.tab, () => a.store.setState({ value: 2 }))
    expect(b.tab.waiting.map(({ newValue }) => newValue)).toEqual(['1', '2'])

    await deliver(b.tab)
    expect(b.store.getState().value).toBe(2)
    // L'onglet B n'a rien réécrit : A n'a rien à reprendre, et la valeur enregistrée est la
    // dernière.
    expect(b.tab.writes).toBe(0)
    expect(a.tab.waiting).toEqual([])
    expect(values.get(KEY)).toBe('2')
  })

  test('un changement repris, puis modifié dans cet onglet : enregistré', async () => {
    const [a, b] = twoTabs()
    await act(a.tab, () => a.store.setState({ value: 1 }))
    await deliver(b.tab)
    await act(b.tab, () => b.store.setState({ value: 3 }))
    expect(values.get(KEY)).toBe('3')
    await deliver(a.tab)
    expect(a.store.getState().value).toBe(3)
    // A n'a écrit que sa propre modification.
    expect(a.tab.writes).toBe(1)
  })
})
