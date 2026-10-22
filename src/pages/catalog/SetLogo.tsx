import { useState } from 'react'
import type { CatalogSet } from '@/lib/card-catalog'
import { setLogo } from '@/lib/card-images'
import { cx } from '@/lib/cx'
import styles from './SetLogo.module.css'

/**
 * Le logo d'une série, dans une boîte de taille fixe ; son code si Pokécardex n'en a pas,
 * ou s'il ne se charge pas. Décoratif : le nom de la série est écrit à côté.
 */
export function SetLogo({
  set,
  size,
  className,
}: {
  set: CatalogSet
  size: 'md' | 'hd'
  className?: string
}) {
  const src = setLogo(set.language, set.id, size)
  // Retenu par adresse : la même boîte peut montrer une autre série.
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
