import { EmptyState, Input, Modal, SegmentedControl } from '@camply/ui'
import { Search } from '@camply/ui/icons'
import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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

/** Combien des Pokémon d'une extension ont leur carte, sur tous les siens. */
export interface SetCoverage {
  covered: number
  total: number
}

/**
 * La fenêtre du choix d'une extension : leurs logos japonais, cherchées par code ou par nom
 * (« sv2a », « 151 »), dans l'ordre choisi (`order` : les plus récentes, rangées par année, les plus
 * utiles ou les plus avancées), chacune avec la part de ses Pokémon qui ont déjà leur carte.
 */
export function SetPicker({
  open,
  onClose,
  sets,
  order,
  onOrder,
  current,
  coverage,
  onPick,
}: {
  open: boolean
  onClose: () => void
  /** Dans l'ordre `order`. */
  sets: CatalogSet[]
  order: SetOrder
  onOrder: (order: SetOrder) => void
  current: string
  coverage: (setId: string) => SetCoverage
  onPick: (setId: string) => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="Choisir une extension" size="lg">
      <SetList
        sets={sets}
        order={order}
        onOrder={onOrder}
        current={current}
        coverage={coverage}
        onPick={onPick}
      />
    </Modal>
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
}: Omit<Parameters<typeof SetPicker>[0], 'open' | 'onClose'>) {
  const [query, setQuery] = useState('')
  const field = useRef<HTMLInputElement>(null)
  // La fenêtre donne le focus à son premier bouton (« Fermer ») après ce rendu : la recherche le
  // prend juste après, pour taper tout de suite.
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])
  // La liste suit la frappe sans la ralentir : plus de 400 extensions à refaire.
  const search = searchForm(useDeferredValue(query))
  const searchable = useMemo(
    () => new Map(sets.map(({ id, name }) => [id, searchForm(`${id} ${name}`)])),
    [sets],
  )
  const found = search ? sets.filter((set) => searchable.get(set.id)!.includes(search)) : sets
  // Les plus récentes, rangées par année ; les autres ordres, d'un seul tenant.
  const groups = new Map<string, CatalogSet[]>()
  for (const set of found) {
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
          options={[...SET_ORDERS]}
          value={order}
          onChange={onOrder}
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
        [...groups].map(([year, list]) => (
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
        ))
      )}
    </div>
  )
}
