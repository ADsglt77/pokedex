/**
 * Ce que nomment les mentions légales (`LegalPage`) : le site, son hébergeur et l'adresse de
 * contact. Le serveur est un VPS d'OVHcloud à Beauharnois, au Canada : hors de l'Union
 * européenne, ce que la page dit aussi.
 */
export const LEGAL: {
  /** Le nom du site et son adresse. */
  site: { name: string; domain: string }
  /**
   * L'hébergeur du VPS : les coordonnées publiques exigées dans les mentions légales ; où est le
   * serveur (`location`).
   */
  host: { name: string; address: string; phone: string; location: string }
  /** L'adresse de contact, publique, pour toute question, et les demandes sur les données. */
  contact: string
} = {
  site: { name: 'PokéCodex', domain: 'pokecodex.fr' },
  host: {
    name: 'OVH SAS',
    address: '2 rue Kellermann, 59100 Roubaix, France',
    phone: '1007 (depuis la France) ou +33 9 72 10 10 07',
    location: 'Beauharnois, au Québec (Canada)',
  },
  contact: 'contact@pokecodex.fr',
}
