import { Button, Input, Modal, Select, Stack, Textarea } from '@camply/ui'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { EuroField } from '@/components/EuroInput'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SegmentedField } from '@/components/SegmentedField'
import { ORDER_STATE_LABELS, SUPPLIER_LABELS } from '@/config/shopping'
import { useCollectionAction } from '@/hooks/useNotify'
import { monthOf, spentIn } from '@/lib/budget'
import { cx } from '@/lib/cx'
import {
  euroInput,
  formatEuro,
  formatMonth,
  parseEuros,
  parseLink,
  plural,
  toOptions,
} from '@/lib/format'
import { cardCount, cents, orderSpent, previousOf, refundFits } from '@/lib/orders'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import type { CollectionData, Order, OrderLine, OrderState, Supplier } from '@/types'
import { BudgetLevelBadge, BudgetMeter } from '@/components/BudgetMeter'
import { OrderLines, type DraftLine } from './OrderLines'
import { OrderTotals } from './OrderTotals'
import page from './ShoppingPage.module.css'
import styles from './OrderForm.module.css'

const SUPPLIER_OPTIONS = toOptions(SUPPLIER_LABELS)
const STATE_OPTIONS = toOptions(ORDER_STATE_LABELS)

const STATE_HINTS: Record<OrderState, string> = {
  pending: 'Ses cartes passent en « commandée », sauf celles déjà possédées.',
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
  lines: DraftLine[]
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
 * l'état d'une carte avant la commande (`previousOf`, que le store relit à l'enregistrement).
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
    const readable = Number.isInteger(quantity) && quantity >= 1
    if (!readable) errors[`quantity-${line.cardId}`] = 'Un nombre entier, 1 ou plus.'
    if (unitPrice === null) errors[`price-${line.cardId}`] = 'Un montant, par exemple 12,50.'
    const previous = previousOf(line.cardId, stored, collection)
    // Illisible, la ligne compte pour 0 dans l'aperçu : l'erreur bloque l'enregistrement.
    return {
      cardId: line.cardId,
      quantity: readable ? quantity : 0,
      unitPrice: unitPrice ?? 0,
      previous,
    }
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
  if (!refundFits(order)) errors.refunded = 'Pas plus que le total de la commande.'
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
  const { orders, budget } = useShoppingStore((state) => state.shopping)
  const stored = orders.find((known) => known.id === base.id) ?? null
  const others = orders.filter((known) => known.id !== base.id)
  const [draft, setDraft] = useState(() => toDraft(base))
  // Les erreurs s'affichent après une première tentative, puis suivent la saisie.
  const [submitted, setSubmitted] = useState(false)
  const [overCeiling, setOverCeiling] = useState<{ order: Order; monthTotal: number } | null>(null)
  const fields = useRef<HTMLElement>(null)
  const set = (change: Partial<Draft>) => setDraft({ ...draft, ...change })

  const read = readDraft(draft, base, stored, collection)
  const { order } = read
  const errors = submitted ? read.errors : {}
  // Le mois de la commande avec elle, suivi pendant la saisie.
  const month = monthOf(order.date)
  const monthTotal = cents(spentIn(others, month).spent + orderSpent(order))

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
    if (Object.keys(read.errors).length > 0) {
      // Les erreurs affichées, le premier champ en erreur est mis sous les yeux.
      flushSync(() => setSubmitted(true))
      const field = fields.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      field?.focus({ preventScroll: true })
      return
    }
    // Le plafond est dépassé par cet enregistrement : on demande, sans interdire.
    if (monthTotal > budget.ceiling && monthTotal > spentIn(orders, month).spent) {
      setOverCeiling({ order, monthTotal })
    } else save(order)
  }

  return (
    <Modal
      open
      onClose={onClose}
      // Un clic à côté ne perd pas une longue saisie.
      closeOnBackdrop={false}
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
      <Stack gap={5} ref={fields}>
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
            // Cale la date sous la colonne de droite ; caché sur téléphone (une colonne).
            <span aria-hidden="true" className={styles.gridFiller} />
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

        <OrderLines
          lines={draft.lines}
          order={order}
          others={others}
          errors={errors}
          readErrors={read.errors}
          onChange={(lines) => set({ lines })}
        />

        <div className={page.formGrid3}>
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

        <OrderTotals order={order} />
        {!read.errors.date && (
          <div className={cx(page.amountsColumn, styles.orderBudget)}>
            <p>
              En {formatMonth(month)}, avec cette commande&nbsp;:{' '}
              <strong>{formatEuro(monthTotal)}</strong>{' '}
              <BudgetLevelBadge spent={monthTotal} budget={budget} />
            </p>
            <BudgetMeter spent={monthTotal} budget={budget} />
          </div>
        )}
        <p className="muted">
          Le port, les frais et le remboursé sont répartis entre les cartes au prorata de leur prix
          : c’est le prix payé noté sur chaque carte.
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
        tone="warn"
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
