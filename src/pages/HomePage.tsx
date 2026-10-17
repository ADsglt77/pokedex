import { Button, RadialProgress, Stat, Steps } from '@camply/ui'
import {
  ChevronRight,
  Clock,
  Grid3x3,
  ImageOff,
  Layers,
  Package,
  Receipt,
  Unlink,
  type IconProps,
} from '@camply/ui/icons'
import { useMemo, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CardArt } from '@/components/CardArt'
import { PageHeader } from '@/components/PageHeader'
import { Panel } from '@/components/Panel'
import { CollectionValueStat } from '@/components/CollectionValueStat'
import { ProgressRuler } from '@/components/ProgressRuler'
import { RegionList } from '@/components/RegionList'
import { SpentThisMonthStat, WishlistStat } from '@/components/ShoppingStats'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePokedex } from '@/hooks/usePokedex'
import { monthOf } from '@/lib/budget'
import { cx } from '@/lib/cx'
import {
  DEFAULT_FILTERS,
  filterEntries,
  pokedexUrl,
  shoppingUrl,
  speciesPath,
  type CardFilter,
} from '@/lib/filters'
import {
  formatDate,
  formatInteger,
  localDayOf,
  pageTitle,
  plural,
  today,
  unlockedOf,
} from '@/lib/format'
import { LATE_AFTER_DAYS, latePendingOrders, pendingCount } from '@/lib/orders'
import { acquisitions, summarize, type Progress, type RecentCard } from '@/lib/pokedex'
import { cardTitle } from '@/lib/species'
import { useCollectionStore } from '@/store/collection'
import { useShoppingStore } from '@/store/shopping'
import type { PokemonCard } from '@/types'
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

/** Les cartes de la rangée de l'accueil : le panneau en montre autant que sa largeur en tient. */
const SHOWN_CARDS = 10

/**
 * L'accueil, un tableau de bord : la progression (en tout, par génération), ce qui attend une
 * action, la valeur et le budget du mois, puis les dernières cartes obtenues. Une collection vide
 * y trouve comment commencer.
 */
export function HomePage() {
  const collection = useCollectionStore((state) => state.collection)
  const hasOrders = useShoppingStore((state) => state.shopping.orders.length > 0)
  const obtained = useMemo(() => acquisitions(collection), [collection])
  // Des cartes, ou des commandes (gardées par « Effacer ma collection ») : « À faire » les suit.
  const started = Object.keys(collection.customCards).length > 0 || hasOrders
  const month = monthOf(today())
  const thisMonth = obtained.filter(
    ({ acquiredAt }) => acquiredAt && monthOf(localDayOf(acquiredAt)) === month,
  ).length

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
        {obtained.length > 0 ? (
          <RecentPanel cards={obtained.slice(0, SHOWN_CARDS)} />
        ) : (
          started && <Chosen />
        )}
      </div>
    </div>
  )
}

/** La progression : l'anneau, la phrase, et la réglette des générations (une liste sur téléphone). */
function ProgressPanel() {
  const { progress, generations } = usePokedex()
  const collection = useCollectionStore((state) => state.collection)
  const { ordered } = summarize(collection)
  const [unlockedText, remainingText] = progressSentence(progress)
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
            <span className="hint">sur {formatInteger(progress.total)}</span>
          </span>
        </RadialProgress>
        <div className={styles.sentence}>
          <p className={styles.lead}>{unlockedText}</p>
          <p className="muted">{remainingText}</p>
          {ordered > 0 && (
            <p className="muted">{plural(ordered, 'carte commandée', 'cartes commandées')}.</p>
          )}
        </div>
      </div>
      <div inert={narrow} className={styles.ruler}>
        <ProgressRuler generations={generations} />
      </div>
      {narrow && <RegionList generations={generations} linked />}
    </Panel>
  )
}

interface Todo {
  key: string
  label: string
  hint: string
  to: string
  icon: ComponentType<IconProps>
  tone?: 'warn'
}

/** Les cartes à compléter, comptées par les filtres du Pokédex (la liste y mène). */
const TO_COMPLETE: {
  card: CardFilter
  one: string
  many: string
  /** Le conseil, au singulier et au pluriel. */
  hint: [string, string]
  icon: Todo['icon']
}[] = [
  {
    card: 'without',
    one: 'Pokémon sans carte',
    many: 'Pokémon sans carte',
    hint: ['Choisissez-lui une carte', 'Choisissez-leur une carte'],
    icon: Layers,
  },
  {
    card: 'no-paid',
    one: 'carte possédée sans prix payé',
    many: 'cartes possédées sans prix payé',
    hint: [
      'Notez-le pour suivre ce qu’elle vous rapporte',
      'Notez-les pour suivre ce qu’elles vous rapportent',
    ],
    icon: Receipt,
  },
  {
    card: 'no-image',
    one: 'carte sans image',
    many: 'cartes sans image',
    hint: [
      'Corrigez sa référence, ou collez une adresse',
      'Corrigez leur référence, ou collez une adresse',
    ],
    icon: ImageOff,
  },
  {
    card: 'no-cardmarket',
    one: 'carte sans id Cardmarket',
    many: 'cartes sans id Cardmarket',
    hint: ['Sans lui, pas de prix', 'Sans lui, pas de prix'],
    icon: Unlink,
  },
]

/** Ce qui attend une action : commandes en retard, cartes à compléter. */
function TodoPanel() {
  const { entries } = usePokedex()
  const orders = useShoppingStore((state) => state.shopping.orders)
  const late = latePendingOrders(orders, today()).length
  const toComplete = useMemo(
    () =>
      TO_COMPLETE.map((todo) => ({
        ...todo,
        // Une carte TAG TEAM compte une fois, pas une fois par Pokémon.
        count: new Set(
          filterEntries(entries, { ...DEFAULT_FILTERS, card: todo.card }).map(
            ({ species, card }) => card?.card.id ?? species.id,
          ),
        ).size,
      })),
    [entries],
  )

  const todos: Todo[] = [
    ...(late > 0
      ? [
          {
            key: 'late',
            label: plural(late, 'commande en retard', 'commandes en retard'),
            hint:
              late === 1
                ? `En cours depuis plus de ${LATE_AFTER_DAYS} jours : réclamez-la au vendeur`
                : `En cours depuis plus de ${LATE_AFTER_DAYS} jours : réclamez-les aux vendeurs`,
            to: shoppingUrl({ view: 'commandes' }),
            icon: Clock,
            tone: 'warn' as const,
          },
        ]
      : []),
    ...toComplete
      .filter(({ count }) => count > 0)
      .map(({ card, count, one, many, hint, icon }) => ({
        key: card,
        label: plural(count, one, many),
        hint: hint[count === 1 ? 0 : 1],
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
  const orders = useShoppingStore((state) => state.shopping.orders)
  const late = latePendingOrders(orders, today()).length

  return (
    <div className={cx('stat-grid', styles.wide)}>
      <StatLink to="/valeur">
        <CollectionValueStat label="Valeur de ma collection" />
      </StatLink>
      <StatLink to={shoppingUrl({ view: 'budget' })}>
        <SpentThisMonthStat />
      </StatLink>
      <StatLink to={shoppingUrl()}>
        <WishlistStat />
      </StatLink>
      <StatLink to={shoppingUrl({ view: 'commandes' })}>
        <Stat
          label="Commandes en cours"
          icon={<Package size={18} />}
          value={formatInteger(pendingCount(orders))}
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
              <CardLink
                card={recent.card}
                speciesId={speciesId}
                name={cardTitle(recent.card)}
                hint={date ? `Obtenue le ${date}` : recent.card.reference}
              />
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/** Une carte de l'accueil, qui mène à la fiche de son Pokémon ; `locked` : pas encore obtenue. */
function CardLink({
  card,
  speciesId,
  name,
  hint,
  locked,
}: {
  card: PokemonCard
  speciesId: number
  name: string
  hint: string
  locked?: boolean
}) {
  return (
    <Link to={speciesPath(speciesId)} className={styles.card}>
      <CardArt card={card} speciesId={speciesId} alt="" locked={locked} eager />
      <span className={styles.cardName}>{name}</span>
      <span className="hint">{hint}</span>
    </Link>
  )
}

/** Aucune carte obtenue, mais des cartes choisies : les premières, à obtenir. */
function Chosen() {
  const { entries } = usePokedex()
  const chosen = entries.filter((entry) => entry.card?.card.image).slice(0, SHOWN_CARDS)
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
            <CardLink
              card={card!.card}
              speciesId={species.id}
              name={species.names.fr}
              hint={card!.card.reference}
              locked
            />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/** Une collection vide : les trois temps de l'app, et par où commencer. */
function StartPanel() {
  return (
    <Panel title="Pour commencer" description="Trois temps, à votre rythme.">
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
              'Les autres forment votre liste d’achats : l’assistant prépare votre prochaine commande dans votre budget.',
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
