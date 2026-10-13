import { ExternalLink } from '@/components/ExternalLink'
import { imageSource } from '@/lib/card-images'
import type { CardImage } from '@/types'

/**
 * « Image : Pokécardex » sous une carte, avec un lien (la condition de son autorisation), ou
 * « Image : TCGplayer » ; rien pour une adresse collée.
 */
export function ImageCredit({ image, className }: { image: CardImage | null; className?: string }) {
  const source = image && imageSource(image)
  if (!source) return null
  return (
    <figcaption className={className}>
      Image : <ExternalLink href={source.href}>{source.name}</ExternalLink>
    </figcaption>
  )
}
