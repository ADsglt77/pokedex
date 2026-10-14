import { ExternalLink as ExternalIcon } from '@camply/ui/icons'
import { ExternalLink } from '@/components/ExternalLink'
import { cardmarketPage } from '@/lib/cardmarket'
import { cx } from '@/lib/cx'
import type { PokemonCard } from '@/types'
import styles from './CardmarketLink.module.css'

/**
 * « Voir sur Cardmarket » : la page de la carte (celle notée, sinon celle de son id), dans un nouvel
 * onglet ; rien sans l'une ni l'autre.
 */
export function CardmarketLink({
  card,
  className,
}: {
  card: Pick<PokemonCard, 'page' | 'cardmarket'>
  className?: string
}) {
  const page = cardmarketPage(card)
  if (!page) return null
  return (
    <ExternalLink href={page} className={cx(styles.link, className)}>
      Voir sur Cardmarket <ExternalIcon size={13} aria-hidden="true" />
    </ExternalLink>
  )
}
