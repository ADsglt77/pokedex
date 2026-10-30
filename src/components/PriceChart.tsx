import type { ChartWindow } from '@/lib/chart'
import { formatDate, formatEuro, formatShortDate } from '@/lib/format'
import type { PricePoint } from '@/lib/chart'
import styles from './PriceChart.module.css'

// Repère du tracé : étiré à la largeur du conteneur, le trait garde son épaisseur.
const WIDTH = 100
const HEIGHT = 40
const MARGIN = 3

/**
 * Une courbe dans le temps, sans bibliothèque : ligne, aire, extrêmes et dates. L'axe couvre la
 * période (`window`), même si les points n'en couvrent qu'une partie (une carte suivie depuis
 * peu). Le résumé lu par les lecteurs d'écran donne le début, la fin et les extrêmes. `format` :
 * des euros, sinon autre chose (un nombre de Pokémon).
 * `fromZero` : l'axe part de zéro (un total, qui ne se lit qu'à partir de rien) ; sinon du plus
 * bas de la série (un prix, dont on suit les écarts).
 */
export function PriceChart({
  points,
  label,
  window,
  format = formatEuro,
  fromZero = false,
}: {
  points: PricePoint[]
  label: string
  window: ChartWindow
  format?: (value: number) => string
  fromZero?: boolean
}) {
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last || points.length < 2) {
    return (
      <p className={styles.waiting}>
        {first
          ? `Un seul jour sur la période, le ${formatDate(first.date)} : la courbe se dessine au fil des jours.`
          : 'Pas encore de données sur cette période.'}
      </p>
    )
  }

  const { from, to } = window
  const values = points.map((point) => point.value)
  const low = Math.min(...values)
  const max = Math.max(...values)
  // Les bornes de l'axe, étiquetées : zéro pour un total.
  const min = fromZero ? Math.min(low, 0) : low
  const start = Date.parse(from)
  const span = Date.parse(to) - start
  const x = (date: string) => ((Date.parse(date) - start) / span) * WIDTH
  // Une série plate passe au milieu : en bas, elle se lirait comme zéro.
  const y = (value: number) =>
    max === min
      ? HEIGHT / 2
      : HEIGHT - MARGIN - ((value - min) / (max - min)) * (HEIGHT - 2 * MARGIN)

  const line = points
    .map((point, index) => `${index ? 'L' : 'M'}${x(point.date)},${y(point.value)}`)
    .join(' ')
  // Sur plusieurs années, les dates de l'axe disent l'année.
  const withYear = from.slice(0, 4) !== to.slice(0, 4)
  const summary = `${label} : ${format(first.value)} le ${formatDate(first.date)}, ${format(last.value)} le ${formatDate(last.date)} ; au plus bas ${format(low)}, au plus haut ${format(max)}.`

  return (
    <figure className={styles.chart}>
      <div className={styles.plot}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={summary}
        >
          <path
            className={styles.area}
            d={`${line} L${x(last.date)},${HEIGHT} L${x(first.date)},${HEIGHT} Z`}
          />
          <path className={styles.line} d={line} />
        </svg>
        <span className={styles.max} aria-hidden="true">
          {format(max)}
        </span>
        {/* Une série plate n'a qu'une valeur à étiqueter. */}
        {min !== max && (
          <span className={styles.min} aria-hidden="true">
            {format(min)}
          </span>
        )}
      </div>
      <figcaption className={styles.axis} aria-hidden="true">
        <span>{formatShortDate(from, withYear)}</span>
        <span>{formatShortDate(to, withYear)}</span>
      </figcaption>
    </figure>
  )
}
