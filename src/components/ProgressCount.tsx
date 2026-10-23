import { formatInteger } from '@/lib/format'

/**
 * « 87 / 230 » : ce qui est obtenu sur tout, en chiffres alignés, nommé pour le lecteur d'écran
 * (`what` : « cartes possédées »). Les Collections, la ligne d'une collection (`SeriesLine`).
 */
export function ProgressCount({
  done,
  total,
  what,
}: {
  done: number
  total: number
  what: string
}) {
  return (
    <span className="numeric">
      {formatInteger(done)} / {formatInteger(total)}
      <span className="visually-hidden"> {what}</span>
    </span>
  )
}
