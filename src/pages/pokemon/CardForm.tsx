import {
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
} from '@camply/ui'
import { Suspense, useCallback, useRef, useState } from 'react'
import { useCardDraft } from '@/hooks/useCardDraft'
import { useCollectionAction } from '@/hooks/useNotify'
import { isCatalogCard, NO_FILTER, type CatalogCard } from '@/lib/card-catalog'
import { addCard, useCollectionStore } from '@/store/collection'
import type { AddAs, PokemonCard, PokemonSpecies } from '@/types'
import { CardFields } from './CardFields'
import { CatalogPicker, type PickerView } from './CatalogPicker'
import { CatalogGridSkeleton } from '@/components/CatalogTile'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { ADD_AS_LABELS, ADDED_AS } from '@/config/shopping'
import { usePokedex } from '@/hooks/usePokedex'
import { toOptions } from '@/lib/format'
import { speciesNames } from '@/lib/species'

/**
 * Ajouter une carte à un Pokémon, à côté de celles qu'il a (la choisir dans le catalogue, japonaise
 * ou française, qui remplit la saisie, ou la saisir à la main ; une carte qu'il a déjà est
 * refusée), ou la corriger (`card`) : sa saisie seulement. Une autre carte ne remplace pas
 * celle-ci : son statut, son prix payé et ses commandes lui appartiennent. Montée seulement quand
 * la fenêtre est ouverte.
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
  // Ce Pokémon (`id`) a-t-il déjà cette carte du catalogue (même code, ou même id Cardmarket) ?
  const holds = (id: number, listed: CatalogCard) =>
    entryById.get(id)!.cards.some((view) => isCatalogCard(view.card, listed))
  // La carte choisie est déjà l'une des siennes : l'ajouter ferait un doublon.
  const duplicate = picked !== null && holds(species.id, picked)
  // La carte choisie, tant que la référence reste la sienne ; sinon, c'est une saisie.
  const listed = picked && draft.reference.trim() === picked.reference ? picked : null
  // Les Pokémon qui recevront la carte : choisie dans le catalogue, tous les siens (TAG TEAM : une
  // seule carte, achetée une fois), sauf ceux qui l'ont déjà ; saisie à la main, celui-ci.
  const receivers =
    card?.dexIds ?? (listed ? listed.dexIds.filter((id) => !holds(id, listed)) : [species.id])
  const [addAs, setAddAs] = useState<AddAs>('none')
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
      setTab('saisie')
      entryTab.current?.focus()
    },
    [fill],
  )

  const save = () =>
    draft.save(receivers, species.names.fr, (saved) => {
      act(
        () => (card ? useCollectionStore.getState().saveCard(saved) : addCard(saved, addAs)),
        card
          ? `Carte de ${species.names.fr} modifiée.`
          : `Carte ajoutée à ${speciesNames(receivers)}${ADDED_AS[addAs]}.`,
      )
      onClose()
    })

  // Pendant l'enregistrement, la fenêtre reste ouverte : la fermer n'empêcherait pas l'ajout.
  const close = () => {
    if (!draft.saving) onClose()
  }

  const fields = <CardFields ref={form} draft={draft} speciesId={species.id} />

  return (
    <Modal
      open
      size={card ? 'md' : 'full'}
      onClose={close}
      title={
        card
          ? `Modifier la carte de ${species.names.fr}`
          : `Ajouter une carte à ${species.names.fr}`
      }
      description={
        card
          ? 'Corrigez sa langue, sa référence (d’où son image), son id Cardmarket (d’où son prix et son lien) ou sa page.'
          : 'Choisissez-la dans le catalogue, japonais ou français, ou saisissez sa référence (d’où son image) et son id Cardmarket (d’où son prix).'
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
        fields
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
              {fields}
              <SegmentedControl
                size="sm"
                label="Ajouter comme"
                options={toOptions(ADD_AS_LABELS)}
                value={addAs}
                onChange={setAddAs}
              />
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
