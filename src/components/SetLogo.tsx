import { useState } from 'react'
import type { CatalogSet } from '@/lib/card-catalog'
import { setLogo } from '@/lib/card-images'
import { cx } from '@/lib/cx'
import styles from './SetLogo.module.css'

/**
 * Le logo d'une extension, dans une boîte de taille fixe ; son id si elle n'en a pas (`logo` vide :
 * seules certaines extensions françaises en ont), ou s'il ne se charge pas (une collection
 * d'extension, qui ne garde pas sa clé, le demande d'après son id : `setLogoKey`). Décoratif : le
 * nom de l'extension est écrit à côté. Le Catalogue, sa fenêtre des extensions, les Collections.
 */
export function SetLogo({
  set,
  className,
}: {
  set: Pick<CatalogSet, 'id' | 'logo'>
  className?: string
}) {
  const src = set.logo ? setLogo(set.logo) : null
  // Retenu par adresse : la même boîte peut montrer une autre extension.
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span className={cx(styles.logo, className)} aria-hidden="true">
      {src && failed !== src ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
      ) : (
        <span className={styles.code}>{set.id}</span>
      )}
    </span>
  )
}
