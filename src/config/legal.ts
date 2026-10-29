/**
 * Ce que nomment les mentions légales (`LegalPage`) : le site, son hébergeur et l'adresse de
 * contact. Le site tourne sur le réseau de Cloudflare (société américaine) ; sa base, les comptes
 * et les collections, est gardée dans l'Union européenne (la base D1 créée avec
 * `--jurisdiction eu` : `docs/deploiement.md`), ce que la page dit aussi.
 */
export const LEGAL: {
  /** Le nom du site et son adresse. */
  site: { name: string; domain: string }
  /**
   * L'hébergeur : les coordonnées publiques exigées dans les mentions légales ; où sont gardés les
   * comptes et les collections (`storage`).
   */
  host: { name: string; address: string; phone: string; storage: string }
  /** L'adresse de contact, publique, pour toute question, et les demandes sur les données. */
  contact: string
} = {
  site: { name: 'PokéCodex', domain: 'pokecodex.fr' },
  host: {
    name: 'Cloudflare, Inc.',
    address: '101 Townsend St., San Francisco, CA 94107, États-Unis',
    phone: '+1 650 319 8930',
    storage: 'dans l’Union européenne',
  },
  contact: 'contact@pokecodex.fr',
}
