/**
 * Le pseudo d'un compte : son nom sur le site (« Le Pokédex de … ») et l'adresse de son Pokédex
 * public (`/sacha`). La même règle pour le serveur (`worker/auth.ts`), le routeur et les
 * formulaires (`isPseudo`, `lib/account.ts`) : des lettres sans accent, des chiffres, `-` et `_`,
 * de quoi tenir dans une adresse. Unique sans tenir compte des majuscules : « Sacha » et « sacha »
 * sont le même.
 */
export const PSEUDO = {
  min: 2,
  max: 20,
  /** Ses caractères (`isPseudo`, `lib/account.ts`). */
  pattern: '[A-Za-z0-9_\\-]+',
}

/**
 * Les pseudos réservés au site : le premier segment de ses propres adresses (les pages de
 * `router.tsx`, les routes du Worker `/api` et `/images` (`worker/index.ts`, `worker/data.ts`), et
 * les dossiers des fichiers de l'app, `/assets` et `/icons`), qu'un Pokédex public à `/pseudo`
 * cacherait. Une nouvelle page de premier niveau s'y ajoute (aucun compte ne doit déjà porter son
 * nom).
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
  'reglages',
  'catalogue',
  'api',
  'images',
  'assets',
  'icons',
]

/** Ce que dit un formulaire sous le champ du pseudo. */
export const PSEUDO_HINT = `${PSEUDO.min} à ${PSEUDO.max} caractères\u00a0: lettres sans accent, chiffres, - ou _.`

/**
 * Le code du refus d'une connexion à un pseudo bloqué, après trop de mots de passe refusés
 * (`worker/auth.ts`) : le formulaire de connexion le dit (`refusalMessage`, `lib/account.ts`).
 */
export const PSEUDO_LOCKED = 'PSEUDO_LOCKED'

/** La longueur minimale d'un mot de passe, la même pour le serveur (`worker/auth.ts`). */
export const PASSWORD_MIN = 8

/**
 * Un pseudo se tape tel quel : ni majuscule ni correction automatiques (iPhone), ni correcteur
 * (la connexion, et `PSEUDO_FIELD`).
 */
export const PSEUDO_TYPING = {
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
}

/**
 * Le champ du pseudo (inscription, Réglages › Mon compte) : sa longueur au plus ; le reste de la
 * règle (`PSEUDO`) est vérifié à l'envoi (`pseudoProblem`), le refus dit sous le champ, en
 * français, et non par la bulle du navigateur.
 */
export const PSEUDO_FIELD = {
  ...PSEUDO_TYPING,
  label: 'Pseudo',
  autoComplete: 'username',
  maxLength: PSEUDO.max,
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
