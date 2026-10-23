import { Button, Modal, Stack, Textarea } from '@camply/ui'
import { Copy } from '@camply/ui/icons'
import { Suspense, use, useId, useRef, useState, useTransition } from 'react'
import { CardmarketLink } from '@/components/CardmarketLink'
import { Unavailable } from '@/components/Unavailable'
import { useNotify } from '@/hooks/useNotify'
import { loadWantsLines } from '@/lib/api'
import { copyText } from '@/lib/clipboard'
import { cardLanguage } from '@/lib/collection'
import { plural } from '@/lib/format'
import type { CardLanguage, PokemonCard, WantsLines } from '@/types'
import { CardLine } from './CardLine'
import page from './ShoppingPage.module.css'

/** Une carte reliée à Cardmarket : son id, d'où sa ligne. */
type Linked = PokemonCard & { cardmarket: number }

/**
 * « Copier pour Cardmarket » : les cartes de la prochaine commande en lignes pour « Ajouter une
 * deck list » d'une liste de souhaits Cardmarket (`/api/wants`, de l'API des données), que l'utilisateur
 * colle lui-même avant le Shopping Wizard : l'app n'envoie rien à Cardmarket. Les lignes sont par
 * langue, un bloc chacune (une ligne ne porte pas la langue : la « Modification en masse » la règle).
 * Une carte sans ligne sûre (version ou extension incertaine) s'ajoute depuis sa page.
 */
export function WantsDialog({
  cards,
  onClose,
}: {
  /** Les cartes du plan : chacune a un prix, donc un id Cardmarket (`priceOf`). */
  cards: readonly Linked[]
  onClose: () => void
}) {
  const ids = cards.map((card) => card.cardmarket)
  // Créée ici, hors de la partie qui attend : elle ne serait sinon jamais la même promesse.
  const [lines, setLines] = useState(() => loadWantsLines(ids))
  const [retried, setRetried] = useState(false)
  // Une transition : l'erreur et son bouton restent affichés (et le focus dessus) pendant l'essai.
  const [retrying, startRetry] = useTransition()

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Ajouter à ma liste Cardmarket"
      description="Les cartes du plan en lignes, à coller dans votre liste de souhaits Cardmarket : son Shopping Wizard y trouve les vendeurs les moins chers. Rien n’est envoyé à Cardmarket."
    >
      <Suspense fallback={<p className="muted">Préparation des lignes…</p>}>
        <WantsContent
          cards={cards}
          request={lines}
          retrying={retrying}
          retried={retried}
          onRetry={() =>
            startRetry(() => {
              setRetried(true)
              setLines(loadWantsLines(ids))
            })
          }
        />
      </Suspense>
    </Modal>
  )
}

/** Un `ref` qui donne le focus à son élément quand il s'affiche (React le rappelle avec `null`). */
const focusOnMount = (element: HTMLElement | null) => element?.focus()

/**
 * Les blocs de lignes, dans l'ordre : leur titre, la phrase de ce qui est copié, et la langue que
 * « Modification en masse » de Cardmarket porte pour ces cartes (« japonais », « français »).
 */
const LANGUAGES: readonly {
  language: CardLanguage
  title: string
  copied: [one: string, many: string]
  bulk: string
}[] = [
  {
    language: 'ja',
    title: 'Cartes japonaises',
    copied: ['carte japonaise copiée', 'cartes japonaises copiées'],
    bulk: 'japonais',
  },
  {
    language: 'fr',
    title: 'Cartes françaises',
    copied: ['carte française copiée', 'cartes françaises copiées'],
    bulk: 'français',
  },
]

function WantsContent({
  cards,
  request,
  retrying,
  retried,
  onRetry,
}: {
  cards: readonly Linked[]
  request: Promise<WantsLines | null>
  retrying: boolean
  /**
   * Après « Réessayer », dont le bouton disparaît : le focus va au premier « Copier », sinon (aucune
   * ligne) au titre des cartes à ajouter depuis leur page.
   */
  retried: boolean
  onRetry: () => void
}) {
  const lines = use(request)
  const othersTitle = useId()

  if (!lines) {
    return (
      <Unavailable title="Les lignes ne peuvent pas être préparées" retry={{ retrying, onRetry }} />
    )
  }

  const lineOf = (card: Linked) => lines[card.cardmarket] ?? null
  // Un bloc par langue qui a des lignes ; une carte sans ligne (de toute langue) va à part.
  const blocks = LANGUAGES.map((block) => ({
    ...block,
    lines: cards.flatMap((card) =>
      cardLanguage(card) === block.language ? (lineOf(card) ?? []) : [],
    ),
  })).filter((block) => block.lines.length > 0)
  const others = cards.filter((card) => lineOf(card) === null)

  return (
    <Stack gap={5}>
      {blocks.map((block, index) => (
        <LinesBlock key={block.language} {...block} autoFocus={retried && index === 0} />
      ))}
      {blocks.length > 0 && (
        <p>Quand toutes les cartes sont dans la liste, lancez le « Shopping Wizard ».</p>
      )}

      {others.length > 0 && (
        <Stack as="section" gap={3} aria-labelledby={othersTitle}>
          <h3
            id={othersTitle}
            // `autoFocus` ne vaut que pour un champ ou un bouton : sans « Copier », le focus vient
            // ici dès l'affichage.
            ref={retried && blocks.length === 0 ? focusOnMount : undefined}
            tabIndex={-1}
            className={page.formTitle}
          >
            À ajouter depuis leur page ({others.length})
          </h3>
          <p>
            Aucune ligne ne désignerait sûrement la bonne carte (une version ou une extension que
            Cardmarket pourrait confondre) : ajoutez chacune depuis sa page Cardmarket, avec «
            Ajouter à mes souhaits ». Le lien ouvre la page déjà réglée sur la langue de la carte,
            Near Mint.
          </p>
          <ul className={page.lines}>
            {others.map((card) => (
              <li key={card.id}>
                <CardLine card={card}>
                  <CardmarketLink card={card} />
                </CardLine>
              </li>
            ))}
          </ul>
        </Stack>
      )}

      {blocks.length > 0 && (
        <p className={page.note}>
          Un message bleu « Informations » de Cardmarket après « Ajouter » signale une carte ajoutée
          sans sa version : retirez-la de la liste, puis ajoutez-la depuis sa page.
        </p>
      )}
    </Stack>
  )
}

/**
 * Les lignes des cartes d'une langue, avec les étapes pour les ajouter à la liste de souhaits et
 * leur « Copier ».
 */
function LinesBlock({
  title,
  lines,
  copied,
  bulk,
  autoFocus,
}: (typeof LANGUAGES)[number] & { lines: string[]; autoFocus: boolean }) {
  const notify = useNotify()
  const field = useRef<HTMLTextAreaElement>(null)
  const titleId = useId()
  const text = lines.join('\n')

  const failed = () => {
    const textarea = field.current!
    textarea.focus()
    textarea.select()
    notify(
      'Copie impossible : les lignes sont sélectionnées, copiez-les avec Ctrl+C (⌘C sur Mac).',
      { tone: 'danger' },
    )
  }
  const copy = () =>
    copyText(text).then(() => notify(`${plural(lines.length, ...copied)}.`), failed)

  return (
    <Stack as="section" gap={4} aria-labelledby={titleId}>
      <h3 id={titleId} className={page.formTitle}>
        {title} ({lines.length})
      </h3>
      <ol className={page.steps}>
        <li>Sur Cardmarket, ouvrez votre liste de souhaits, puis « Ajouter une deck list ».</li>
        <li>Collez les lignes ci-dessous, puis « Ajouter ».</li>
        <li>
          « Modification en masse » : langue {bulk}, état Near Mint, pour ces cartes (une ligne ne
          peut pas les porter).
        </li>
        <li>Vérifiez que chaque carte a le bon numéro (par exemple « Salamèche (sv2a 168) »).</li>
      </ol>
      <Textarea
        ref={field}
        label={`Lignes des ${title.toLowerCase()}`}
        hint={`${plural(lines.length, 'carte', 'cartes')}, une par ligne.`}
        readOnly
        spellCheck={false}
        // Une rangée de plus : une longue ligne peut passer à la ligne.
        rows={Math.min(lines.length + 1, 8)}
        value={text}
      />
      <div>
        <Button leftIcon={<Copy size={16} />} autoFocus={autoFocus} onClick={copy}>
          Copier les {title.toLowerCase()}
        </Button>
      </div>
    </Stack>
  )
}
