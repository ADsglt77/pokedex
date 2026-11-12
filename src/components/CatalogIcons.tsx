import { useState } from 'react'
import { CARD_TYPES, DARK_RARITY_ICONS } from '@/config/catalog'
import type { Rarity } from '@/lib/card-catalog'
import { rarityIcon, typeIcon } from '@/lib/card-images'
import { cx } from '@/lib/cx'
import styles from './CatalogIcons.module.css'

/**
 * L'icône de la rareté d'une carte (« SAR », ●…), copiée de Pokécardex ; son nom en texte s'il n'a
 * pas d'icône pour elle. Son nom est aussi son texte de remplacement et sa bulle ; `decorative` :
 * ni l'un ni l'autre, quand le nom est déjà écrit à côté (la fiche d'une carte : sinon lu deux
 * fois), et rien sans icône. L'échec est retenu pour cette icône seulement : la même place peut
 * ensuite montrer une autre rareté (la carte suivante de la fiche), dont l'icône est essayée.
 */
export function RarityIcon({
  rarity,
  decorative = false,
  className,
}: {
  rarity: Rarity
  decorative?: boolean
  className?: string
}) {
  const src = rarityIcon(rarity.id)
  const [missing, setMissing] = useState<string | null>(null)
  if (missing === src) {
    return decorative ? null : <span className={cx(styles.name, className)}>{rarity.name}</span>
  }
  return (
    <img
      src={src}
      alt={decorative ? '' : rarity.name}
      title={decorative ? undefined : rarity.name}
      loading="lazy"
      className={cx(styles.rarity, DARK_RARITY_ICONS.has(rarity.id) && styles.dark, className)}
      onError={() => setMissing(src)}
    />
  )
}

/**
 * L'icône d'un type de carte (`CARD_TYPES`), copiée de Pokécardex ; son nom en remplacement, sauf
 * `decorative` (le nom écrit à côté).
 */
export function TypeIcon({ type, decorative = false }: { type: number; decorative?: boolean }) {
  return (
    <img
      src={typeIcon(type)}
      alt={decorative ? '' : CARD_TYPES.get(type)}
      loading="lazy"
      className={styles.type}
    />
  )
}
