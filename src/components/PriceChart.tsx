import { formatDate, formatEuro, formatShortDate } from '@/lib/format'
import type { PricePoint } from '@/lib/prices'
import styles from './PriceChart.module.css'

// Repère du tracé : étiré à la largeur du conteneur, le trait garde son épaisseur.
const WIDTH = 100
const HEIGHT = 40
const MARGIN = 3

/**
 * Une courbe de prix dans le temps, sans bibliothèque : ligne, aire, extrêmes et dates. Le
 * résumé lu par les lecteurs d'écran donne le début, la fin et les extrêmes.
 */
export function PriceChart({ points, label }: { points: PricePoint[]; label: string }) {
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last || points.length < 2) {
    return (
      <p className={styles.waiting}>
        {first
          ? `Historique depuis le ${formatDate(first.date)} : la courbe se dessine au fil des jours.`
          : 'Pas encore d’historique de prix.'}
      </p>
    )
  }

  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const start = Date.parse(first.date)
  const span = Date.parse(last.date) - start || 1
  const x = (date: string) => ((Date.parse(date) - start) / span) * WIDTH
  const y = (value: number) =>
    HEIGHT - MARGIN - ((value - min) / (max - min || 1)) * (HEIGHT - 2 * MARGIN)

  const line = points
    .map((point, index) => `${index ? 'L' : 'M'}${x(point.date)},${y(point.value)}`)
    .join(' ')
  const summary = `${label} : ${formatEuro(first.value)} le ${formatDate(first.date)}, ${formatEuro(last.value)} le ${formatDate(last.date)} ; au plus bas ${formatEuro(min)}, au plus haut ${formatEuro(max)}.`

  return (
    <figure className={styles.chart}>
      <div className={styles.plot}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={summary}
        >
          <path className={styles.area} d={`${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`} />
          <path className={styles.line} d={line} />
        </svg>
        <span className={styles.max} aria-hidden="true">
          {formatEuro(max)}
        </span>
        <span className={styles.min} aria-hidden="true">
          {formatEuro(min)}
        </span>
      </div>
      <figcaption className={styles.axis} aria-hidden="true">
        <span>{formatShortDate(first.date)}</span>
        <span>{formatShortDate(last.date)}</span>
      </figcaption>
    </figure>
  )
}
