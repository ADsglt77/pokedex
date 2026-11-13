import { usePhone } from '@/hooks/useMediaQuery'

/**
 * La taille des statistiques en tuile (la grille de l'Accueil, `stat-grid`) ou dans un panneau
 * (la page d'une collection d'extension) : compactes sur téléphone (`Stat` `size="sm"` de camply :
 * marges et valeur réduites, sans icône), pour que le contenu de la page arrive vite.
 */
export const useStatSize = () => (usePhone() ? 'sm' : 'md')

/**
 * Une statistique d'une ligne de résumé (`stat-line`, toute page autre que l'Accueil, décision
 * D-07) : à plat et compacte, sans cadre ni icône ; les tuiles restent au tableau de bord.
 */
export const SUMMARY_STAT = { variant: 'plain', size: 'sm' } as const
