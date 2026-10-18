import { useState } from 'react'
import { CARD_TYPES, DARK_RARITY_ICONS } from '@/config/catalog'
import type { Rarity } from '@/lib/card-catalog'
import { rarityIcon, typeIcon } from '@/lib/card-images'
import { cx } from '@/lib/cx'
import styles from './CatalogIcons.module.css'

/**
 * L'icône de la rareté d'une carte (« SAR », ●…), copiée de Pokécardex ; son nom en texte s'il n'a
 * pas d'icône pour elle. Son nom est aussi son texte de remplacement et sa bulle.
 */
export function RarityIcon({ rarity, className }: { rarity: Rarity; className?: string }) {
  const [missing, setMissing] = useState(false)
  if (missing) return <span className={cx(styles.name, className)}>{rarity.name}</span>
  return (
    <img
      src={rarityIcon(rarity.id)}
      alt={rarity.name}
      title={rarity.name}
      loading="lazy"
      className={cx(styles.rarity, DARK_RARITY_ICONS.has(rarity.id) && styles.dark, className)}
      onError={() => setMissing(true)}
    />
  )
}

/** L'icône d'un type de carte (`CARD_TYPES`), copiée de Pokécardex ; son nom en remplacement. */
export function TypeIcon({ type }: { type: number }) {
  return (
    <img src={typeIcon(type)} alt={CARD_TYPES.get(type)} loading="lazy" className={styles.type} />
  )
}
