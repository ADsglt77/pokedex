import { SegmentedControl } from '@camply/ui'
import type { ReactNode } from 'react'
import type { CardLanguage } from '@/types'
import styles from './LanguageSwitch.module.css'

/** Le dessin du drapeau de chaque langue, sur 30 × 20. */
const FLAGS: Record<CardLanguage, ReactNode> = {
  ja: (
    <>
      <rect className={styles.white} width="30" height="20" />
      <circle className={styles.sun} cx="15" cy="10" r="6" />
    </>
  ),
  fr: (
    <>
      <rect className={styles.blue} width="10" height="20" />
      <rect className={styles.white} x="10" width="10" height="20" />
      <rect className={styles.red} x="20" width="10" height="20" />
    </>
  ),
}

/**
 * Le drapeau d'une langue, de proportions 3:2, dessiné en SVG (Windows n'affiche pas les drapeaux
 * emoji) aux couleurs du thème (`--flag-*`) ; `label` le nomme pour le lecteur d'écran (et donne
 * son nom au segment qui le contient).
 */
function Flag({
  language,
  label,
  className,
}: {
  language: CardLanguage
  label: string
  className?: string
}) {
  return (
    <svg className={className} viewBox="0 0 30 20" role="img" aria-label={label} focusable="false">
      {FLAGS[language]}
      <rect className={styles.edge} x="0.5" y="0.5" width="29" height="19" />
    </svg>
  )
}

/**
 * La langue d'une carte, à côté de sa référence : un petit drapeau, à la taille du texte, nommé
 * « Carte japonaise » ou « Carte française » (un même code d'extension existe dans les deux
 * langues : « SVP 001 »).
 */
export function LanguageFlag({ language }: { language: CardLanguage }) {
  return (
    <Flag
      language={language}
      label={language === 'fr' ? 'Carte française' : 'Carte japonaise'}
      className={styles.inline}
    />
  )
}

/**
 * Un segment qui montre un drapeau. `SegmentOption.label` est typé `string` dans camply, qui
 * pourtant écrit le segment tel quel (`{label}`) : un nœud y tient, et nomme le segment par son
 * contenu. À retirer quand camply type `label` en `ReactNode`.
 */
const segment = (value: CardLanguage, label: string) => ({
  value,
  label: (<Flag language={value} label={label} className={styles.flag} />) as unknown as string,
})

const OPTIONS = [segment('ja', 'Cartes japonaises'), segment('fr', 'Cartes françaises')]

/**
 * L'interrupteur de la langue des cartes, 🇯🇵 / 🇫🇷 (le Catalogue). Un `SegmentedControl` (un groupe
 * de boutons radio : les flèches changent de segment, un seul est dans l'ordre de tabulation) dont
 * chaque segment est un drapeau, nommé « Cartes japonaises » / « Cartes françaises ». camply appelle
 * `onChange` à chaque clic, même sur le segment déjà choisi : `onChange` n'est appelé ici que
 * pour une autre langue (re-choisir la langue montrée ne doit rien changer à la page).
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
      onChange={(next) => next !== value && onChange(next)}
    />
  )
}
