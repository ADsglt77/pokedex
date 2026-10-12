import { EuroInput } from '@/components/CommitInput'
import { useCollectionAction } from '@/hooks/useNotify'
import { formatEuro } from '@/lib/format'
import { useShoppingStore } from '@/store/shopping'
import type { BudgetSettings } from '@/types'

const FIELDS: Record<keyof BudgetSettings, { label: string; hint: string }> = {
  monthly: { label: 'Budget du mois', hint: 'Ce que vous dépensez d’habitude.' },
  ceiling: { label: 'Plafond du mois', hint: 'Au-delà, une confirmation est demandée.' },
  shippingReserve: {
    label: 'Réserve pour le port',
    hint: 'Gardée sur le budget de la prochaine commande.',
  },
}

/** Un réglage du budget, enregistré en quittant le champ, avec « Annuler » ; vide vaut 0. */
export function BudgetField({ field }: { field: keyof BudgetSettings }) {
  const act = useCollectionAction()
  const value = useShoppingStore((state) => state.shopping.budget[field])
  const { label, hint } = FIELDS[field]

  return (
    <EuroInput
      label={label}
      hint={hint}
      value={value}
      onCommit={(amount) =>
        act(
          () => useShoppingStore.getState().setBudget({ [field]: amount ?? 0 }),
          `${label} : ${formatEuro(amount ?? 0)}.`,
        )
      }
    />
  )
}
