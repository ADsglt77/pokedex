import { Button, EmptyState, Input, Modal, SegmentedControl } from '@camply/ui'
import { ArrowLeftRight, Search } from '@camply/ui/icons'
import {
  startTransition,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { useGrowingList } from '@/hooks/useGrowingList'
import type { CatalogSet } from '@/lib/card-catalog'
import { searchForm } from '@/lib/filters'
import { details, formatInteger } from '@/lib/format'
import { SetLogo } from './SetLogo'
import styles from './SetPicker.module.css'

const SET_ORDERS = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'useful', label: 'Plus utiles' },
  { value: 'advanced', label: 'Plus avancées' },
] as const

export type SetOrder = (typeof SET_ORDERS)[number]['value']

const ORDER_HINTS: Record<SetOrder, string> = {
  recent: 'Des plus récentes aux plus anciennes, année par année.',
  useful: 'Celles qui donnent leur carte au plus de vos Pokémon qui n’en ont pas.',
  advanced: 'Celles dont la plus grande part des Pokémon a déjà sa carte.',
}

/** Les extensions dessinées d'un coup : plus qu'un grand écran n'en montre. */
const SETS_STEP = 40

/** Combien des Pokémon d'une extension ont leur carte, sur tous les siens. */
export interface SetCoverage {
  covered: number
  total: number
}

/**
 * La fenêtre du choix d'une extension : leurs logos japonais, cherchées par code ou par nom
 * (« sv2a », « 151 »), dans l'ordre choisi (`order` : les plus récentes, rangées par année, les plus
 * utiles ou les plus avancées), chacune avec la part de ses Pokémon qui ont déjà leur carte. Pleine
 * page : la recherche reste en haut quand la liste défile. Le bouton « Changer d'extension » qui
 * l'ouvre est ici, avec son état : l'ouvrir ne fait pas redessiner la page et ses cartes.
 */
export function SetPicker({
  className,
  onPick,
  ...list
}: {
  /** Celle du bouton. */
  className?: string
  /** Dans l'ordre `order`. */
  sets: CatalogSet[]
  order: SetOrder
  onOrder: (order: SetOrder) => void
  current: string
  coverage: (setId: string) => SetCoverage
  onPick: (setId: string) => void
}) {
  const [open, setOpen] = useState(false)
  // La recherche prend le focus à l'ouverture, pour taper tout de suite.
  const field = useRef<HTMLInputElement>(null)
  const pick = (setId: string) => {
    setOpen(false)
    onPick(setId)
  }
  return (
    <>
      <Button
        variant="secondary"
        leftIcon={<ArrowLeftRight size={16} />}
        onClick={() => setOpen(true)}
        className={className}
      >
        Changer d’extension
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Choisir une extension"
        size="full"
        initialFocus={field}
      >
        <SetList {...list} field={field} onPick={pick} />
      </Modal>
    </>
  )
}

/** Le contenu de la fenêtre : sa recherche repart de zéro à chaque ouverture. */
function SetList({
  sets,
  order,
  onOrder,
  current,
  coverage,
  onPick,
  field,
}: Omit<Parameters<typeof SetPicker>[0], 'className'> & {
  field: RefObject<HTMLInputElement | null>
}) {
  const [query, setQuery] = useState('')
  // La liste suit la frappe sans la ralentir : plus de 400 extensions à refaire.
  const search = searchForm(useDeferredValue(query))

  const searchable = useMemo(
    () => new Map(sets.map(({ id, name }) => [id, searchForm(`${id} ${name}`)])),
    [sets],
  )
  const found = search ? sets.filter((set) => searchable.get(set.id)!.includes(search)) : sets
  // Plus de 400 extensions : dessinées au fur et à mesure du défilement, la fenêtre s'ouvre et se
  // ferme vite.
  const { limit, sentinel, more } = useGrowingList(found.length, SETS_STEP)
  // Les plus récentes, rangées par année ; les autres ordres, d'un seul tenant.
  const groups = new Map<string, CatalogSet[]>()
  for (const set of found.slice(0, limit)) {
    const key = order === 'recent' ? (set.year ?? 'Sans date') : ''
    const list = groups.get(key)
    if (list) list.push(set)
    else groups.set(key, [set])
  }

  return (
    <div className={styles.picker}>
      <div className={styles.controls}>
        <Input
          type="search"
          label="Rechercher"
          placeholder="Code ou nom : SV2a, 151…"
          leftIcon={<Search size={16} />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          ref={field}
          spellCheck={false}
          autoComplete="off"
        />
        <SegmentedControl
          aria-label="Ordre des extensions"
          size="sm"
          fullWidth
          options={[...SET_ORDERS]}
          value={order}
          // Toutes les tuiles changent de place : en arrière-plan, sans figer le bouton.
          onChange={(next) => startTransition(() => onOrder(next))}
        />
        <p className="hint">{ORDER_HINTS[order]}</p>
      </div>
      {found.length === 0 ? (
        <EmptyState
          icon={<Search size={22} />}
          title="Aucune extension ne correspond"
          description="Cherchez son code (SV2a) ou un mot de son nom (151)."
        />
      ) : (
        <div className={styles.results}>
          {[...groups].map(([year, list]) => (
            <section key={year} className={styles.group}>
              {year && <h3 className={styles.year}>{year}</h3>}
              <ul className={styles.sets}>
                {list.map((set) => {
                  const { covered, total } = coverage(set.id)
                  return (
                    <li key={set.id}>
                      <button
                        type="button"
                        className={styles.set}
                        aria-current={set.id === current || undefined}
                        onClick={() => onPick(set.id)}
                      >
                        <SetLogo set={set} size="md" className={styles.logo} />
                        <span className={styles.name}>{set.name}</span>
                        <span className={styles.meta}>{details(set.id, set.year)}</span>
                        <span className={styles.coverage}>
                          <span
                            className={styles.bar}
                            style={{ '--covered': total ? covered / total : 0 } as CSSProperties}
                            aria-hidden="true"
                          />
                          <span className="numeric">
                            {formatInteger(covered)} / {formatInteger(total)}
                          </span>
                          <span className="visually-hidden"> Pokémon ont leur carte</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {more && <span ref={sentinel} className="growing-sentinel" aria-hidden="true" />}
        </div>
      )}
    </div>
  )
}
