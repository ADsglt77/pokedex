import { Input } from '@camply/ui'
import { useState } from 'react'
import { useCollectionAction } from '@/hooks/useNotify'
import { euroInput, formatEuro, parseEuros } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import type { PokemonCard } from '@/types'

/** Le prix payé d'une carte possédée ou commandée, enregistré en quittant le champ (ou Entrée). */
export function PaidPriceField({ card, className }: { card: PokemonCard; className?: string }) {
  const paid = useCollectionStore((state) => state.collection.cards[card.id]?.paidPrice)
  // Une clé par valeur enregistrée : le champ repart d'elle après une annulation ou un autre onglet.
  return <Field key={paid ?? ''} card={card} paid={paid} className={className} />
}

function Field({
  card,
  paid,
  className,
}: {
  card: PokemonCard
  paid?: number
  className?: string
}) {
  const act = useCollectionAction()
  const [draft, setDraft] = useState(paid === undefined ? '' : euroInput(paid))
  const [error, setError] = useState<string>()

  const save = () => {
    const amount = draft.trim() === '' ? undefined : parseEuros(draft)
    if (amount === null) return setError('Indiquez un montant en euros, par exemple 12,50.')
    setError(undefined)
    act(
      () => useCollectionStore.getState().setPaidPrice(card, amount),
      amount === undefined
        ? `Prix payé retiré de la carte ${card.reference}.`
        : `Carte ${card.reference} payée ${formatEuro(amount)}.`,
      amount === undefined ? 'info' : 'success',
    )
  }

  return (
    <Input
      className={className}
      label="Prix payé"
      hint="Pour suivre ce que la carte vous a coûté, et ce qu’elle vaut depuis."
      inputMode="decimal"
      autoComplete="off"
      placeholder="0,00"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => event.key === 'Enter' && save()}
      rightIcon={<span aria-hidden="true">€</span>}
      error={error}
    />
  )
}
