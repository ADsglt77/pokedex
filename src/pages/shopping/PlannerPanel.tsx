import {
  Accordion,
  AccordionItem,
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Progress,
  Slider,
  Stack,
} from '@camply/ui'
import { Receipt, Sparkles } from '@camply/ui/icons'
import { useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { spentThisMonth } from '@/lib/budget'
import { keepFocusInList } from '@/lib/focus'
import { formatEuro, plural, today } from '@/lib/format'
import { priceLabel } from '@/lib/prices'
import { cents, newOrder } from '@/lib/orders'
import { planPurchase } from '@/lib/purchase-planner'
import type { WishRow } from '@/lib/wishlist'
import { useShoppingStore } from '@/store/shopping'
import type { Order } from '@/types'
import { BudgetField } from './BudgetField'
import { CardLine } from './CardLine'
import { OrderForm } from './OrderForm'
import { ExportButtons } from './ExportButtons'
import { useWishlist } from '@/hooks/useWishlist'
import styles from './ShoppingPage.module.css'

/** Le pas du curseur de budget, en euros. */
const BUDGET_STEP = 5

/** Ajoute ou retire un id d'un ensemble, sans le modifier. */
const toggled = (set: ReadonlySet<string>, id: string, on: boolean) => {
  const next = new Set(set)
  if (on) next.add(id)
  else next.delete(id)
  return next
}

const NONE: ReadonlySet<string> = new Set()

/**
 * Les réglages du plan, gardés par la page : l'onglet caché est démonté, ils resteraient sinon à
 * celui d'un autre onglet. Un réglage absent vaut celui par défaut.
 */
export interface PlannerSettings {
  /** Budget de la commande ; par défaut, le reste du budget du mois. */
  amount?: number
  /** Ajoutées à la main. */
  forced?: ReadonlySet<string>
  /** Retirées à la main. */
  skipped?: ReadonlySet<string>
}

/**
 * L'assistant « Préparer ma prochaine commande » : un budget, des règles, un plan recalculé à
 * chaque changement. Le plan n'achète rien : on commande sur Cardmarket, puis on enregistre.
 */
export function PlannerPanel({
  settings,
  onSettingsChange,
  onOrderSaved,
}: {
  settings: PlannerSettings
  onSettingsChange: (settings: PlannerSettings) => void
  onOrderSaved: () => void
}) {
  const { rows, taken } = useWishlist()
  const { orders, budget } = useShoppingStore((state) => state.shopping)
  const spent = spentThisMonth(orders)
  const {
    // Le reste du budget du mois, au pas du curseur (vers le bas : on reste dans le budget).
    amount = Math.floor(
      Math.min(Math.max(budget.monthly - spent, 0), budget.ceiling) / BUDGET_STEP,
    ) * BUDGET_STEP,
    forced = NONE,
    skipped = NONE,
  } = settings
  const change = (next: PlannerSettings) => onSettingsChange({ ...settings, ...next })
  const [draft, setDraft] = useState<Order | null>(null)
  const planTitle = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const pickedList = useRef<HTMLUListElement>(null)

  const plan = planPurchase(rows, taken, {
    budget: amount,
    shippingReserve: budget.shippingReserve,
    forced,
    skipped,
  })
  const monthTotal = cents(spent + plan.total)

  const skip = (row: WishRow, on: boolean) =>
    change({
      skipped: toggled(skipped, row.card.id, on),
      forced: on ? toggled(forced, row.card.id, false) : forced,
    })
  const addAnyway: PlanAction = {
    label: 'Ajouter quand même',
    run: (row) => change({ forced: toggled(forced, row.card.id, true) }),
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        className={styles.panel}
        icon={<Sparkles size={22} />}
        title="Rien à planifier pour l’instant"
        description="L’assistant choisit parmi les cartes de vos Pokémon pas encore obtenues : choisissez-les dans le catalogue ou sur la fiche d’un Pokémon."
      />
    )
  }

  return (
    <div className={styles.planner}>
      <Card className={styles.plannerOptions}>
        <Stack as="section" gap={5} aria-label="Réglages du plan">
          <Slider
            label="Budget de la commande"
            hint={`Port compris. Déjà dépensé ce mois-ci : ${formatEuro(spent)}.`}
            min={0}
            max={Math.max(budget.ceiling, amount)}
            step={BUDGET_STEP}
            value={amount}
            onChange={(value) => change({ amount: value })}
            showValue
            formatValue={formatEuro}
          />
          <BudgetField field="shippingReserve" />
        </Stack>
      </Card>

      <Stack as="section" gap={5} aria-labelledby={planTitle}>
        <div className={styles.planSummary}>
          <h2 ref={heading} id={planTitle} tabIndex={-1} className={styles.sectionTitle}>
            {plan.picked.length
              ? plural(plan.picked.length, 'carte proposée', 'cartes proposées')
              : 'Aucune carte proposée'}
          </h2>
          <p className={styles.planTotal}>
            <span className="numeric">{formatEuro(plan.total)}</span>
            <span className="muted"> sur {formatEuro(amount)}</span>
          </p>
          <Progress
            value={plan.total}
            max={amount}
            tone={plan.overBudget ? 'danger' : 'info'}
            size="sm"
            aria-label="Part du budget utilisée"
          />
          <p className="muted">
            Cartes {formatEuro(plan.cardsTotal)}
            {plan.picked.length > 0 && ` · port réservé ${formatEuro(budget.shippingReserve)}`}
            {` · reste ${formatEuro(Math.max(0, amount - plan.total))}`}
          </p>
        </div>

        {plan.overBudget && (
          <Alert tone="warn" title="Les cartes ajoutées à la main dépassent le budget.">
            Le plan coûte {formatEuro(plan.total)} pour un budget de {formatEuro(amount)}.
          </Alert>
        )}
        {plan.total > 0 && monthTotal > budget.ceiling && (
          <Alert tone="warn" title="Ce plan dépasse votre plafond du mois.">
            Avec lui, vos achats de ce mois atteindraient {formatEuro(monthTotal)}, pour un plafond
            de {formatEuro(budget.ceiling)}.
          </Alert>
        )}

        {plan.picked.length > 0 ? (
          <ul ref={pickedList} className={styles.lines}>
            {plan.picked.map((row, index) => (
              <li key={row.card.id}>
                <PlanLine row={row}>
                  {forced.has(row.card.id) && (
                    <Badge size="sm" tone="info">
                      Ajoutée à la main
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      keepFocusInList(pickedList, index, () => skip(row, true), heading)
                    }
                  >
                    Retirer
                  </Button>
                </PlanLine>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            {plan.left.length > 0
              ? 'Aucune carte ne tient dans ce budget. Augmentez le budget, ou regardez ci-dessous les cartes mises de côté.'
              : 'Aucune carte à proposer : regardez ci-dessous les cartes mises de côté.'}
          </p>
        )}

        {plan.picked.length > 0 && (
          <Stack direction="horizontal" gap={2} wrap>
            <Button
              size="sm"
              leftIcon={<Receipt size={14} />}
              onClick={() => setDraft(planOrder(plan.picked, budget.shippingReserve))}
            >
              Enregistrer comme commande…
            </Button>
            <ExportButtons rows={plan.picked} name="prochaine-commande" />
          </Stack>
        )}
        <p className={styles.note}>
          Ce plan n’est pas une commande : rien n’est acheté. Cherchez les cartes sur Cardmarket,
          commandez, puis enregistrez la commande avec les prix réellement payés.
        </p>

        <Accordion multiple>
          <PlanGroup
            value="left"
            fallback={heading}
            title="Hors budget"
            rows={plan.left}
            empty="Toutes les cartes possibles tiennent dans le budget."
            action={addAnyway}
          />
          <PlanGroup
            value="covered"
            fallback={heading}
            title="Pokémon déjà prévu"
            rows={plan.covered}
            empty="Aucune carte d’un Pokémon déjà dans le plan."
            hint="Une seule carte par Pokémon : celle du plan a été préférée (ajoutée à la main, sinon la moins chère)."
            action={addAnyway}
          />
          <PlanGroup
            value="unpriced"
            fallback={heading}
            title="Sans prix"
            rows={plan.unpriced}
            empty="Toutes les cartes possibles ont un prix."
            hint="Aucun prix n’est inventé : regardez vous-même les annonces des vendeurs."
          />
          <PlanGroup
            value="skipped"
            fallback={heading}
            title="Retirées à la main"
            rows={plan.skipped}
            empty="Aucune carte retirée."
            action={{ label: 'Remettre', run: (row) => skip(row, false) }}
          />
          <AccordionItem value="how" title="Comment le plan est construit" headingLevel={3}>
            <ol className={styles.steps}>
              <li>
                Les cartes de vos Pokémon, ni possédées ni commandées, d’un Pokémon que vous n’avez
                pas.
              </li>
              <li>Les cartes sans prix sont mises de côté.</li>
              <li>Dans l’ordre : vos ajouts à la main, puis le prix le plus bas.</li>
              <li>
                Une carte est prise si son Pokémon n’est pas déjà dans le plan et si elle tient dans
                le budget, port réservé.
              </li>
            </ol>
            <p className="muted">
              Un calcul simple et indicatif : les prix du marché ne sont pas ceux des annonces, et
              plusieurs vendeurs veulent dire plusieurs frais de port.
            </p>
          </AccordionItem>
        </Accordion>
      </Stack>

      {draft && (
        <OrderForm
          order={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            change({ forced: NONE, skipped: NONE })
            onOrderSaved()
          }}
        />
      )}
    </div>
  )
}

/** Une commande à compléter : les cartes du plan au prix du marché, le port réservé. */
const planOrder = (rows: readonly WishRow[], shipping: number) =>
  newOrder(
    today(),
    rows.map((row) => ({
      cardId: row.card.id,
      quantity: 1,
      unitPrice: row.price!,
      previous: null,
    })),
    shipping,
  )

function PlanLine({ row, children }: { row: WishRow; children?: ReactNode }) {
  return (
    <CardLine card={row.card} detail={row.price === null ? 'sans prix' : priceLabel(row.price)}>
      {children}
    </CardLine>
  )
}

/**
 * L'action d'une carte d'un groupe, qui l'envoie dans un autre : le focus va alors à la carte
 * suivante du groupe, au titre du plan (`fallback`) s'il se vide.
 */
interface PlanAction {
  label: string
  run: (row: WishRow) => void
}

function PlanGroup({
  value,
  fallback,
  title,
  rows,
  empty,
  hint,
  action,
}: {
  value: string
  fallback: RefObject<HTMLElement | null>
  title: string
  rows: WishRow[]
  empty: string
  hint?: string
  action?: PlanAction
}) {
  const list = useRef<HTMLUListElement>(null)
  return (
    <AccordionItem value={value} title={`${title} (${rows.length})`} headingLevel={3}>
      {hint && rows.length > 0 && <p className="muted">{hint}</p>}
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul ref={list} className={styles.lines}>
          {rows.map((row, index) => (
            <li key={row.card.id}>
              <PlanLine row={row}>
                {action && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => keepFocusInList(list, index, () => action.run(row), fallback)}
                  >
                    {action.label}
                  </Button>
                )}
              </PlanLine>
            </li>
          ))}
        </ul>
      )}
    </AccordionItem>
  )
}
