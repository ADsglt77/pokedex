import {
  Accordion,
  AccordionItem,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Progress,
  Slider,
  Stack,
} from '@camply/ui'
import { Receipt, Sparkles } from '@camply/ui/icons'
import { useState, type ReactNode } from 'react'
import { PRIORITY_LABELS } from '@/config/shopping'
import { spentThisMonth } from '@/lib/budget'
import { isToBuy } from '@/lib/collection'
import { details, formatEuro, plural, today } from '@/lib/format'
import { priceLabel } from '@/lib/prices'
import { cents, newOrder } from '@/lib/orders'
import { planPurchase } from '@/lib/purchase-planner'
import type { WishRow } from '@/lib/wishlist'
import { useShoppingStore } from '@/store/shopping'
import type { Order, Priority } from '@/types'
import { BudgetField } from './BudgetField'
import { CardLine } from './CardLine'
import { OrderForm } from './OrderForm'
import { ExportButtons } from './ExportButtons'
import { useWishlist } from '@/hooks/useWishlist'
import styles from './ShoppingPage.module.css'

const ALL_PRIORITIES = Object.keys(PRIORITY_LABELS) as Priority[]

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
  priorities?: Priority[]
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
    priorities = ALL_PRIORITIES,
    forced = NONE,
    skipped = NONE,
  } = settings
  const change = (next: PlannerSettings) => onSettingsChange({ ...settings, ...next })
  const [draft, setDraft] = useState<Order | null>(null)

  const plan = planPurchase(rows, taken, {
    budget: amount,
    shippingReserve: budget.shippingReserve,
    priorities,
    forced,
    skipped,
  })
  const monthTotal = cents(spent + plan.total)

  const skip = (row: WishRow, on: boolean) =>
    change({
      skipped: toggled(skipped, row.card.id, on),
      forced: on ? toggled(forced, row.card.id, false) : forced,
    })
  const addAnyway = (row: WishRow) => (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => change({ forced: toggled(forced, row.card.id, true) })}
    >
      Ajouter quand même
    </Button>
  )

  if (rows.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        className={styles.panel}
        icon={<Sparkles size={22} />}
        title="Rien à planifier pour l’instant"
        description="L’assistant choisit parmi les cartes de votre liste d’achats : ajoutez-en depuis la fiche d’un Pokémon (« À acheter »)."
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
          <fieldset className={styles.fieldset}>
            <legend className="camply-field__label">Priorités prises en compte</legend>
            {ALL_PRIORITIES.map((priority) => (
              <Checkbox
                key={priority}
                label={PRIORITY_LABELS[priority]}
                checked={priorities.includes(priority)}
                onChange={(event) =>
                  change({
                    priorities: ALL_PRIORITIES.filter((known) =>
                      known === priority ? event.target.checked : priorities.includes(known),
                    ),
                  })
                }
              />
            ))}
          </fieldset>
        </Stack>
      </Card>

      <Stack as="section" gap={5} aria-labelledby="plan-title">
        <div className={styles.planSummary}>
          <h2 id="plan-title" className={styles.sectionTitle}>
            {plan.picked.length
              ? plural(plan.picked.length, 'carte proposée', 'cartes proposées')
              : 'Aucune carte proposée'}
          </h2>
          <p className={styles.planTotal}>
            <span className="numeric">{formatEuro(plan.total)}</span>
            <span className="muted"> sur {formatEuro(amount)}</span>
          </p>
          <Progress
            value={Math.min(plan.total, amount)}
            max={Math.max(amount, 1)}
            tone={plan.overBudget ? 'danger' : 'accent'}
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
          <ul className={styles.lines}>
            {plan.picked.map((row) => (
              <li key={row.card.id}>
                <PlanLine row={row}>
                  {forced.has(row.card.id) && (
                    <Badge size="sm" tone="info">
                      Ajoutée à la main
                    </Badge>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => skip(row, true)}>
                    Retirer
                  </Button>
                </PlanLine>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            {!rows.some(isToBuy)
              ? 'Toutes les cartes de votre liste d’achats sont possédées ou commandées : rien à commander.'
              : plan.left.length > 0
                ? 'Aucune carte ne tient dans ce budget avec ces règles. Augmentez le budget, ou regardez ci-dessous les cartes mises de côté.'
                : 'Aucune carte à proposer avec ces règles : regardez ci-dessous les cartes mises de côté.'}
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
            title="Hors budget"
            rows={plan.left}
            empty="Toutes les cartes possibles tiennent dans le budget."
            action={addAnyway}
          />
          <PlanGroup
            value="covered"
            title="Pokémon déjà prévu"
            rows={plan.covered}
            empty="Aucune carte d’un Pokémon déjà dans le plan."
            hint="Une seule carte par Pokémon : celle du plan a été préférée (ajoutée à la main, priorité, puis prix)."
            action={addAnyway}
          />
          <PlanGroup
            value="above-max"
            title="Au-dessus de leur prix maximum"
            rows={plan.aboveMax}
            empty="Aucune carte ne dépasse son prix maximum."
            action={addAnyway}
          />
          <PlanGroup
            value="unpriced"
            title="Sans prix"
            rows={plan.unpriced}
            empty="Toutes les cartes possibles ont un prix."
            hint="Aucun prix n’est inventé : regardez vous-même les annonces des vendeurs."
          />
          <PlanGroup
            value="skipped"
            title="Retirées à la main"
            rows={plan.skipped}
            empty="Aucune carte retirée."
            action={(row) => (
              <Button size="sm" variant="ghost" onClick={() => skip(row, false)}>
                Remettre
              </Button>
            )}
          />
          <AccordionItem value="how" title="Comment le plan est construit" headingLevel={3}>
            <ol className={styles.steps}>
              <li>
                Les cartes de votre liste d’achats, ni possédées ni commandées, des priorités
                cochées, et d’un Pokémon que vous n’avez pas.
              </li>
              <li>
                Les cartes sans prix et celles au-dessus de leur prix maximum sont mises de côté.
              </li>
              <li>Dans l’ordre : vos ajouts à la main, la priorité, puis le prix le plus bas.</li>
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
  const { price, preference } = row
  return (
    <CardLine
      card={row.card}
      detail={details(
        price === null ? 'sans prix' : priceLabel(price, row.source),
        preference.maxPrice !== undefined && `max ${formatEuro(preference.maxPrice)}`,
        `priorité ${PRIORITY_LABELS[preference.priority].toLowerCase()}`,
      )}
    >
      {children}
    </CardLine>
  )
}

function PlanGroup({
  value,
  title,
  rows,
  empty,
  hint,
  action,
}: {
  value: string
  title: string
  rows: WishRow[]
  empty: string
  hint?: string
  action?: (row: WishRow) => ReactNode
}) {
  return (
    <AccordionItem value={value} title={`${title} (${rows.length})`} headingLevel={3}>
      {hint && rows.length > 0 && <p className="muted">{hint}</p>}
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className={styles.lines}>
          {rows.map((row) => (
            <li key={row.card.id}>
              <PlanLine row={row}>{action?.(row)}</PlanLine>
            </li>
          ))}
        </ul>
      )}
    </AccordionItem>
  )
}
