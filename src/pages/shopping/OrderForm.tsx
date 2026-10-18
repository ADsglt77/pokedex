import { Button, Input, Modal, Select, Stack, Textarea } from '@camply/ui'
import { useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router'
import { EuroField } from '@/components/EuroInput'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SegmentedField } from '@/components/SegmentedField'
import { ORDER_STATE_LABELS, SUPPLIER_LABELS } from '@/config/shopping'
import { useCollectionAction } from '@/hooks/useNotify'
import { monthOf, spentIn } from '@/lib/budget'
import { cx } from '@/lib/cx'
import { focusFirstError } from '@/lib/focus'
import {
  euroInput,
  formatEuro,
  formatMonth,
  parseEuros,
  parseLink,
  plural,
  toOptions,
} from '@/lib/format'
import { canBePending, cardCount, cents, orderSpent, previousOf, refundFits } from '@/lib/orders'
import { isDay } from '@/lib/transfer'
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
// Reçue, une commande ne repasse pas « en cours » (`canBePending`).
const STATE_OPTIONS_RECEIVED = STATE_OPTIONS.filter((option) => option.value !== 'pending')
const RECEIVED_HINT = 'Une commande reçue ne repasse pas en cours : ses cartes restent possédées.'

/** Le plus petit jour des champs de date : le calendrier du navigateur ne propose rien avant. */
const MIN_DAY = '2000-01-01'
/** Un jour que l'import et le serveur refuseraient (`isDay`) : une année tapée en deux chiffres. */
const DAY_ERROR = 'L’année en quatre chiffres, par exemple 05/10/2026.'

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
  // Les jours que l'import et le serveur acceptent (`isDay`) : « 05/10/26 » donnerait l'an 26, un
  // document que la synchronisation refuserait, compté au budget d'« octobre 26 ».
  if (!isDay(draft.date)) errors.date = draft.date ? DAY_ERROR : 'Indiquez la date d’achat.'
  if (draft.state === 'received' && draft.receivedAt && !isDay(draft.receivedAt)) {
    errors.receivedAt = DAY_ERROR
  }
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
 * remboursement, état. Au-delà du plafond du mois, une confirmation est demandée (sans bloquer) ;
 * fermer une saisie commencée, ou quitter la page avec elle, aussi. Une question remplace la
 * fenêtre le temps d'y répondre, à côté d'elle et pas dedans (deux fenêtres ouvertes se
 * disputeraient le focus, et la page resterait sans défilement) : la saisie, gardée ici, revient
 * telle quelle si l'on répond « Annuler ».
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
  const [initial] = useState(() => toDraft(base))
  const [draft, setDraft] = useState(initial)
  // Les erreurs s'affichent après une première tentative, puis suivent la saisie.
  const [submitted, setSubmitted] = useState(false)
  const [overCeiling, setOverCeiling] = useState<{ order: Order; monthTotal: number } | null>(null)
  const [abandoning, setAbandoning] = useState(false)
  const fields = useRef<HTMLElement>(null)
  const set = (change: Partial<Draft>) => setDraft({ ...draft, ...change })
  const started = JSON.stringify(draft) !== JSON.stringify(initial)
  // Enregistrer ou abandonner ferme la saisie : la page peut alors changer sans question
  // (« Enregistrer comme commande » ouvre « Commandes »). Une `ref` : lue par le routeur au moment
  // de la navigation, dans le même clic, avant que la fenêtre ne soit retirée.
  const closing = useRef(false)
  // Quitter la page avec une saisie commencée (le titre d'une carte, le retour du navigateur, la
  // recherche Ctrl K) : la même question que fermer la fenêtre.
  const blocker = useBlocker(() => started && !closing.current)
  const asking = abandoning || blocker.state === 'blocked'
  const formOpen = !asking && overCeiling === null
  // Le focus : après « Abandonner », il revient au bouton qui avait ouvert la saisie (`opener`, le
  // focus à l'ouverture ; la question le rendrait sinon à un champ qui n'existe plus). Après
  // « Annuler », la fenêtre revient et le met à son premier bouton, comme à son ouverture ; au
  // plafond, il retourne plutôt à « Enregistrer ».
  const [opener] = useState(() => document.activeElement as HTMLElement | null)
  const saveButton = useRef<HTMLButtonElement>(null)
  const backToSave = useRef(false)
  useEffect(() => {
    if (!formOpen || !backToSave.current) return
    backToSave.current = false
    saveButton.current?.focus()
  }, [formOpen])
  // Échap (même depuis un champ), la croix ou « Annuler » : une saisie commencée n'est pas perdue
  // sans confirmation.
  const close = () => {
    if (started) setAbandoning(true)
    else onClose()
  }
  // « Abandonner » : la fenêtre se ferme, et la navigation retenue repart.
  const abandon = () => {
    closing.current = true
    blocker.proceed?.()
    onClose()
    // Une fois la question retirée (elle rend le focus en se fermant).
    requestAnimationFrame(() => opener?.focus())
  }
  // « Annuler » (aussi appelé après « Abandonner », par ConfirmDialog : la navigation est déjà
  // repartie) : la saisie revient, et la navigation retenue est oubliée.
  const keepEditing = () => {
    setAbandoning(false)
    if (!closing.current) blocker.reset?.()
  }

  const read = readDraft(draft, base, stored, collection)
  const { order } = read
  const errors = submitted ? read.errors : {}
  // Le mois de la commande avec elle, suivi pendant la saisie.
  const month = monthOf(order.date)
  const monthTotal = cents(spentIn(others, month).spent + orderSpent(order))

  const save = (order: Order) => {
    closing.current = true
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
      focusFirstError(fields, () => setSubmitted(true))
      return
    }
    // Le plafond est dépassé par cet enregistrement : on demande, sans interdire.
    if (monthTotal > budget.ceiling && monthTotal > spentIn(orders, month).spent) {
      setOverCeiling({ order, monthTotal })
    } else save(order)
  }

  return (
    <>
      <Modal
        open={formOpen}
        onClose={close}
        // Un clic à côté ne perd pas une longue saisie.
        closeOnBackdrop={false}
        size="lg"
        title={stored ? 'Modifier la commande' : 'Enregistrer une commande'}
        description="Les prix réellement payés : ils font le budget et le prix payé de chaque carte."
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Annuler
            </Button>
            <Button ref={saveButton} onClick={submit}>
              Enregistrer
            </Button>
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
              min={MIN_DAY}
              value={draft.date}
              error={errors.date}
              onChange={(event) => set({ date: event.target.value })}
            />
            <Input
              label="Référence"
              hint="Numéro de commande du fournisseur."
              spellCheck={false}
              autoCorrect="off"
              autoComplete="off"
              value={draft.reference}
              onChange={(event) => set({ reference: event.target.value })}
            />
          </div>

          <SegmentedField
            label="État"
            hint={
              canBePending(stored)
                ? STATE_HINTS[draft.state]
                : `${STATE_HINTS[draft.state]} ${RECEIVED_HINT}`
            }
            options={canBePending(stored) ? STATE_OPTIONS : STATE_OPTIONS_RECEIVED}
            value={draft.state}
            onChange={(state) => set({ state })}
          />
          {draft.state === 'received' && (
            <Input
              className={styles.narrowField}
              label="Date de réception"
              type="date"
              min={MIN_DAY}
              value={draft.receivedAt || draft.date}
              error={errors.receivedAt}
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
            Le port, les frais et le remboursé sont répartis entre les cartes au prorata de leur
            prix : c’est le prix payé noté sur chaque carte.
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
      </Modal>

      <ConfirmDialog
        open={overCeiling !== null && !asking}
        title="Dépasser votre plafond du mois ?"
        confirmLabel="Enregistrer quand même"
        tone="warn"
        onClose={() => {
          backToSave.current = true
          setOverCeiling(null)
        }}
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
      <ConfirmDialog
        open={asking}
        title="Abandonner la saisie ?"
        confirmLabel="Abandonner"
        tone="warn"
        onClose={keepEditing}
        onConfirm={abandon}
      >
        <p>
          {stored
            ? 'Vos modifications de cette commande ne seront pas enregistrées.'
            : 'Cette commande ne sera pas enregistrée.'}
        </p>
      </ConfirmDialog>
    </>
  )
}
