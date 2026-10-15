import { ExternalLink } from '@/components/ExternalLink'
import { imageSource } from '@/lib/card-images'
import type { CardImage } from '@/types'
import styles from './ImageCredit.module.css'

/**
 * « Image : Pokécardex » sous une carte, avec un lien (la condition de son autorisation), ou
 * « Image : TCGplayer » (une ancienne image) ; rien pour une adresse collée.
 */
export function ImageCredit({ image }: { image: CardImage | null }) {
  const source = image && imageSource(image)
  if (!source) return null
  return (
    <figcaption className={styles.credit}>
      Image : <ExternalLink href={source.href}>{source.name}</ExternalLink>
    </figcaption>
  )
}
