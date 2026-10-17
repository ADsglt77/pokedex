import { Badge, Progress } from '@camply/ui'
import { BUDGET_LEVELS } from '@/config/shopping'
import { budgetLevel } from '@/lib/budget'
import { formatEuro } from '@/lib/format'
import type { BudgetSettings } from '@/types'
import styles from './BudgetMeter.module.css'

/**
 * Ce qu'un mois a coûté face à son budget et à son plafond : une réglette, colorée au-delà. Dans le
 * budget, `info` : l'accent (rouge en clair, jaune en sombre) se confondrait avec les dépassements.
 */
export function BudgetMeter({ spent, budget }: { spent: number; budget: BudgetSettings }) {
  const level = budgetLevel(spent, budget)
  return (
    <span className={styles.meter}>
      <span>
        sur {formatEuro(budget.monthly)} · plafond {formatEuro(budget.ceiling)}
      </span>
      <Progress
        value={spent}
        max={budget.ceiling}
        tone={level ? BUDGET_LEVELS[level].tone : 'info'}
        size="sm"
        aria-label="Part du plafond du mois dépensée"
      />
    </span>
  )
}

/** Le badge d'un mois au-delà de son budget ou de son plafond ; rien dans le budget. */
export function BudgetLevelBadge({ spent, budget }: { spent: number; budget: BudgetSettings }) {
  const level = budgetLevel(spent, budget)
  return (
    level && (
      <Badge size="sm" tone={BUDGET_LEVELS[level].tone}>
        {BUDGET_LEVELS[level].label}
      </Badge>
    )
  )
}
