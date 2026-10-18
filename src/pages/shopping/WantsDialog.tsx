import { Button, EmptyState, Modal, Spinner, Stack, Textarea } from '@camply/ui'
import { CloudOff, Copy, RotateCw } from '@camply/ui/icons'
import { Suspense, use, useId, useRef, useState, useTransition } from 'react'
import { CardmarketLink } from '@/components/CardmarketLink'
import { useNotify } from '@/hooks/useNotify'
import { loadWantsLines } from '@/lib/api'
import { copyText } from '@/lib/clipboard'
import { plural } from '@/lib/format'
import type { PokemonCard, WantsLines } from '@/types'
import { CardLine } from './CardLine'
import page from './ShoppingPage.module.css'

/**
 * « Copier pour Cardmarket » : les cartes de la prochaine commande en lignes pour « Ajouter une
 * deck list » d'une liste de souhaits Cardmarket (`/api/wants`, `wantsLine`), que l'utilisateur
 * colle lui-même avant le Shopping Wizard : l'app n'envoie rien à Cardmarket. Une carte sans ligne
 * sûre (version ou extension incertaine) s'ajoute depuis sa page.
 */
export function WantsDialog({
  cards,
  onClose,
}: {
  /** Les cartes du plan : chacune a un prix, donc un id Cardmarket (`priceOf`). */
  cards: readonly PokemonCard[]
  onClose: () => void
}) {
  const ids = cards.map((card) => card.cardmarket!)
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

function WantsContent({
  cards,
  request,
  retrying,
  retried,
  onRetry,
}: {
  cards: readonly PokemonCard[]
  request: Promise<WantsLines | null>
  retrying: boolean
  /**
   * Après « Réessayer », dont le bouton disparaît : le focus va à « Copier », sinon (aucune ligne)
   * au titre des cartes à ajouter depuis leur page.
   */
  retried: boolean
  onRetry: () => void
}) {
  const lines = use(request)
  const notify = useNotify()
  const field = useRef<HTMLTextAreaElement>(null)
  const othersTitle = useId()

  if (!lines) {
    return (
      <EmptyState
        icon={<CloudOff size={22} />}
        title="Les lignes ne peuvent pas être préparées"
        description="Le serveur ne répond pas pour le moment : réessayez dans un instant."
        actions={
          <Button
            variant="secondary"
            leftIcon={retrying ? <Spinner size={16} /> : <RotateCw size={16} />}
            onClick={onRetry}
          >
            Réessayer
          </Button>
        }
      />
    )
  }

  const lineOf = (card: PokemonCard) => lines[card.cardmarket!] ?? null
  const ready = cards.flatMap((card) => lineOf(card) ?? [])
  const others = cards.filter((card) => lineOf(card) === null)
  const text = ready.join('\n')

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
    copyText(text).then(
      () => notify(`${plural(ready.length, 'carte copiée', 'cartes copiées')}.`),
      failed,
    )

  return (
    <Stack gap={5}>
      {ready.length > 0 && (
        <Stack gap={4}>
          <ol className={page.steps}>
            <li>Sur Cardmarket, ouvrez votre liste de souhaits, puis « Ajouter une deck list ».</li>
            <li>Collez les lignes ci-dessous, puis « Ajouter ».</li>
            <li>
              « Modification en masse » : langue japonais, état Near Mint, pour toutes les cartes
              (une ligne ne peut pas les porter).
            </li>
            <li>
              Vérifiez que chaque carte a le bon numéro (par exemple « Salamèche (sv2a 168) »), puis
              lancez le « Shopping Wizard ».
            </li>
          </ol>
          <Textarea
            ref={field}
            label="Lignes pour Cardmarket"
            hint={`${plural(ready.length, 'carte', 'cartes')}, une par ligne.`}
            readOnly
            spellCheck={false}
            // Une rangée de plus : une longue ligne peut passer à la ligne.
            rows={Math.min(ready.length + 1, 8)}
            value={text}
          />
          <div>
            <Button leftIcon={<Copy size={16} />} autoFocus={retried} onClick={copy}>
              Copier
            </Button>
          </div>
        </Stack>
      )}

      {others.length > 0 && (
        <Stack as="section" gap={3} aria-labelledby={othersTitle}>
          <h3
            id={othersTitle}
            // `autoFocus` ne vaut que pour un champ ou un bouton : sans « Copier », le focus vient
            // ici dès l'affichage.
            ref={retried && ready.length === 0 ? focusOnMount : undefined}
            tabIndex={-1}
            className={page.formTitle}
          >
            À ajouter depuis leur page ({others.length})
          </h3>
          <p>
            Aucune ligne ne désignerait sûrement la bonne carte (une version ou une extension que
            Cardmarket pourrait confondre) : ajoutez chacune depuis sa page Cardmarket, avec «
            Ajouter à mes souhaits ». Le lien ouvre la page déjà réglée sur japonais, Near Mint.
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

      {ready.length > 0 && (
        <p className={page.note}>
          Un message bleu « Informations » de Cardmarket après « Ajouter » signale une carte ajoutée
          sans sa version : retirez-la de la liste, puis ajoutez-la depuis sa page.
        </p>
      )}
    </Stack>
  )
}
