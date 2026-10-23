import { SegmentedControl } from '@camply/ui'
import type { ReactNode } from 'react'
import type { CardLanguage } from '@/types'
import styles from './LanguageSwitch.module.css'

/**
 * Un drapeau de proportions 3:2, dessiné en SVG (Windows n'affiche pas les drapeaux emoji) aux
 * couleurs du thème (`--flag-*`) ; `label` le nomme, pour le lecteur d'écran comme pour le survol.
 */
function Flag({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      className={styles.flag}
      viewBox="0 0 30 20"
      role="img"
      aria-label={label}
      focusable="false"
    >
      {children}
      <rect className={styles.edge} x="0.5" y="0.5" width="29" height="19" />
    </svg>
  )
}

/**
 * Un segment qui montre un drapeau. `SegmentOption.label` est typé `string` dans camply, qui
 * pourtant écrit le segment tel quel (`{label}`) : un nœud y tient, et nomme le segment par son
 * contenu. À retirer quand camply type `label` en `ReactNode`.
 */
const segment = (value: CardLanguage, flag: ReactNode) => ({
  value,
  label: flag as unknown as string,
})

const OPTIONS = [
  segment(
    'ja',
    <Flag label="Cartes japonaises">
      <rect className={styles.white} width="30" height="20" />
      <circle className={styles.sun} cx="15" cy="10" r="6" />
    </Flag>,
  ),
  segment(
    'fr',
    <Flag label="Cartes françaises">
      <rect className={styles.blue} width="10" height="20" />
      <rect className={styles.white} x="10" width="10" height="20" />
      <rect className={styles.red} x="20" width="10" height="20" />
    </Flag>,
  ),
]

/**
 * L'interrupteur de la langue des cartes, 🇯🇵 / 🇫🇷 (le Catalogue). Un `SegmentedControl` (un groupe
 * de boutons radio : les flèches changent de segment, un seul est dans l'ordre de tabulation) dont
 * chaque segment est un drapeau, nommé « Cartes japonaises » / « Cartes françaises ».
 */
export function LanguageSwitch({
  value,
  onChange,
}: {
  value: CardLanguage
  onChange: (lang: CardLanguage) => void
}) {
  return (
    <SegmentedControl
      aria-label="Langue des cartes"
      className={styles.switch}
      options={OPTIONS}
      value={value}
      onChange={onChange}
    />
  )
}
