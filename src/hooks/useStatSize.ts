import { useMediaQuery } from '@/hooks/useMediaQuery'

/**
 * La taille des statistiques d'une grille (`stat-grid`) : compactes sur téléphone (`Stat`
 * `size="sm"` de camply : marges et valeur réduites, sans icône), pour que le contenu de la page
 * arrive vite.
 */
export const useStatSize = () => (useMediaQuery('(max-width: 40rem)') ? 'sm' : 'md')
