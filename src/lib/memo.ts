/**
 * Un calcul fait une fois par objet : la valeur de `key` gardée dans `map`, calculée (`compute`) la
 * première fois qu'on la demande, puis toujours la même ; oubliée avec l'objet (`WeakMap`). Ce que
 * l'app tire d'une réponse (`derived`, `lib/api.ts`), les paquets et les ids des prix, et ce qui
 * est prêt pour un état des prix (`store/prices.ts`).
 */
export function memo<K extends WeakKey, V>(map: WeakMap<K, V>, key: K, compute: () => V) {
  let value = map.get(key)
  if (value === undefined) map.set(key, (value = compute()))
  return value
}
