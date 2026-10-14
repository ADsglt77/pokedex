import { Progress } from '@camply/ui'
import { BUDGET_LEVELS } from '@/config/shopping'
import { budgetLevel } from '@/lib/budget'
import { formatEuro } from '@/lib/format'
import type { BudgetSettings } from '@/types'
import styles from './BudgetMeter.module.css'

/** Ce qu'un mois a coûté face à son budget et à son plafond : une réglette, colorée au-delà. */
export function BudgetMeter({ spent, budget }: { spent: number; budget: BudgetSettings }) {
  const level = budgetLevel(spent, budget)
  return (
    <span className={styles.meter}>
      <span>
        sur {formatEuro(budget.monthly)} · plafond {formatEuro(budget.ceiling)}
      </span>
      <Progress
        value={Math.min(spent, budget.ceiling)}
        max={budget.ceiling}
        tone={level ? BUDGET_LEVELS[level].tone : 'accent'}
        size="sm"
        aria-label="Part du plafond du mois dépensée"
      />
    </span>
  )
}
