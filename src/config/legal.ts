/**
 * Ce que disent les mentions légales (`LegalPage`) et qui n'est pas dans le code : l'hébergeur du
 * site et l'adresse de contact. À remplir avant la mise en ligne (README, liste de mise en ligne) ;
 * `null` : la page dit « à compléter ».
 */
export const LEGAL: {
  /**
   * L'hébergeur du VPS, son nom et son adresse : un particulier qui ne publie pas son identité donne
   * les siens (il lui a donné la sienne).
   */
  host: { name: string; address: string } | null
  /** L'adresse de contact, publique, pour toute question, et les demandes sur les données. */
  contact: string | null
} = {
  host: null,
  contact: null,
}
