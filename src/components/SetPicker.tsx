import {
  Badge,
  Button,
  EmptyState,
  Input,
  Modal,
  SegmentedControl,
  Skeleton,
  Stack,
  type ButtonVariant,
} from '@camply/ui'
import { Search } from '@camply/ui/icons'
import {
  startTransition,
  Suspense,
  use,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { SetLogo } from '@/components/SetLogo'
import { Unavailable } from '@/components/Unavailable'
import { useGrowingList } from '@/hooks/useGrowingList'
import { useRetry } from '@/hooks/useRetry'
import { catalogSetsUrl, loadSets, type SetSummary } from '@/lib/card-catalog'
import { searchForm } from '@/lib/filters'
import { details, plural } from '@/lib/format'
import type { CardLanguage } from '@/types'
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

/** Un code d'extension de chaque langue, pour l'exemple de la recherche. */
const EXAMPLE_CODES: Record<CardLanguage, string> = { ja: 'SV2a', fr: 'MEG' }

/** Les extensions dessinées d'un coup : plus qu'un grand écran n'en montre. */
const SETS_STEP = 40

/** Ce que la fenêtre montre des extensions d'une langue, et ce qu'en fait un choix. */
interface SetListProps {
  /** Leur langue : celle de leurs cartes. */
  language: CardLanguage
  /** Avec lui, l'interrupteur de la langue en haut de la fenêtre (la page Collections). */
  onLanguage?: (language: CardLanguage) => void
  /** L'extension montrée (le Catalogue), marquée dans la liste. */
  current?: string
  /** Les codes des extensions de cette langue dont la collection est commencée : « Commencée ». */
  started?: ReadonlySet<string>
  onPick: (set: SetSummary) => void
}

/**
 * La fenêtre du choix d'une extension : leurs logos, cherchées par code ou par nom (« sv2a » ou
 * « meg », « 151 »), rangées par année ou par bloc (l'ordre choisi reste d'une ouverture à
 * l'autre), chacune avec son nombre de cartes, lues dans le catalogue de leur langue
 * (`loadSets` : déjà là pour le Catalogue). Pleine page : la recherche reste en haut quand la liste
 * défile. Le bouton qui l'ouvre est ici, avec son état (« Changer d'extension » au Catalogue,
 * « Nouvelle collection » aux Collections) : l'ouvrir ne fait pas redessiner la page.
 */
export function SetPicker({
  label,
  icon,
  variant = 'secondary',
  loading = false,
  onPick,
  ...list
}: SetListProps & {
  /** Le texte du bouton qui ouvre la fenêtre, et son icône. */
  label: string
  icon: ReactNode
  variant?: ButtonVariant
  /** Le choix est en cours (ses cartes en route) : le bouton attend, la fenêtre ne s'ouvre pas. */
  loading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [order, setOrder] = useState<SetOrder>('recent')
  // La recherche prend le focus à l'ouverture, pour taper tout de suite.
  const field = useRef<HTMLInputElement>(null)
  const pick = (set: SetSummary) => {
    setOpen(false)
    onPick(set)
  }
  return (
    <>
      <Button variant={variant} leftIcon={icon} loading={loading} onClick={() => setOpen(true)}>
        {label}
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

/**
 * Le contenu de la fenêtre : sa recherche repart de zéro à chaque ouverture, et reste quand la
 * langue change ; les extensions arrivent dessous (`SetResults`).
 */
function SetList({
  onLanguage,
  order,
  onOrder,
  field,
  ...results
}: SetListProps & {
  order: SetOrder
  onOrder: (order: SetOrder) => void
  field: RefObject<HTMLInputElement | null>
}) {
  const [query, setQuery] = useState('')
  // La liste suit la frappe sans la ralentir : plus de 400 extensions à refaire.
  const search = searchForm(useDeferredValue(query))
  const { language } = results

  return (
    <div className={styles.picker}>
      <div className={styles.controls}>
        {onLanguage && (
          // En rangée : le segment ne s'étire pas sur la largeur.
          <Stack direction="horizontal">
            <LanguageSwitch value={language} onChange={onLanguage} />
          </Stack>
        )}
        <Input
          type="search"
          label="Rechercher"
          placeholder={`Code ou nom : ${EXAMPLE_CODES[language]}, 151…`}
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
      <Suspense fallback={<SetsSkeleton />}>
        <SetResults {...results} search={search} order={order} />
      </Suspense>
    </div>
  )
}

/** L'ébauche des extensions tant qu'elles arrivent (une autre langue, aux Collections). */
function SetsSkeleton() {
  return (
    <div className={styles.group}>
      <p className="visually-hidden">Chargement des extensions…</p>
      <ul className={styles.sets} aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <li key={index}>
            <Skeleton variant="rect" height="8rem" />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Les extensions trouvées, par année ou par bloc ; « Réessayer » si elles manquent. */
function SetResults({
  language,
  current,
  started,
  onPick,
  search,
  order,
}: Omit<SetListProps, 'onLanguage'> & { search: string; order: SetOrder }) {
  const retry = useRetry(catalogSetsUrl(language))
  const catalog = use(loadSets(language))
  const searchable = useMemo(
    () => new Map(catalog?.sets.map(({ id, name }) => [id, searchForm(`${id} ${name}`)])),
    [catalog],
  )
  // Par bloc : dans l'ordre des blocs (ceux sans bloc à la fin), leurs extensions puis leurs
  // decks, chacun des plus récents aux plus anciens (l'ordre reçu).
  const ordered = useMemo(() => {
    if (!catalog) return []
    const { sets, blocks } = catalog
    if (order === 'recent') return sets
    const rank = (set: SetSummary) =>
      set.block === null ? blocks.length : blocks.indexOf(set.block)
    return [...sets].sort((a, b) => rank(a) - rank(b) || Number(a.deck) - Number(b.deck))
  }, [catalog, order])
  const found = search ? ordered.filter((set) => searchable.get(set.id)!.includes(search)) : ordered
  // Plus de 400 extensions : dessinées au fur et à mesure du défilement, la fenêtre s'ouvre et se
  // ferme vite.
  const { limit, sentinel, more } = useGrowingList(found.length, SETS_STEP)

  if (!catalog) {
    return (
      <Unavailable
        headingLevel={3}
        title="Les extensions ne sont pas disponibles pour le moment"
        retry={retry}
      />
    )
  }

  const groups = new Map<string, SetSummary[]>()
  for (const set of found.slice(0, limit)) {
    const key = order === 'recent' ? (set.year ?? 'Sans date') : (set.block ?? 'Hors des blocs')
    const list = groups.get(key)
    if (list) list.push(set)
    else groups.set(key, [set])
  }

  return (
    <>
      {/* Le nombre d'extensions trouvées, annoncé à chaque frappe. */}
      <p className="visually-hidden" aria-live="polite">
        {plural(found.length, 'extension trouvée', 'extensions trouvées')}
      </p>
      {found.length === 0 ? (
        <EmptyState
          icon={<Search size={22} />}
          title="Aucune extension ne correspond"
          description={`Cherchez son code (${EXAMPLE_CODES[language]}) ou un mot de son nom (151).`}
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
                      onClick={() => onPick(set)}
                    >
                      <SetLogo set={set} size="md" className={styles.logo} />
                      <span className={styles.name}>{set.name}</span>
                      <span className={styles.meta}>{details(set.id, set.year)}</span>
                      <span className={styles.count}>
                        {details(plural(set.count, 'carte', 'cartes'), set.deck && 'deck')}
                        {started?.has(set.id) && (
                          <Badge size="sm" tone="success">
                            Commencée
                          </Badge>
                        )}
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
    </>
  )
}
