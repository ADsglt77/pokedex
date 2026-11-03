/**
 * Le réglage « moins de mouvement » du système, que suivent les mouvements de l'app écrits en
 * JavaScript : le défilement vers un champ en erreur (`focus.ts`) et l'inclinaison d'une carte
 * (`CardStage`). Lu au moment voulu (`matches`), il suit le réglage. Touche au navigateur : ni le
 * Worker ni les tests ne l'importent.
 */
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
