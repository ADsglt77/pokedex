import { EuroInput } from '@/components/CommitInput'
import { useCollectionAction } from '@/hooks/useNotify'
import { formatEuro } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import type { PokemonCard } from '@/types'

/** Le prix payé d'une carte possédée ou commandée, enregistré en quittant le champ (ou Entrée). */
export function PaidPriceField({
  card,
  paid,
  className,
}: {
  card: PokemonCard
  paid: number | null
  className?: string
}) {
  const act = useCollectionAction()

  return (
    <EuroInput
      className={className}
      label="Prix payé"
      hint="Pour suivre ce que la carte vous a coûté, et ce qu’elle vaut depuis."
      value={paid ?? undefined}
      onCommit={(amount) =>
        act(
          () => useCollectionStore.getState().setPaidPrice(card, amount),
          amount === undefined
            ? `Prix payé retiré de la carte ${card.reference}.`
            : `Carte ${card.reference} payée ${formatEuro(amount)}.`,
          amount === undefined ? 'info' : 'success',
        )
      }
    />
  )
}
