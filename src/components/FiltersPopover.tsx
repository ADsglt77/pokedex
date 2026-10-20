import { Badge, Button, Popover, Stack, type ButtonSize } from '@camply/ui'
import { SlidersHorizontal } from '@camply/ui/icons'
import type { ReactNode } from 'react'
import styles from './FiltersPopover.module.css'

/**
 * Le bouton « Filtres » et son panneau (`children`, ses listes) : le nombre de filtres actifs
 * (`active`) sur le bouton. `label` : son nom pour un lecteur d'écran, ce nombre compris ;
 * `className` : celle du bouton (Pokédex, liste d'achats).
 */
export function FiltersPopover({
  label,
  active,
  size,
  className,
  children,
}: {
  label: string
  active: number
  size?: ButtonSize
  className?: string
  children: ReactNode
}) {
  return (
    <Popover
      placement="bottom-end"
      trigger={
        <Button
          variant="secondary"
          size={size}
          leftIcon={<SlidersHorizontal size={15} />}
          aria-label={label}
          className={className}
        >
          Filtres
          {active > 0 && (
            <Badge variant="solid" size="sm" className={styles.badge}>
              {active}
            </Badge>
          )}
        </Button>
      }
    >
      <Stack gap={3} className={styles.panel}>
        {children}
      </Stack>
    </Popover>
  )
}
