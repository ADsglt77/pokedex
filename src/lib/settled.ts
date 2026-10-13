/**
 * Une promesse que `use()` lit sans attendre une fois tenue : elle porte alors `status` et `value`
 * (ou `reason`), ce que React lit en premier (la convention de `use`). Sans eux, `use` suspend au
 * moins une fois, même pour une donnée déjà chargée, et React retient l'affichage environ 300 ms
 * (une fenêtre qui s'ouvre montre « Chargement… » pour rien).
 */
export function settled<T>(promise: Promise<T>): Promise<T> {
  promise.then(
    (value) => Object.assign(promise, { status: 'fulfilled', value }),
    (reason: unknown) => Object.assign(promise, { status: 'rejected', reason }),
  )
  return promise
}
