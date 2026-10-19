import { Combobox, IconButton, Input, Stack } from '@camply/ui'
import { X } from '@camply/ui/icons'
import { useMemo, useRef } from 'react'
import { EuroField } from '@/components/EuroInput'
import { keepFocusInList } from '@/lib/focus'
import { euroInput, formatEuro } from '@/lib/format'
import { duplicateReason, unitCosts } from '@/lib/orders'
import { marketPrice } from '@/lib/prices'
import { findCard } from '@/lib/collection'
import { cardTitle } from '@/lib/species'
import { useCollectionStore } from '@/store/collection'
import { usePrices } from '@/store/prices'
import type { Order } from '@/types'
import { CardLine } from './CardLine'
import page from './ShoppingPage.module.css'
import styles from './OrderLines.module.css'

/** Les cartes rangées comme on les lit (« Évoli » avec les E). */
const collator = new Intl.Collator('fr')

/** Une ligne telle que saisie : la quantité et le prix en texte, lus à l'enregistrement. */
export interface DraftLine {
  cardId: string
  quantity: string
  unitPrice: string
}

/**
 * Les cartes d'une commande (`OrderForm`) : une ligne par carte, sa quantité, son prix, ce qu'elle
 * revient ou le doublon d'une autre commande ; puis l'ajout d'une carte du Pokédex, au prix du
 * marché.
 */
export function OrderLines({
  lines,
  order,
  others,
  errors,
  readErrors,
  onChange,
}: {
  lines: DraftLine[]
  /** La commande lue du brouillon : ses lignes et ce que chacune revient. */
  order: Order
  /** Les autres commandes, où une carte peut déjà être. */
  others: Order[]
  /** Les erreurs affichées, après une première tentative. */
  errors: Record<string, string>
  /** Toutes les erreurs de lecture : une ligne illisible ne dit pas ce qu'elle revient. */
  readErrors: Record<string, string>
  onChange: (lines: DraftLine[]) => void
}) {
  const collection = useCollectionStore((state) => state.collection)
  const prices = usePrices()
  const list = useRef<HTMLUListElement>(null)
  const cardsTitle = useRef<HTMLHeadingElement>(null)
  const costs = unitCosts(order)
  // Les cartes du Pokédex qui ne sont pas déjà dans la commande, triées une fois par collection et
  // par liste (pas à chaque frappe dans un montant).
  const addable = useMemo(() => {
    const inLines = new Set(lines.map((line) => line.cardId))
    return Object.values(collection.customCards)
      .filter((card) => !inLines.has(card.id))
      .map((card) => ({ value: card.id, label: `${cardTitle(card)} · ${card.reference}` }))
      .sort((a, b) => collator.compare(a.label, b.label))
  }, [collection, lines])

  const addLine = (cardId: string) => {
    const card = findCard(cardId, collection)!
    const price = marketPrice(prices, card)
    onChange([
      ...lines,
      { cardId, quantity: '1', unitPrice: price === null ? '' : euroInput(price) },
    ])
  }
  const setLine = (index: number, change: Partial<DraftLine>) =>
    onChange(lines.map((line, i) => (i === index ? { ...line, ...change } : line)))

  return (
    <Stack gap={3}>
      <h3 ref={cardsTitle} tabIndex={-1} className={page.formTitle}>
        Cartes
      </h3>
      {lines.length > 0 && (
        <ul ref={list} className={page.lines}>
          {lines.map((line, index) => {
            const card = findCard(line.cardId, collection)
            const duplicate = duplicateReason(order.lines[index]!, others)
            const unreadable =
              readErrors[`quantity-${line.cardId}`] || readErrors[`price-${line.cardId}`]
            // Le focus va à la ligne suivante, au titre « Cartes » s'il n'en reste aucune.
            const remove = () =>
              keepFocusInList(
                list,
                index,
                () => onChange(lines.filter((_, i) => i !== index)),
                cardsTitle,
              )
            return (
              <li key={line.cardId}>
                <CardLine
                  card={card}
                  detail={
                    card &&
                    (duplicate ? (
                      <span className={styles.warn}>{duplicate}</span>
                    ) : (
                      !unreadable && `revient à ${formatEuro(costs[index]!)}`
                    ))
                  }
                >
                  {card && (
                    <>
                      <Input
                        className={styles.quantity}
                        size="sm"
                        aria-label={`Quantité, ${card.reference}`}
                        inputMode="numeric"
                        value={line.quantity}
                        error={errors[`quantity-${line.cardId}`]}
                        onChange={(event) => setLine(index, { quantity: event.target.value })}
                      />
                      <EuroField
                        className={styles.price}
                        size="sm"
                        aria-label={`Prix d’une carte, ${card.reference}`}
                        value={line.unitPrice}
                        error={errors[`price-${line.cardId}`]}
                        onChange={(event) => setLine(index, { unitPrice: event.target.value })}
                      />
                    </>
                  )}
                  <IconButton
                    label={`Retirer ${card ? card.reference : 'cette carte'} de la commande`}
                    size="sm"
                    variant="ghost"
                    onClick={remove}
                  >
                    <X size={15} />
                  </IconButton>
                </CardLine>
              </li>
            )
          })}
        </ul>
      )}
      <Combobox
        label="Ajouter une carte"
        hint="Une carte de votre Pokédex. Pour une autre, ajoutez-la d’abord sur la fiche de son Pokémon."
        placeholder="Nom ou référence…"
        emptyMessage="Aucune carte trouvée."
        options={addable}
        error={errors.lines}
        // Toujours vide : la carte choisie part dans les lignes, la case repart à zéro.
        value=""
        onChange={addLine}
      />
    </Stack>
  )
}
