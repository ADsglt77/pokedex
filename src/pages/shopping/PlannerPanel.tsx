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
import { Copy, Receipt, Sparkles } from '@camply/ui/icons'
import { useDeferredValue, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { spentThisMonth } from '@/lib/budget'
import { keepFocusInList } from '@/lib/focus'
import { formatEuro, plural, today } from '@/lib/format'
import { cents, newOrder } from '@/lib/orders'
import { planPurchase } from '@/lib/purchase-planner'
import type { WishRow } from '@/lib/wishlist'
import { useShoppingStore } from '@/store/shopping'
import type { Order } from '@/types'
import { BudgetField } from './BudgetField'
import { CardLine } from './CardLine'
import { OrderForm } from './OrderForm'
import { WantsDialog } from './WantsDialog'
import page from './ShoppingPage.module.css'
import styles from './PlannerPanel.module.css'

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
 * chaque changement. Le plan n'achète rien : on commande sur Cardmarket (ses cartes copiées pour
 * une liste de souhaits : `WantsDialog`), puis on enregistre.
 */
export function PlannerPanel({
  rows,
  settings,
  onSettingsChange,
  onOrderSaved,
}: {
  rows: WishRow[]
  settings: PlannerSettings
  onSettingsChange: (settings: PlannerSettings) => void
  onOrderSaved: () => void
}) {
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
  const [wantsOpen, setWantsOpen] = useState(false)
  // Les groupes ouverts. camply rend le contenu d'un groupe fermé (seulement caché) : un groupe ne
  // rend ses cartes qu'ouvert, sans quoi chaque pas du curseur les rendrait toutes.
  const [openGroups, setOpenGroups] = useState<string[]>([])
  const planTitle = useId()
  const heading = useRef<HTMLHeadingElement>(null)

  // Le curseur suit la souris ; le plan suit dès que le navigateur a le temps (des centaines de
  // cartes à reclasser à chaque pas).
  const planned = useDeferredValue(amount)
  const plan = useMemo(
    () =>
      planPurchase(rows, {
        budget: planned,
        shippingReserve: budget.shippingReserve,
        forced,
        skipped,
      }),
    [rows, planned, budget.shippingReserve, forced, skipped],
  )
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
        className={page.panel}
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
            <span className="muted"> sur {formatEuro(planned)}</span>
          </p>
          <Progress
            value={plan.total}
            max={planned}
            tone={plan.overBudget ? 'danger' : 'info'}
            size="sm"
            aria-label="Part du budget utilisée"
          />
          <p className="muted">
            Cartes {formatEuro(plan.cardsTotal)}
            {plan.picked.length > 0 && ` · port réservé ${formatEuro(budget.shippingReserve)}`}
            {` · reste ${formatEuro(Math.max(0, planned - plan.total))}`}
          </p>
          {plan.picked.length > 0 && (
            <Stack direction="horizontal" gap={2} wrap className={styles.planActions}>
              <Button
                variant="secondary"
                leftIcon={<Copy size={16} />}
                onClick={() => setWantsOpen(true)}
              >
                Copier pour Cardmarket
              </Button>
              <Button
                leftIcon={<Receipt size={16} />}
                onClick={() =>
                  // Les cartes du plan au prix du marché, le port réservé : une commande à compléter.
                  setDraft(
                    newOrder(
                      today(),
                      plan.picked.map((row) => ({
                        cardId: row.card.id,
                        quantity: 1,
                        unitPrice: row.price,
                        previous: null,
                      })),
                      budget.shippingReserve,
                    ),
                  )
                }
              >
                Enregistrer comme commande…
              </Button>
            </Stack>
          )}
        </div>

        {plan.overBudget && (
          <Alert tone="warn" title="Les cartes ajoutées à la main dépassent le budget.">
            Le plan coûte {formatEuro(plan.total)} pour un budget de {formatEuro(planned)}.
          </Alert>
        )}
        {plan.total > 0 && monthTotal > budget.ceiling && (
          <Alert tone="warn" title="Ce plan dépasse votre plafond du mois.">
            Avec lui, vos achats de ce mois atteindraient {formatEuro(monthTotal)}, pour un plafond
            de {formatEuro(budget.ceiling)}.
          </Alert>
        )}

        {plan.picked.length > 0 ? (
          <PlanList
            rows={plan.picked}
            fallback={heading}
            forced={forced}
            action={{ label: 'Retirer', run: (row) => skip(row, true) }}
          />
        ) : (
          <p className="muted">
            {plan.left.length > 0
              ? 'Aucune carte ne tient dans ce budget. Augmentez le budget, ou regardez ci-dessous les cartes mises de côté.'
              : 'Aucune carte à proposer : regardez ci-dessous les cartes mises de côté.'}
          </p>
        )}

        <p className={page.note}>
          Ce plan n’est pas une commande : rien n’est acheté. Copiez les cartes pour votre liste de
          souhaits Cardmarket (ou cherchez-les), commandez, puis enregistrez la commande avec les
          prix réellement payés.
        </p>

        <Accordion
          multiple
          value={openGroups}
          onChange={(value) => setOpenGroups(value as string[])}
        >
          {[
            {
              value: 'left',
              title: 'Hors budget',
              rows: plan.left,
              empty: 'Toutes les cartes possibles tiennent dans le budget.',
              action: addAnyway,
            },
            {
              value: 'covered',
              title: 'Pokémon déjà prévu',
              rows: plan.covered,
              empty: 'Aucune carte d’un Pokémon déjà dans le plan.',
              hint: 'Une seule carte par Pokémon : celle du plan a été préférée (ajoutée à la main, sinon la moins chère).',
              action: addAnyway,
            },
            {
              value: 'unpriced',
              title: 'Sans prix',
              rows: plan.unpriced,
              empty: 'Toutes les cartes possibles ont un prix.',
              hint: 'Aucun prix n’est inventé : regardez vous-même les annonces des vendeurs.',
            },
            {
              value: 'skipped',
              title: 'Retirées à la main',
              rows: plan.skipped,
              empty: 'Aucune carte retirée.',
              action: { label: 'Remettre', run: (row: WishRow) => skip(row, false) },
            },
          ].map((group) => (
            <PlanGroup
              key={group.value}
              {...group}
              open={openGroups.includes(group.value)}
              fallback={heading}
            />
          ))}
          <AccordionItem value="how" title="Comment le plan est construit" headingLevel={3}>
            <Stack gap={3}>
              <ol className={page.steps}>
                <li>
                  Les cartes de vos Pokémon, ni possédées ni commandées, d’un Pokémon que vous
                  n’avez pas.
                </li>
                <li>Les cartes sans prix sont mises de côté.</li>
                <li>Dans l’ordre : vos ajouts à la main, puis le prix le plus bas.</li>
                <li>
                  Une carte est prise si son Pokémon n’est pas déjà dans le plan et si elle tient
                  dans le budget, port réservé.
                </li>
              </ol>
              <p className="muted">
                Un calcul simple et indicatif : les prix du marché ne sont pas ceux des annonces, et
                plusieurs vendeurs veulent dire plusieurs frais de port.
              </p>
            </Stack>
          </AccordionItem>
        </Accordion>
      </Stack>

      {wantsOpen && (
        <WantsDialog
          // Une carte prise a un prix, donc un id Cardmarket.
          cards={plan.picked.flatMap(({ card }) =>
            card.cardmarket ? [{ ...card, cardmarket: card.cardmarket }] : [],
          )}
          onClose={() => setWantsOpen(false)}
        />
      )}
      {draft && (
        <OrderForm
          order={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            // Les réglages par défaut : le budget revient au reste du mois, commande comprise.
            onSettingsChange({})
            onOrderSaved()
          }}
        />
      )}
    </div>
  )
}

/**
 * L'action d'une carte, qui l'envoie dans un autre groupe : le focus va alors à la carte suivante
 * de la liste, au titre du plan (`fallback`) si elle se vide.
 */
interface PlanAction {
  label: string
  run: (row: WishRow) => void
}

/** Des cartes du plan, chacune avec son prix et son action ; `forced` : ajoutées à la main. */
function PlanList({
  rows,
  fallback,
  action,
  forced,
}: {
  rows: WishRow[]
  fallback: RefObject<HTMLElement | null>
  action?: PlanAction
  forced?: ReadonlySet<string>
}) {
  const list = useRef<HTMLUListElement>(null)
  return (
    <ul ref={list} className={page.lines}>
      {rows.map((row, index) => (
        <li key={row.card.id}>
          <CardLine
            card={row.card}
            detail={row.price === null ? 'sans prix' : formatEuro(row.price)}
          >
            {action && (
              <>
                {forced?.has(row.card.id) && (
                  <Badge size="sm" tone="info">
                    Ajoutée à la main
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => keepFocusInList(list, index, () => action.run(row), fallback)}
                >
                  {action.label}
                </Button>
              </>
            )}
          </CardLine>
        </li>
      ))}
    </ul>
  )
}

/** Un groupe de cartes mises de côté ; fermé, il ne rend que son titre et son nombre. */
function PlanGroup({
  value,
  open,
  fallback,
  title,
  rows,
  empty,
  hint,
  action,
}: {
  value: string
  open: boolean
  fallback: RefObject<HTMLElement | null>
  title: string
  rows: WishRow[]
  empty: string
  hint?: string
  action?: PlanAction
}) {
  return (
    <AccordionItem value={value} title={`${title} (${rows.length})`} headingLevel={3}>
      {open &&
        (rows.length === 0 ? (
          <p className="muted">{empty}</p>
        ) : (
          <>
            {hint && <p className="muted">{hint}</p>}
            <PlanList rows={rows} fallback={fallback} action={action} />
          </>
        ))}
    </AccordionItem>
  )
}
