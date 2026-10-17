/** Le presse-papiers : copier un texte (l'adresse du Pokédex public, les lignes pour Cardmarket). */

/**
 * Copie un texte ; la promesse échoue si le navigateur refuse, ou s'il n'a pas de presse-papiers :
 * hors https (le site ouvert par l'adresse de la machine sur le réseau local…).
 */
export const copyText = (text: string) =>
  navigator.clipboard
    ? navigator.clipboard.writeText(text)
    : Promise.reject(new Error('Pas de presse-papiers hors https'))
