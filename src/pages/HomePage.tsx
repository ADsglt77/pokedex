import { Button, RadialProgress, Skeleton, Stat, Steps } from '@camply/ui'
import {
  ChevronRight,
  Clock,
  Grid3x3,
  ImageOff,
  Layers,
  ListChecks,
  Package,
  Receipt,
  TrendingDown,
  Unlink,
  Wallet,
  WalletCards,
  type IconProps,
} from '@camply/ui/icons'
import { useMemo, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router'
import { BudgetMeter } from '@/components/BudgetMeter'
import { CardArt } from '@/components/CardArt'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import { ProgressRuler } from '@/components/ProgressRuler'
import { STATUS_ICONS } from '@/components/statusIcons'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePokedex } from '@/hooks/usePokedex'
import { useWishlist } from '@/hooks/useWishlist'
import { monthOf, spentThisMonth } from '@/lib/budget'
import { isToBuy } from '@/lib/collection'
import { cx } from '@/lib/cx'
import { DEFAULT_FILTERS, filterEntries, pokedexUrl, type CardFilter } from '@/lib/filters'
import {
  details,
  formatDate,
  formatEuro,
  formatInteger,
  pageTitle,
  plural,
  today,
  unlockedOf,
} from '@/lib/format'
import { latePendingOrders } from '@/lib/orders'
import { acquisitions, summarize, type Progress, type RecentCard } from '@/lib/pokedex'
import { gainPercent, tallyByStatus, trackedCards } from '@/lib/prices'
import { cardTitle } from '@/lib/species'
import { underMaxCount, wishlistEstimate } from '@/lib/wishlist'
import { useCollectionStore } from '@/store/collection'
import { usePrices, usePricesMissing } from '@/store/prices'
import { useShoppingStore } from '@/store/shopping'
import styles from './HomePage.module.css'

function progressSentence(progress: Progress) {
  const { unlocked, missing, total } = progress
  if (unlocked === 0) {
    return [
      'Aucun Pokémon débloqué pour l’instant.',
      `Les ${formatInteger(total)} restent à débloquer.`,
    ]
  }
  if (missing === 0)
    return [`Les ${formatInteger(total)} Pokémon sont débloqués.`, 'Le Pokédex est complet.']
  return [
    `${unlockedOf(progress, 'Pokémon')}.`,
    missing === 1
      ? 'Il n’en reste qu’un à débloquer.'
      : `Il en reste ${formatInteger(missing)} à débloquer.`,
  ]
}

function trackingSentence(ordered: number, wanted: number): string | null {
  const orderedText = plural(ordered, 'carte commandée', 'cartes commandées')
  if (ordered > 0 && wanted > 0)
    return `${orderedText}, ${plural(wanted, 'souhaitée', 'souhaitées')}.`
  if (ordered > 0) return `${orderedText}.`
  if (wanted > 0) return `${plural(wanted, 'carte souhaitée', 'cartes souhaitées')}.`
  return null
}

/**
 * L'accueil, un tableau de bord : la progression (en tout, par génération), ce qui attend une
 * action, la valeur et le budget du mois, puis les dernières cartes obtenues. Une collection vide
 * y trouve comment commencer.
 */
export function HomePage() {
  const collection = useCollectionStore((state) => state.collection)
  const obtained = useMemo(() => acquisitions(collection), [collection])
  const started = Object.keys(collection.customCards).length > 0
  const month = monthOf(today())
  const thisMonth = obtained.filter(({ acquiredAt }) => acquiredAt?.startsWith(month)).length

  return (
    <div className="container">
      <title>{pageTitle()}</title>
      <PageHeader
        title="Mon Pokédex"
        actions={
          <>
            <Button asChild variant="secondary" leftIcon={<Layers size={16} />}>
              <Link to="/catalogue">Choisir des cartes</Link>
            </Button>
            <Button asChild leftIcon={<Grid3x3 size={16} />}>
              <Link to="/pokedex">Ouvrir le Pokédex</Link>
            </Button>
          </>
        }
      >
        {thisMonth > 0
          ? `${plural(thisMonth, 'carte obtenue', 'cartes obtenues')} ce mois-ci.`
          : 'Vos cartes Pokémon japonaises, une par Pokémon : choisissez-les, obtenez-les, débloquez le Pokédex.'}
      </PageHeader>

      <div className={styles.dashboard}>
        <ProgressPanel />
        {started ? <TodoPanel /> : <StartPanel />}
        {started && <Indicators />}
        {obtained.length > 0 ? <RecentPanel cards={obtained.slice(0, 6)} /> : started && <Chosen />}
      </div>
    </div>
  )
}

/** La progression : l'anneau, la phrase, et la réglette des générations (une liste sur téléphone). */
function ProgressPanel() {
  const { progress, generations } = usePokedex()
  const collection = useCollectionStore((state) => state.collection)
  const { ordered, wanted } = summarize(collection)
  const [unlockedText, remainingText] = progressSentence(progress)
  const tracking = trackingSentence(ordered, wanted)
  // Sur téléphone, la réglette n'est qu'une image : la liste des régions mène au Pokédex.
  const narrow = useMediaQuery('(max-width: 40rem)')

  return (
    <Panel title="Progression">
      <div className={styles.progress}>
        <RadialProgress
          value={progress.percent}
          size={128}
          thickness={10}
          label="Pokémon débloqués"
          aria-valuetext={unlockedOf(progress)}
        >
          <span className={styles.ring}>
            <span className={cx(styles.ringValue, 'numeric')}>
              {formatInteger(progress.unlocked)}
            </span>
            <span className={styles.ringTotal}>sur {formatInteger(progress.total)}</span>
          </span>
        </RadialProgress>
        <div className={styles.sentence}>
          <p className={styles.lead}>{unlockedText}</p>
          <p className="muted">{remainingText}</p>
          {tracking && <p className="muted">{tracking}</p>}
        </div>
      </div>
      <div inert={narrow}>
        <ProgressRuler generations={generations} />
      </div>
      {narrow && (
        <ul className={styles.regions}>
          {generations.map(({ generation, unlocked, total }) => (
            <li key={generation.id}>
              <Link to={pokedexUrl({ generation: generation.id })} className={styles.region}>
                <span>{generation.region}</span>
                <span className="muted numeric">
                  {formatInteger(unlocked)} sur {formatInteger(total)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

interface Todo {
  key: string
  label: string
  hint: string
  to: string
  icon: ComponentType<IconProps>
  tone?: 'warn' | 'success'
}

/** Les cartes à compléter, comptées par les filtres du Pokédex (la liste y mène). */
const TO_COMPLETE: {
  card: CardFilter
  one: string
  many: string
  hint: string
  icon: Todo['icon']
}[] = [
  {
    card: 'without',
    one: 'Pokémon sans carte',
    many: 'Pokémon sans carte',
    hint: 'Choisissez-leur une carte',
    icon: Layers,
  },
  {
    card: 'no-paid',
    one: 'carte possédée sans prix payé',
    many: 'cartes possédées sans prix payé',
    hint: 'Notez-le pour suivre ce qu’elles vous rapportent',
    icon: Receipt,
  },
  {
    card: 'no-image',
    one: 'carte sans image',
    many: 'cartes sans image',
    hint: 'Corrigez sa référence, ou collez une adresse',
    icon: ImageOff,
  },
  {
    card: 'no-cardmarket',
    one: 'carte sans id Cardmarket',
    many: 'cartes sans id Cardmarket',
    hint: 'Sans lui, pas de prix',
    icon: Unlink,
  },
]

/** Ce qui attend une action : commandes en retard, bonnes affaires, cartes à compléter. */
function TodoPanel() {
  const { entries } = usePokedex()
  const orders = useShoppingStore((state) => state.shopping.orders)
  const { rows } = useWishlist()
  const late = latePendingOrders(orders, today()).length
  const underMax = underMaxCount(rows)
  const toComplete = useMemo(
    () =>
      TO_COMPLETE.map((todo) => ({
        ...todo,
        count: filterEntries(entries, { ...DEFAULT_FILTERS, card: todo.card }).length,
      })),
    [entries],
  )

  const todos: Todo[] = [
    ...(late > 0
      ? [
          {
            key: 'late',
            label: plural(late, 'commande en retard', 'commandes en retard'),
            hint: 'En cours depuis plus de 4 semaines : réclamez-la au vendeur',
            to: '/achats?vue=commandes',
            icon: Clock,
            tone: 'warn' as const,
          },
        ]
      : []),
    ...(underMax > 0
      ? [
          {
            key: 'under-max',
            label: plural(
              underMax,
              'carte sous votre prix maximum',
              'cartes sous votre prix maximum',
            ),
            hint: 'Le prix du marché est passé sous ce que vous vous êtes fixé',
            to: '/achats',
            icon: TrendingDown,
            tone: 'success' as const,
          },
        ]
      : []),
    ...toComplete
      .filter(({ count }) => count > 0)
      .map(({ card, count, one, many, hint, icon }) => ({
        key: card,
        label: plural(count, one, many),
        hint,
        to: pokedexUrl({ card }),
        icon,
      })),
  ]

  return (
    <Panel title="À faire" description="Ce qui attend une action de votre part.">
      {todos.length > 0 ? (
        <ul className={styles.todos}>
          {todos.map(({ key, label, hint, to, icon: Icon, tone }) => (
            <li key={key}>
              <Link to={to} className={styles.todo}>
                <span className={cx(styles.todoIcon, tone && styles[tone])}>
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className={styles.todoText}>
                  <span className={styles.todoLabel}>{label}</span>
                  <span className="hint">{hint}</span>
                </span>
                <ChevronRight size={16} aria-hidden="true" className={styles.todoChevron} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Rien n’attend : vos cartes sont complètes, vos commandes à l’heure.</p>
      )}
    </Panel>
  )
}

/** Une statistique qui mène à sa page. */
function StatLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={styles.statLink}>
      {children}
    </Link>
  )
}

/** Valeur, budget du mois, liste d'achats, commandes en cours : chacun mène à sa page. */
function Indicators() {
  const prices = usePrices()
  const pricesMissing = usePricesMissing()
  const collection = useCollectionStore((state) => state.collection)
  const { orders, budget } = useShoppingStore((state) => state.shopping)
  const { rows, taken } = useWishlist()
  const owned = useMemo(
    () => tallyByStatus(trackedCards(collection, prices)).owned,
    [collection, prices],
  )
  const spent = spentThisMonth(orders)
  const estimate = wishlistEstimate(rows, taken)
  const pending = orders.filter((order) => order.state === 'pending').length
  const late = latePendingOrders(orders, today()).length

  return (
    <div className={cx('stat-grid', styles.wide)}>
      <StatLink to="/valeur">
        <Stat
          label="Valeur de ma collection"
          icon={<STATUS_ICONS.owned size={18} />}
          value={
            prices ? (
              formatEuro(owned.value)
            ) : pricesMissing ? (
              '—'
            ) : (
              <Skeleton width="7rem" height="1.75rem" />
            )
          }
          delta={prices ? gainPercent(owned.paidCardsValue, owned.paid) : undefined}
          deltaSuffix={'\u00a0%'}
          hint={
            pricesMissing
              ? 'Prix indisponibles pour le moment'
              : details(
                  plural(owned.count, 'carte possédée', 'cartes possédées'),
                  owned.paid > 0 && `payées ${formatEuro(owned.paid)}`,
                )
          }
        />
      </StatLink>
      <StatLink to="/achats?vue=budget">
        <Stat
          label="Dépensé ce mois-ci"
          icon={<Wallet size={18} />}
          value={formatEuro(spent)}
          hint={<BudgetMeter spent={spent} budget={budget} />}
        />
      </StatLink>
      <StatLink to="/achats">
        <Stat
          label="Liste d’achats"
          icon={<ListChecks size={18} />}
          value={plural(rows.filter(isToBuy).length, 'carte', 'cartes')}
          hint={details(
            prices && `environ ${formatEuro(estimate.value)}`,
            estimate.unpriced > 0 && `${formatInteger(estimate.unpriced)} sans prix`,
          )}
        />
      </StatLink>
      <StatLink to="/achats?vue=commandes">
        <Stat
          label="Commandes en cours"
          icon={<Package size={18} />}
          value={formatInteger(pending)}
          hint={late > 0 ? `dont ${formatInteger(late)} en retard` : 'Aucune en retard'}
        />
      </StatLink>
    </div>
  )
}

/** Les dernières cartes obtenues, « distribuées » une à une à l'arrivée. */
function RecentPanel({ cards }: { cards: RecentCard[] }) {
  return (
    <Panel
      title="Dernières cartes obtenues"
      className={styles.wide}
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link to={pokedexUrl({ possession: 'owned' })}>Voir les Pokémon débloqués</Link>
        </Button>
      }
    >
      <ul className={styles.cards}>
        {cards.map((recent, index) => {
          const speciesId = recent.card.dexIds[0]!
          const date = formatDate(recent.acquiredAt)
          return (
            <li
              key={recent.card.id}
              className={styles.dealt}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <Link to={`/pokemon/${speciesId}`} className={styles.card}>
                <CardArt card={recent.card} speciesId={speciesId} alt="" eager />
                <span className={styles.cardName}>{cardTitle(recent.card)}</span>
                <span className="hint">{date ? `Obtenue le ${date}` : recent.card.reference}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/** Aucune carte obtenue, mais des cartes choisies : les premières, à obtenir. */
function Chosen() {
  const { entries } = usePokedex()
  const chosen = entries.filter((entry) => entry.card?.card.image).slice(0, 6)
  if (chosen.length === 0) return null
  return (
    <Panel
      title="Vos cartes choisies"
      description="Marquez-les « possédées » quand vous les avez : leur Pokémon est débloqué."
      className={styles.wide}
    >
      <ul className={styles.cards}>
        {chosen.map(({ species, card }) => (
          <li key={species.id}>
            <Link to={`/pokemon/${species.id}`} className={styles.card}>
              <CardArt card={card!.card} speciesId={species.id} alt="" locked eager />
              <span className={styles.cardName}>{species.names.fr}</span>
              <span className="hint">{card!.card.reference}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** Une collection vide : les trois temps de l'app, et par où commencer. */
function StartPanel() {
  return (
    <Panel
      title="Pour commencer"
      description="Trois temps, à votre rythme."
      actions={
        <Button asChild variant="ghost" size="sm" leftIcon={<WalletCards size={14} />}>
          <Link to="/donnees#favori">Installer le favori Cardmarket</Link>
        </Button>
      }
    >
      <Steps
        orientation="vertical"
        current={0}
        steps={[
          {
            label: 'Choisissez vos cartes',
            description:
              'Pour chaque Pokémon, la carte japonaise que vous voulez : extension par extension dans le catalogue, ou depuis sa fiche.',
          },
          {
            label: 'Marquez celles que vous avez',
            description: '« Je possède cette carte » débloque son Pokémon.',
          },
          {
            label: 'Préparez vos achats',
            description:
              'Les autres vont dans la liste d’achats, avec un prix maximum : l’app vous dit quand le marché passe dessous.',
          },
        ]}
      />
      <div>
        <Button asChild leftIcon={<Layers size={16} />}>
          <Link to="/catalogue">Choisir dans le catalogue</Link>
        </Button>
      </div>
    </Panel>
  )
}
