/**
 * Les éléments de chaque clé (`keyOf`), dans leur ordre, les clés dans l'ordre de leur premier
 * élément ; un élément sans clé (`null`) n'y est pas. Les cartes du compte par code et par id
 * Cardmarket (`startSeries`, `lib/series.ts`), les commandes par mois et par fournisseur
 * (`lib/budget.ts`), les extensions par année ou par bloc (`SetPicker`).
 */
export function groupBy<T, K>(items: Iterable<T>, keyOf: (item: T) => K | null): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    if (key === null) continue
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return groups
}
