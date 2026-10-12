import {
  Alert,
  Button,
  Combobox,
  DescriptionList,
  IconButton,
  Input,
  Modal,
  Select,
  Stack,
  Textarea,
} from '@camply/ui'
import { X } from '@camply/ui/icons'
import { useState } from 'react'
import { EuroField } from '@/components/CommitInput'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SegmentedField } from '@/components/SegmentedField'
import { ORDER_STATE_LABELS, SUPPLIER_LABELS } from '@/config/shopping'
import { useCollectionAction } from '@/hooks/useNotify'
import { monthOf, spentIn } from '@/lib/budget'
import { cardTitle, findCard } from '@/lib/catalog'
import {
  euroInput,
  formatEuro,
  formatMonth,
  parseEuros,
  parseLink,
  plural,
  toOptions,
} from '@/lib/format'
import {
  cardCount,
  duplicateReason,
  linesTotal,
  orderSpent,
  previousOf,
  unitCosts,
} from '@/lib/orders'
import { priceOf } from '@/lib/prices'
import { useCollectionStore } from '@/store/collection'
import { usePrices } from '@/store/prices'
import { useShoppingStore } from '@/store/shopping'
import type { CollectionData, Order, OrderLine, OrderState, Supplier } from '@/types'
import { CardLine } from './CardLine'
import styles from './ShoppingPage.module.css'

const SUPPLIER_OPTIONS = toOptions(SUPPLIER_LABELS)
const STATE_OPTIONS = toOptions(ORDER_STATE_LABELS)

const STATE_HINTS: Record<OrderState, string> = {
  pending: 'Ses cartes passent en « commandée ».',
  received: 'Ses cartes passent en « possédée », datées du jour de réception.',
  cancelled:
    'Elle ne compte plus dans le budget ; ses cartes encore commandées retrouvent leur état d’avant.',
}

/** Le formulaire tel que saisi : des textes, lus à l'enregistrement. */
interface Draft {
  supplier: Supplier
  supplierName: string
  date: string
  reference: string
  state: OrderState
  receivedAt: string
  shipping: string
  fees: string
  refunded: string
  link: string
  note: string
  lines: { cardId: string; quantity: string; unitPrice: string }[]
}

const amountText = (value: number) => (value ? euroInput(value) : '')

const toDraft = (order: Order): Draft => ({
  supplier: order.supplier,
  supplierName: order.supplierName ?? '',
  date: order.date,
  reference: order.reference ?? '',
  state: order.state,
  receivedAt: order.receivedAt ?? '',
  shipping: amountText(order.shipping),
  fees: amountText(order.fees),
  refunded: amountText(order.refunded),
  link: order.link ?? '',
  note: order.note ?? '',
  lines: order.lines.map((line) => ({
    cardId: line.cardId,
    quantity: String(line.quantity),
    unitPrice: euroInput(line.unitPrice),
  })),
})

/** Un montant facultatif : vide vaut 0. */
const optionalEuros = (text: string) => (text.trim() === '' ? 0 : parseEuros(text))

/**
 * Le brouillon → la commande, et les erreurs de saisie (vides si tout est lisible). `previous` :
 * l'état d'une carte avant la commande, repris de la version enregistrée, sinon lu maintenant.
 */
function readDraft(draft: Draft, base: Order, stored: Order | null, collection: CollectionData) {
  const errors: Record<string, string> = {}
  const amount = (key: 'shipping' | 'fees' | 'refunded') => {
    const value = optionalEuros(draft[key])
    if (value === null) errors[key] = 'Montant en euros, par exemple 4,50.'
    return value ?? 0
  }
  const lines: OrderLine[] = draft.lines.map((line) => {
    const quantity = Number(line.quantity)
    const unitPrice = parseEuros(line.unitPrice)
    if (!Number.isInteger(quantity) || quantity < 1) {
      errors[`quantity-${line.cardId}`] = 'Un nombre entier, 1 ou plus.'
    }
    if (unitPrice === null) errors[`price-${line.cardId}`] = 'Un montant, par exemple 12,50.'
    const previous = previousOf(line.cardId, stored, collection)
    return { cardId: line.cardId, quantity, unitPrice: unitPrice ?? 0, previous }
  })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) errors.date = 'Indiquez la date d’achat.'
  if (lines.length === 0) errors.lines = 'Ajoutez au moins une carte.'
  const link = draft.link.trim()
  if (link && !parseLink(link)) errors.link = 'Une adresse web, par exemple https://…'

  const order: Order = {
    ...base,
    supplier: draft.supplier,
    supplierName: draft.supplier === 'other' ? draft.supplierName.trim() || undefined : undefined,
    date: draft.date,
    reference: draft.reference.trim() || undefined,
    lines,
    shipping: amount('shipping'),
    fees: amount('fees'),
    refunded: amount('refunded'),
    state: draft.state,
    receivedAt: draft.state === 'received' ? draft.receivedAt || draft.date : undefined,
    link: link || undefined,
    note: draft.note.trim() || undefined,
  }
  return { order, errors }
}

/**
 * Enregistrer ou corriger une commande : fournisseur, dates, cartes et prix, port, frais,
 * remboursement, état. Au-delà du plafond du mois, une confirmation est demandée (sans bloquer).
 */
export function OrderForm({
  order: base,
  onClose,
  onSaved,
}: {
  order: Order
  onClose: () => void
  onSaved?: () => void
}) {
  const act = useCollectionAction()
  const collection = useCollectionStore((state) => state.collection)
  const { orders, preferences, budget } = useShoppingStore((state) => state.shopping)
  const prices = usePrices()
  const stored = orders.find((known) => known.id === base.id) ?? null
  const others = orders.filter((known) => known.id !== base.id)
  const [draft, setDraft] = useState(() => toDraft(base))
  // Les erreurs s'affichent après une première tentative, puis suivent la saisie.
  const [submitted, setSubmitted] = useState(false)
  const [overCeiling, setOverCeiling] = useState<{ order: Order; monthTotal: number } | null>(null)
  const set = (change: Partial<Draft>) => setDraft({ ...draft, ...change })

  const read = readDraft(draft, base, stored, collection)
  const { order } = read
  const errors = submitted ? read.errors : {}
  const costs = unitCosts(order)
  const inLines = new Set(draft.lines.map((line) => line.cardId))
  // On ajoute une carte de la liste d'achats ou une carte déjà suivie : l'index entier ferait
  // une liste de plus de mille cartes.
  const addable = [...new Set([...Object.keys(preferences), ...Object.keys(collection.cards)])]
    .filter((cardId) => !inLines.has(cardId) && preferences[cardId]?.decision !== 'excluded')
    .flatMap((cardId) => {
      const card = findCard(cardId, collection)
      return card ? [{ value: cardId, label: `${cardTitle(card)} · ${card.reference}` }] : []
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))

  const addLine = (cardId: string) => {
    const card = findCard(cardId, collection)!
    const price = priceOf(prices, card)?.price
    set({
      lines: [
        ...draft.lines,
        { cardId, quantity: '1', unitPrice: price === undefined ? '' : euroInput(price) },
      ],
    })
  }
  const setLine = (index: number, change: Partial<Draft['lines'][number]>) =>
    set({ lines: draft.lines.map((line, i) => (i === index ? { ...line, ...change } : line)) })

  const save = (order: Order) => {
    const count = cardCount(order.lines)
    act(
      () => useShoppingStore.getState().saveOrder(order),
      stored
        ? 'Commande modifiée.'
        : order.state === 'received'
          ? `Commande enregistrée : ${plural(count, 'carte possédée', 'cartes possédées')}.`
          : `Commande enregistrée : ${plural(count, 'carte commandée', 'cartes commandées')}.`,
    )
    onSaved?.()
    onClose()
  }

  const submit = () => {
    setSubmitted(true)
    if (Object.keys(read.errors).length > 0) return
    // Le plafond est dépassé par cet enregistrement : on demande, sans interdire.
    const month = monthOf(order.date)
    const monthTotal = spentIn(others, month).spent + orderSpent(order)
    if (monthTotal > budget.ceiling && monthTotal > spentIn(orders, month).spent) {
      setOverCeiling({ order, monthTotal })
    } else save(order)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={stored ? 'Modifier la commande' : 'Enregistrer une commande'}
      description="Les prix réellement payés : ils font le budget et le prix payé de chaque carte."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit}>Enregistrer</Button>
        </>
      }
    >
      <Stack gap={5}>
        <div className={styles.formGrid}>
          <Select
            label="Fournisseur"
            options={SUPPLIER_OPTIONS}
            value={draft.supplier}
            onChange={(supplier) => set({ supplier })}
          />
          {draft.supplier === 'other' ? (
            <Input
              label="Nom du fournisseur"
              value={draft.supplierName}
              onChange={(event) => set({ supplierName: event.target.value })}
            />
          ) : (
            <span aria-hidden="true" />
          )}
          <Input
            label="Date d’achat"
            type="date"
            required
            value={draft.date}
            error={errors.date}
            onChange={(event) => set({ date: event.target.value })}
          />
          <Input
            label="Référence"
            hint="Numéro de commande du fournisseur."
            value={draft.reference}
            onChange={(event) => set({ reference: event.target.value })}
          />
        </div>

        <SegmentedField
          label="État"
          hint={STATE_HINTS[draft.state]}
          options={STATE_OPTIONS}
          value={draft.state}
          onChange={(state) => set({ state })}
        />
        {draft.state === 'received' && (
          <Input
            className={styles.narrowField}
            label="Date de réception"
            type="date"
            value={draft.receivedAt || draft.date}
            onChange={(event) => set({ receivedAt: event.target.value })}
          />
        )}

        <Stack gap={3}>
          <h3 className={styles.formTitle}>Cartes</h3>
          {errors.lines && <Alert tone="danger" title={errors.lines} />}
          {draft.lines.length > 0 && (
            <ul className={styles.lines}>
              {draft.lines.map((line, index) => {
                const card = findCard(line.cardId, collection)
                const duplicate = duplicateReason(order.lines[index]!, others)
                if (!card) return <li key={line.cardId}>{line.cardId}</li>
                return (
                  <li key={line.cardId}>
                    <CardLine
                      card={card}
                      detail={
                        duplicate ? (
                          <span className={styles.warn}>{duplicate}</span>
                        ) : (
                          `revient à ${formatEuro(costs[index] ?? 0)}`
                        )
                      }
                    >
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
                      <IconButton
                        label={`Retirer ${card.reference} de la commande`}
                        size="sm"
                        variant="ghost"
                        onClick={() => set({ lines: draft.lines.filter((_, i) => i !== index) })}
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
            // Une clé par nombre de lignes : la case repart vide après chaque ajout ou retrait.
            key={draft.lines.length}
            label="Ajouter une carte"
            hint="Une carte de votre liste d’achats ou déjà suivie. Pour une autre, marquez-la d’abord comme souhaitée sur sa fiche."
            placeholder="Nom ou référence"
            emptyMessage="Aucune carte trouvée."
            options={addable}
            value={undefined}
            onChange={addLine}
          />
        </Stack>

        <div className={styles.formGrid3}>
          {(['shipping', 'fees', 'refunded'] as const).map((key) => (
            <EuroField
              key={key}
              label={{ shipping: 'Port', fees: 'Autres frais', refunded: 'Remboursé' }[key]}
              value={draft[key]}
              error={errors[key]}
              onChange={(event) => set({ [key]: event.target.value })}
            />
          ))}
        </div>

        <DescriptionList
          className={styles.totals}
          divided
          items={[
            { term: 'Cartes', description: formatEuro(linesTotal(order.lines)) },
            { term: 'Port et frais', description: formatEuro(order.shipping + order.fees) },
            ...(order.refunded
              ? [{ term: 'Remboursé', description: `−${formatEuro(order.refunded)}` }]
              : []),
            {
              term: order.state === 'cancelled' ? 'Total (annulée : ne compte pas)' : 'Total',
              description: (
                <strong>{formatEuro(orderSpent({ ...order, state: 'pending' }))}</strong>
              ),
            },
          ]}
        />
        <p className="muted">
          Le port et les frais sont répartis entre les cartes au prorata de leur prix : c’est le
          prix payé noté sur chaque carte.
        </p>

        <Input
          label="Lien"
          hint="La commande chez le fournisseur."
          inputMode="url"
          placeholder="https://…"
          value={draft.link}
          error={errors.link}
          onChange={(event) => set({ link: event.target.value })}
        />
        <Textarea
          label="Notes"
          rows={2}
          value={draft.note}
          onChange={(event) => set({ note: event.target.value })}
        />
      </Stack>

      <ConfirmDialog
        open={overCeiling !== null}
        title="Dépasser votre plafond du mois ?"
        confirmLabel="Enregistrer quand même"
        onClose={() => setOverCeiling(null)}
        onConfirm={() => save(overCeiling!.order)}
      >
        {overCeiling && (
          <p>
            Avec cette commande, vos achats atteignent {formatEuro(overCeiling.monthTotal)} en{' '}
            {formatMonth(monthOf(overCeiling.order.date))}, pour un plafond de{' '}
            {formatEuro(budget.ceiling)}.
          </p>
        )}
      </ConfirmDialog>
    </Modal>
  )
}
