import { useState } from 'react'
import type { CatalogSet } from '@/lib/card-catalog'
import { setLogo } from '@/lib/card-images'
import { cx } from '@/lib/cx'
import styles from './SetLogo.module.css'

/**
 * Le logo d'une extension, dans une boîte de taille fixe ; son code si Pokécardex n'en a pas
 * (`logo` faux), ou s'il ne se charge pas (une collection d'extension, qui ne sait pas s'il y en a
 * un, le demande). Décoratif : le nom de l'extension est écrit à côté. Le Catalogue, sa fenêtre
 * des extensions, les Collections.
 */
export function SetLogo({
  set,
  size,
  className,
}: {
  set: Pick<CatalogSet, 'language' | 'id' | 'logo'>
  size: 'md' | 'hd'
  className?: string
}) {
  const src = setLogo(set.language, set.id, size)
  // Retenu par adresse : la même boîte peut montrer une autre extension.
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span className={cx(styles.logo, className)} aria-hidden="true">
      {set.logo && failed !== src ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
      ) : (
        <span className={styles.code}>{set.id}</span>
      )}
    </span>
  )
}
