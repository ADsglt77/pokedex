import { Input } from '@camply/ui'
import { useState } from 'react'
import { useCollectionAction } from '@/hooks/useNotify'
import { euroInput, formatEuro, parseEuros } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import type { PokemonCard } from '@/types'

/** Le prix payé d'une carte possédée ou commandée, enregistré en quittant le champ. */
export function PaidPriceField({ card }: { card: PokemonCard }) {
  const act = useCollectionAction()
  const paid = useCollectionStore((state) => state.collection.cards[card.id]?.paidPrice ?? null)
  const [draft, setDraft] = useState(paid === null ? '' : euroInput(paid))
  const [error, setError] = useState<string | null>(null)

  // Le prix a changé ailleurs (annulation, autre onglet) : le champ le suit.
  const [shown, setShown] = useState(paid)
  if (paid !== shown) {
    setShown(paid)
    setDraft(paid === null ? '' : euroInput(paid))
  }

  const commit = () => {
    const amount = parseEuros(draft)
    if (amount === undefined) {
      setError('Indiquez un montant en euros, par exemple 12,50.')
      return
    }
    setError(null)
    act(
      () => useCollectionStore.getState().setPaidPrice(card, amount),
      amount === null
        ? `Prix payé retiré de la carte ${card.reference}.`
        : `Carte ${card.reference} payée ${formatEuro(amount)}.`,
      amount === null ? 'info' : 'success',
    )
  }

  return (
    <Input
      label="Prix payé"
      hint="Pour suivre ce que la carte vous a coûté, et ce qu’elle vaut depuis."
      inputMode="decimal"
      autoComplete="off"
      placeholder="0,00"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === 'Enter' && commit()}
      rightIcon={<span aria-hidden="true">€</span>}
      error={error ?? undefined}
    />
  )
}
