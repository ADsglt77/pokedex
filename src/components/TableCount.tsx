import { formatInteger } from '@/lib/format'

/**
 * Un nombre dans un tableau de données : l'en-tête de sa colonne le nomme ; devenu une liste de
 * fiches sur téléphone (`.stack-table`), le tableau n'a plus d'en-tête, et le nombre dit ce qu'il
 * compte (« 4 cartes »).
 */
export function TableCount({ count, one, many }: { count: number; one: string; many: string }) {
  return (
    <>
      {formatInteger(count)}
      <span className="stack-label"> {count > 1 ? many : one}</span>
    </>
  )
}
