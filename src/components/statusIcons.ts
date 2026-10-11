import { Check, Heart, Package } from '@camply/ui/icons'
import type { CardStatus } from '@/types'

/** L'icône de chaque statut : la couleur n'est jamais seule à porter l'information. */
export const STATUS_ICONS: Record<CardStatus, typeof Check> = {
  owned: Check,
  ordered: Package,
  wanted: Heart,
}
