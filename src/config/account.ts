/**
 * Le pseudo d'un compte : son nom sur le site (« Le Pokédex de … ») et l'adresse de son Pokédex
 * public (`/@pseudo`). La même règle pour le serveur (`server/auth.ts`) et les formulaires : des
 * lettres sans accent, des chiffres, `-` et `_`, de quoi tenir dans une adresse. Unique sans
 * tenir compte des majuscules : « Sacha » et « sacha » sont le même.
 */
export const PSEUDO = {
  min: 3,
  max: 20,
  /** Pour l'attribut `pattern` d'un champ (le `-` échappé : il le lit avec le drapeau `v`). */
  pattern: '[A-Za-z0-9_\\-]+',
}

/** Ce que dit un formulaire sous le champ du pseudo. */
export const PSEUDO_HINT = `${PSEUDO.min} à ${PSEUDO.max} caractères : lettres sans accent, chiffres, - ou _.`
