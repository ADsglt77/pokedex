import { Button, EmptyState, Input, Modal, SegmentedControl } from '@camply/ui'
import { ArrowLeftRight, Search } from '@camply/ui/icons'
import { startTransition, useDeferredValue, useMemo, useRef, useState, type RefObject } from 'react'
import { useGrowingList } from '@/hooks/useGrowingList'
import type { SetSummary } from '@/lib/card-catalog'
import { searchForm } from '@/lib/filters'
import { details, plural } from '@/lib/format'
import { SetLogo } from './SetLogo'
import styles from './SetPicker.module.css'

const SET_ORDERS = [
  { value: 'recent', label: 'Par année' },
  { value: 'block', label: 'Par bloc' },
] as const

type SetOrder = (typeof SET_ORDERS)[number]['value']

const ORDER_HINTS: Record<SetOrder, string> = {
  recent: 'Des plus récentes aux plus anciennes, année par année.',
  block: 'Bloc par bloc, des plus récents aux plus anciens : leurs extensions, puis leurs decks.',
}

/** Les extensions dessinées d'un coup : plus qu'un grand écran n'en montre. */
const SETS_STEP = 40

/**
 * La fenêtre du choix d'une extension : leurs logos japonais, cherchées par code ou par nom
 * (« sv2a », « 151 »), rangées par année ou par bloc (l'ordre choisi reste d'une ouverture à
 * l'autre), chacune avec son nombre de cartes. Pleine page : la recherche reste en haut quand la
 * liste défile. Le bouton « Changer d'extension » qui l'ouvre est ici, avec son état : l'ouvrir ne
 * fait pas redessiner la page et ses cartes.
 */
export function SetPicker({
  className,
  onPick,
  ...list
}: {
  /** Celle du bouton. */
  className?: string
  /** Des plus récentes aux plus anciennes. */
  sets: SetSummary[]
  /** Les blocs, des plus récents aux plus anciens. */
  blocks: string[]
  current: string
  onPick: (setId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [order, setOrder] = useState<SetOrder>('recent')
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
        <SetList {...list} order={order} onOrder={setOrder} field={field} onPick={pick} />
      </Modal>
    </>
  )
}

/** Le contenu de la fenêtre : sa recherche repart de zéro à chaque ouverture. */
function SetList({
  sets,
  blocks,
  current,
  order,
  onOrder,
  onPick,
  field,
}: Omit<Parameters<typeof SetPicker>[0], 'className'> & {
  order: SetOrder
  onOrder: (order: SetOrder) => void
  field: RefObject<HTMLInputElement | null>
}) {
  const [query, setQuery] = useState('')
  // La liste suit la frappe sans la ralentir : plus de 400 extensions à refaire.
  const search = searchForm(useDeferredValue(query))

  const searchable = useMemo(
    () => new Map(sets.map(({ id, name }) => [id, searchForm(`${id} ${name}`)])),
    [sets],
  )
  // Par bloc : dans l'ordre des blocs (ceux sans bloc à la fin), leurs extensions puis leurs
  // decks, chacun des plus récents aux plus anciens (l'ordre reçu).
  const ordered = useMemo(() => {
    if (order === 'recent') return sets
    const rank = (set: SetSummary) =>
      set.block === null ? blocks.length : blocks.indexOf(set.block)
    return [...sets].sort((a, b) => rank(a) - rank(b) || Number(a.deck) - Number(b.deck))
  }, [sets, blocks, order])
  const found = search ? ordered.filter((set) => searchable.get(set.id)!.includes(search)) : ordered
  // Plus de 400 extensions : dessinées au fur et à mesure du défilement, la fenêtre s'ouvre et se
  // ferme vite.
  const { limit, sentinel, more } = useGrowingList(found.length, SETS_STEP)
  const groups = new Map<string, SetSummary[]>()
  for (const set of found.slice(0, limit)) {
    const key = order === 'recent' ? (set.year ?? 'Sans date') : (set.block ?? 'Hors des blocs')
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
        {/* Le nombre d'extensions trouvées, annoncé à chaque frappe (présent dès le premier rendu). */}
        <p className="visually-hidden" aria-live="polite">
          {plural(found.length, 'extension trouvée', 'extensions trouvées')}
        </p>
      </div>
      {found.length === 0 ? (
        <EmptyState
          icon={<Search size={22} />}
          title="Aucune extension ne correspond"
          description="Cherchez son code (SV2a) ou un mot de son nom (151)."
        />
      ) : (
        <div className={styles.results}>
          {[...groups].map(([title, list]) => (
            <section key={title} className={styles.group}>
              <h3 className={styles.heading}>{title}</h3>
              <ul className={styles.sets}>
                {list.map((set) => (
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
                      <span className={styles.count}>
                        {details(plural(set.count, 'carte', 'cartes'), set.deck && 'deck')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {more && <span ref={sentinel} className="growing-sentinel" aria-hidden="true" />}
        </div>
      )}
    </div>
  )
}
