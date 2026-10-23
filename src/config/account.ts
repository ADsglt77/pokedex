/**
 * Le pseudo d'un compte : son nom sur le site (« Le Pokédex de … ») et l'adresse de son Pokédex
 * public (`/sacha`). La même règle pour le serveur (`server/auth.ts`), le routeur et les
 * formulaires (`isPseudo`, `lib/account.ts`) : des lettres sans accent, des chiffres, `-` et `_`,
 * de quoi tenir dans une adresse. Unique sans tenir compte des majuscules : « Sacha » et « sacha »
 * sont le même.
 */
export const PSEUDO = {
  min: 2,
  max: 20,
  /** Pour l'attribut `pattern` d'un champ (le `-` échappé : il le lit avec le drapeau `v`). */
  pattern: '[A-Za-z0-9_\\-]+',
}

/**
 * Les pseudos réservés au site : le premier segment de ses propres adresses (les pages de
 * `router.tsx`, les dossiers que sert nginx), qu'un Pokédex public à `/pseudo` cacherait. Une
 * nouvelle page de premier niveau s'y ajoute (aucun compte ne doit déjà porter son nom).
 */
export const RESERVED_PSEUDOS = [
  'connexion',
  'inscription',
  'mentions-legales',
  'pokedex',
  'pokemon',
  'collections',
  'valeur',
  'achats',
  'donnees',
  'catalogue',
  'api',
  'images',
  'assets',
  'icons',
]

/** Ce que dit un formulaire sous le champ du pseudo. */
export const PSEUDO_HINT = `${PSEUDO.min} à ${PSEUDO.max} caractères\u00a0: lettres sans accent, chiffres, - ou _.`

/** La longueur minimale d'un mot de passe, la même pour le serveur (`server/auth.ts`). */
export const PASSWORD_MIN = 8

/** Le champ du pseudo (inscription, Réglages › Mon compte) : la règle de `PSEUDO`. */
export const PSEUDO_FIELD = {
  label: 'Pseudo',
  autoComplete: 'username',
  minLength: PSEUDO.min,
  maxLength: PSEUDO.max,
  pattern: PSEUDO.pattern,
  required: true,
}

/** Le champ d'un nouveau mot de passe (inscription, Réglages › Mon compte). */
export const NEW_PASSWORD_FIELD = {
  hint: `${PASSWORD_MIN} caractères au moins.`,
  type: 'password',
  autoComplete: 'new-password',
  minLength: PASSWORD_MIN,
  required: true,
}
