import { ExternalLink } from '@/components/ExternalLink'
import { CARD_INDEX_INFO } from '@/lib/catalog'
import { formatDate, formatInteger } from '@/lib/format'
import { DataSection } from './DataSection'

/** D'où viennent les données, et de quand date l'index des cartes. */
export function ReferenceSection() {
  return (
    <DataSection id="reference" title="Données de référence">
      <p>
        Les espèces viennent de <ExternalLink href="https://pokeapi.co/">PokéAPI</ExternalLink>, les
        cartes japonaises de <ExternalLink href="https://tcgdex.dev/">TCGdex</ExternalLink> ; les
        images que TCGdex n’a pas viennent du catalogue{' '}
        <ExternalLink href="https://www.tcgplayer.com/">TCGplayer</ExternalLink>. Les prix sont ceux
        du guide quotidien de{' '}
        <ExternalLink href="https://www.cardmarket.com/">Cardmarket</ExternalLink>, relu chaque jour
        par le serveur, qui en garde l’historique.
      </p>
      <p>
        L’app embarque un index de {formatInteger(CARD_INDEX_INFO.cardCount)} cartes, construit le{' '}
        {formatDate(CARD_INDEX_INFO.generatedAt)} : le Pokédex s’affiche sans connexion. Les cartes
        sorties depuis y entrent en relançant <code>bun run data</code>.
      </p>
    </DataSection>
  )
}
