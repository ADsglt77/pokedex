import {
  Accordion,
  AccordionItem,
  Alert,
  Button,
  Modal,
  SegmentedControl,
  Skeleton,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  type AccordionValue,
} from '@camply/ui'
import { Suspense, useCallback, useRef, useState } from 'react'
import { useCardDraft } from '@/hooks/useCardDraft'
import { useCollectionAction } from '@/hooks/useNotify'
import { useSeriesSlot } from '@/hooks/useSeriesSlot'
import { catalogTarget, NO_FILTER, type CatalogCard } from '@/lib/card-catalog'
import { addCard, useCollectionStore } from '@/store/collection'
import type { AddAs, PokemonCard, PokemonSpecies } from '@/types'
import { CardFields } from './CardFields'
import { CatalogPicker, type PickerView } from './CatalogPicker'
import { PickedCard } from './PickedCard'
import { CatalogGridSkeleton } from '@/components/CatalogTile'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { ADD_AS_LABELS, ADDED_AS } from '@/config/shopping'
import { usePokedex } from '@/hooks/usePokedex'
import { toOptions } from '@/lib/format'
import { seriesOf } from '@/lib/series'
import { speciesNames } from '@/lib/species'

/**
 * Ajouter une carte à un Pokémon, à côté de celles qu'il a (la choisir dans le catalogue, japonaise
 * ou française, qui remplit la saisie, résumée, « Ajouter comme » d'abord et ses champs repliés,
 * ou la saisir à la main ; une carte qu'il a déjà est
 * refusée, une carte déjà celle d'un autre de ses Pokémon n'est pas recopiée : il s'y ajoute
 * (`catalogTarget`) ; une case pas encore obtenue d'une collection d'extension non plus : elle
 * devient une carte de ses Pokémon, avec son statut), ou la corriger (`card`) : sa saisie seulement
 * (une case d'une collection d'extension prévient que sa case change avec elle). Une autre carte ne
 * remplace pas celle-ci : son statut, son prix payé et ses commandes lui appartiennent. Montée
 * seulement quand la fenêtre est ouverte.
 */
export function CardForm({
  species,
  card,
  onClose,
}: {
  species: PokemonSpecies
  card: PokemonCard | null
  onClose: () => void
}) {
  const act = useCollectionAction()
  // Le bloc des champs : le premier en erreur y reçoit le focus à l'enregistrement.
  const form = useRef<HTMLDivElement>(null)
  const draft = useCardDraft(card, form)
  const [tab, setTab] = useState('catalogue')
  const [picked, setPicked] = useState<CatalogCard | null>(null)
  const { entryById } = usePokedex()
  // La carte choisie, tant que la référence reste la sienne ; sinon, c'est une saisie.
  const listed = draft.reference.trim() === picked?.reference ? picked : null
  // Un doublon (refusé), les Pokémon qui la recevront, et la carte de la collection qu'elle est
  // déjà (celle d'un autre de ses Pokémon : ils s'y ajoutent). Sa référence corrigée : une saisie.
  const collection = useCollectionStore((state) => state.collection)
  const target = catalogTarget(collection, entryById, species.id, listed)
  const { duplicate, existing } = target
  // Corrigée, une case d'une collection d'extension le reste : la fenêtre le dit.
  const series = useCollectionStore((state) => card && seriesOf(state.collection, card.id))
  // Corrigée, la carte garde ses Pokémon.
  const receivers = card?.dexIds ?? target.receivers
  // Pas encore une carte de ses Pokémon : une case pas encore obtenue d'une collection d'extension,
  // reprise telle quelle, pour tous ses Pokémon (une carte n'existe qu'une fois).
  const slot = useSeriesSlot(listed && !duplicate && !existing ? listed : null)
  const [addAs, setAddAs] = useState<AddAs>('none')
  // Les détails d'une carte choisie, repliés à chaque choix ; ouverts d'eux-mêmes tant qu'un champ
  // est illisible, même pas encore signalé (l'image, la page) : un refus les trouve ouverts, et
  // `focusFirstError` mène le focus au champ, à l'écran (ouverts au refus, leur animation partirait
  // de zéro, et le champ resterait sous le bord de la fenêtre).
  const [details, setDetails] = useState<AccordionValue>(null)
  if (draft.invalid && details !== 'details') setDetails('details')
  // L'onglet caché est démonté : ses réglages vivent ici.
  const [view, setView] = useState<PickerView>({
    language: 'ja',
    order: 'recent',
    set: '',
    pricedOnly: false,
    filter: NO_FILTER,
  })

  const entryTab = useRef<HTMLButtonElement>(null)

  // La carte choisie s'ouvre dans la saisie, à vérifier ; le focus suit, la grille disparaissant.
  // La même fonction d'un rendu à l'autre : les tuiles du catalogue ne se redessinent pas.
  const { fill } = draft
  const pick = useCallback(
    (chosen: CatalogCard) => {
      fill(chosen)
      setPicked(chosen)
      setDetails(null)
      setTab('saisie')
      entryTab.current?.focus()
    },
    [fill],
  )

  // La carte qui existe déjà reste telle quelle (« Ajouter comme » ne change pas son statut).
  const attach = (kept: PokemonCard) => {
    act(
      () =>
        useCollectionStore.getState().saveCard({ ...kept, dexIds: [...kept.dexIds, ...receivers] }),
      `Carte ${kept.reference} ajoutée à ${speciesNames(receivers)} (déjà dans votre collection).`,
    )
    onClose()
  }

  const save = () => {
    if (slot) {
      slot.adopt()
      onClose()
    } else if (existing) attach(existing)
    else {
      void draft.save(receivers, species.names.fr, (saved) => {
        act(
          () => (card ? useCollectionStore.getState().saveCard(saved) : addCard(saved, addAs)),
          card
            ? `Carte de ${species.names.fr} modifiée.`
            : `Carte ajoutée à ${speciesNames(receivers)}${ADDED_AS[addAs]}.`,
        )
        onClose()
      })
    }
  }

  // Pendant l'enregistrement, la fenêtre reste ouverte : la fermer n'empêcherait pas l'ajout.
  const close = () => {
    if (!draft.saving) onClose()
  }

  const fields = <CardFields ref={form} draft={draft} speciesId={species.id} />
  // Le seul vrai choix d'un ajout (une carte qui existe déjà garde son statut).
  const addAsChoice = !existing && !slot && (
    <SegmentedControl
      size="sm"
      label="Ajouter comme"
      options={toOptions(ADD_AS_LABELS)}
      value={addAs}
      onChange={setAddAs}
    />
  )

  return (
    <Modal
      open
      size={card ? 'md' : 'full'}
      onClose={close}
      // Un clic à côté ne perd pas la saisie (camply fermerait dès l'appui, sans rien demander).
      closeOnBackdrop={false}
      title={
        card
          ? `Modifier la carte de ${species.names.fr}`
          : `Ajouter une carte à ${species.names.fr}`
      }
      description={
        card
          ? 'Corrigez sa langue, sa référence (d’où son image), son id Cardmarket (d’où son prix et son lien) ou sa page.'
          : // Court : sur un petit téléphone, un chapeau plus long pousserait « Ajouter comme »
            // sous le pied de la fenêtre. Ce que dit chaque champ est dans son aide.
            'Choisissez-la dans le catalogue, japonais ou français, ou saisissez-la à la main.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={draft.saving}>
            Annuler
          </Button>
          <Button
            onClick={save}
            loading={draft.saving}
            disabled={(!card && tab === 'catalogue' && !picked) || duplicate}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      {card ? (
        <Stack gap={5}>
          {series && (
            <Alert
              tone="warn"
              title={`Elle fait partie de votre collection ${series.name} : la modifier change aussi sa case.`}
            />
          )}
          {fields}
        </Stack>
      ) : (
        <Tabs value={tab} defaultValue="catalogue" onChange={setTab}>
          <TabList>
            <Tab value="catalogue">Catalogue</Tab>
            <Tab value="saisie" ref={entryTab}>
              {picked ? 'La carte choisie' : 'Saisie à la main'}
            </Tab>
          </TabList>
          <TabPanel value="catalogue">
            <Stack gap={4}>
              {/* En rangée : le segment ne s'étire pas sur la largeur. Une autre langue : ses
                  extensions ne sont pas celles de l'autre. */}
              <Stack direction="horizontal">
                <LanguageSwitch
                  value={view.language}
                  onChange={(language) =>
                    setView({ ...view, language, set: '', filter: NO_FILTER })
                  }
                />
              </Stack>
              <Suspense fallback={<PickerSkeleton />}>
                <CatalogPicker
                  species={species}
                  selected={picked?.key ?? null}
                  onPick={pick}
                  view={view}
                  onView={setView}
                />
              </Suspense>
            </Stack>
          </TabPanel>
          <TabPanel value="saisie">
            <Stack gap={5}>
              {duplicate && <Alert tone="warn" title={`${species.names.fr} a déjà cette carte.`} />}
              {existing && (
                <Alert
                  tone="info"
                  title={`${speciesNames(existing.dexIds)} ${existing.dexIds.length > 1 ? 'ont' : 'a'} déjà cette carte : elle devient aussi celle de ${speciesNames(receivers)}, avec son statut et son prix payé.`}
                />
              )}
              {slot && (
                <Alert
                  tone="info"
                  title={`Cette carte fait partie de votre collection ${slot.series.name} : elle devient aussi celle de ${speciesNames(slot.card.dexIds)}, avec son statut.`}
                />
              )}
              {/* Choisie au catalogue : un résumé, « Ajouter comme », puis les champs repliés
                  (le cas rare d'une correction). Saisie à la main : le formulaire complet.
                  Toujours au même endroit, les champs ne se remontent pas quand on corrige la
                  référence. */}
              {picked ? (
                <>
                  <PickedCard
                    draft={draft}
                    speciesId={species.id}
                    cardmarket={draft.checkedId ?? undefined}
                  />
                  {addAsChoice}
                  <Accordion value={details} onChange={setDetails}>
                    <AccordionItem value="details" title="Modifier les détails">
                      <CardFields ref={form} draft={draft} speciesId={species.id} preview={false} />
                    </AccordionItem>
                  </Accordion>
                </>
              ) : (
                <>
                  {fields}
                  {addAsChoice}
                </>
              )}
            </Stack>
          </TabPanel>
        </Tabs>
      )}
    </Modal>
  )
}

/** Les cartes du catalogue tant qu'elles arrivent : réglages, décompte et grille en ébauche. */
function PickerSkeleton() {
  return (
    <Stack gap={4}>
      <p className="visually-hidden">Chargement des cartes…</p>
      <Skeleton variant="rect" width="min(30rem, 100%)" height="2rem" />
      <Skeleton width="14rem" />
      <CatalogGridSkeleton count={8} />
    </Stack>
  )
}
