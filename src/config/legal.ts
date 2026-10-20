export const LEGAL: {
  /** L'hébergeur du VPS : les coordonnées publiques exigées dans les mentions légales. */
  host: { name: string; address: string; phone: string }
  /** L'adresse de contact, publique, pour toute question, et les demandes sur les données. */
  contact: string
} = {
  host: {
    name: 'OVH SAS',
    address: '2 rue Kellermann, 59100 Roubaix, France',
    phone: '1007 (depuis la France) ou +33 9 72 10 10 07',
  },
  contact: 'contact@pokecodex.fr',
}
