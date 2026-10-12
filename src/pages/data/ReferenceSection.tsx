import { ExternalLink } from '@/components/ExternalLink'
import { CARD_INDEX_INFO } from '@/lib/catalog'
import { formatDate, formatInteger } from '@/lib/format'
import { DataSection } from './DataSection'

/** D'où viennent les données, et de quand date l'index des cartes. */
export function ReferenceSection() {
  return (
    <DataSection id="reference" title="Données de référence">
      <p>
        Les espèces viennent de <ExternalLink href="https://pokeapi.co/">PokéAPI</ExternalLink>. Les
        cartes japonaises et leur rareté viennent du catalogue{' '}
        <ExternalLink href="https://www.tcgplayer.com/">TCGplayer</ExternalLink> (extensions, decks,
        coffrets et promos) : une pleine carte s’y reconnaît à sa rareté, à son type (GX, V, VMAX,
        VSTAR) ou, faute de mieux, à son image, avec quelques corrections faites à la main ;{' '}
        <ExternalLink href="https://tcgdex.dev/">TCGdex</ExternalLink> donne le nom japonais,
        l’illustrateur, l’image et le lien avec Cardmarket des cartes qu’il connaît (pour les autres
        : l’image de TCGplayer, sans prix). Les prix sont ceux du guide quotidien de{' '}
        <ExternalLink href="https://www.cardmarket.com/">Cardmarket</ExternalLink>, relu chaque jour
        par le serveur, qui en garde l’historique.
      </p>
      <p>
        L’app embarque un index de {formatInteger(CARD_INDEX_INFO.cardCount)} cartes, construit le{' '}
        {formatDate(CARD_INDEX_INFO.generatedAt)} : le Pokédex n’appelle aucune API, seules les
        images viennent d’Internet. Les cartes sorties depuis y entrent en relançant{' '}
        <code>bun run data:cards --refresh</code>.
      </p>
    </DataSection>
  )
}
