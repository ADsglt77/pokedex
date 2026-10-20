import {
  ChevronRight,
  Clock,
  ImageOff,
  Layers,
  Receipt,
  Unlink,
  type IconProps,
} from '@camply/ui/icons'
import type { ComponentType } from 'react'
import { Link } from 'react-router'
import { Panel } from '@/components/Panel'
import { usePokedex } from '@/hooks/usePokedex'
import { cx } from '@/lib/cx'
import {
  DEFAULT_FILTERS,
  filterEntries,
  pokedexUrl,
  shoppingUrl,
  type CardFilter,
} from '@/lib/filters'
import { plural, today } from '@/lib/format'
import { LATE_AFTER_DAYS, latePendingOrders } from '@/lib/orders'
import { useShoppingStore } from '@/store/shopping'
import styles from './TodoPanel.module.css'

interface Todo {
  key: string
  label: string
  hint: string
  to: string
  icon: ComponentType<IconProps>
  /** Une alerte (commandes en retard), pas une simple tâche. */
  warn?: boolean
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
export function TodoPanel() {
  const { entries } = usePokedex()
  const orders = useShoppingStore((state) => state.shopping.orders)
  const late = latePendingOrders(orders, today()).length
  const todos: Todo[] = TO_COMPLETE.flatMap(({ card, one, many, hint, icon }) => {
    // Une carte TAG TEAM compte une fois, pas une fois par Pokémon.
    const count = new Set(
      filterEntries(entries, { ...DEFAULT_FILTERS, card }).map(
        ({ species, card }) => card?.card.id ?? species.id,
      ),
    ).size
    return count > 0
      ? [
          {
            key: card,
            label: plural(count, one, many),
            hint: hint[count === 1 ? 0 : 1],
            to: pokedexUrl({ card }),
            icon,
          },
        ]
      : []
  })
  if (late > 0) {
    todos.unshift({
      key: 'late',
      label: plural(late, 'commande en retard', 'commandes en retard'),
      hint:
        late === 1
          ? `En cours depuis plus de ${LATE_AFTER_DAYS} jours : réclamez-la au vendeur`
          : `En cours depuis plus de ${LATE_AFTER_DAYS} jours : réclamez-les aux vendeurs`,
      to: shoppingUrl({ view: 'commandes' }),
      icon: Clock,
      warn: true,
    })
  }

  return (
    <Panel title="À faire" description="Ce qui attend une action de votre part.">
      {todos.length > 0 ? (
        <ul className={styles.todos}>
          {todos.map(({ key, label, hint, to, icon: Icon, warn }) => (
            <li key={key}>
              <Link to={to} className={styles.todo}>
                <span className={cx(styles.todoIcon, warn && styles.warn)}>
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
