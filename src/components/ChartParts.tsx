import { SegmentedControl } from '@camply/ui'
import { CHART_PERIOD_LABELS, type ChartPeriod, type ChartStat } from '@/lib/chart'
import { toOptions } from '@/lib/format'
import styles from './ChartParts.module.css'

const PERIOD_OPTIONS = toOptions(CHART_PERIOD_LABELS)

/** La période des courbes : 7 jours, 30 jours, 1 an, tout. */
export function ChartPeriodControl({
  value,
  onChange,
}: {
  value: ChartPeriod
  onChange: (period: ChartPeriod) => void
}) {
  return (
    <SegmentedControl
      aria-label="Période des courbes"
      size="sm"
      options={PERIOD_OPTIONS}
      value={value}
      onChange={onChange}
    />
  )
}

/** Les chiffres d'une courbe sur sa période, sous elle. */
export function ChartStats({ items }: { items: ChartStat[] }) {
  if (items.length === 0) return null
  return (
    <dl className={styles.stats}>
      {items.map(({ label, value }) => (
        <div key={label} className={styles.stat}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
