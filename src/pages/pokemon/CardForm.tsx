import {
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
import { NO_FILTER, type CatalogCard } from '@/lib/card-catalog'
import { addCard, useCollectionStore } from '@/store/collection'
import type { AddAs, PokemonCard, PokemonSpecies } from '@/types'
import { CardFields } from './CardFields'
import { CatalogPicker, type PickerView } from './CatalogPicker'
import { CatalogGridSkeleton } from '@/components/CatalogTile'
import { ADD_AS_LABELS, ADDED_AS } from '@/config/shopping'
import { usePokedex } from '@/hooks/usePokedex'
import { cardSpecies } from '@/lib/collection'
import { toOptions } from '@/lib/format'
import { speciesNames } from '@/lib/species'

/**
 * Ajouter la carte d'un Pokémon (la choisir dans le catalogue des cartes japonaises, qui remplit la
 * saisie, ou la saisir à la main), ou la corriger (`card`) : sa saisie seulement. Une autre carte
 * ne remplace pas celle-ci : son statut, son prix payé et ses commandes lui appartiennent. Montée
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
  // Les Pokémon qui recevront la carte : celle choisie dans le catalogue (tant que la référence
  // reste la sienne) va aussi à ceux de ses Pokémon qui n'ont pas de carte (TAG TEAM).
  const receivers =
    card?.dexIds ??
    (picked && draft.reference.trim() === picked.reference
      ? cardSpecies(picked.dexIds, species.id, (id) => entryById.get(id)?.card != null)
      : [species.id])
  const [addAs, setAddAs] = useState<AddAs>('none')
  // L'onglet caché est démonté : ses réglages vivent ici.
  const [view, setView] = useState<PickerView>({
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
          ? 'Corrigez sa référence (d’où son image), son id Cardmarket (d’où son prix et son lien) ou sa page.'
          : 'Choisissez-la parmi ses cartes japonaises, ou saisissez sa référence (d’où son image) et son id Cardmarket (d’où son prix).'
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={draft.saving}>
            Annuler
          </Button>
          <Button
            onClick={save}
            loading={draft.saving}
            disabled={!card && tab === 'catalogue' && !picked}
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
            <Tab value="catalogue">Cartes japonaises</Tab>
            <Tab value="saisie" ref={entryTab}>
              {picked ? 'La carte choisie' : 'Saisie à la main'}
            </Tab>
          </TabList>
          <TabPanel value="catalogue">
            <Suspense fallback={<PickerSkeleton />}>
              <CatalogPicker
                species={species}
                selected={picked?.key ?? null}
                onPick={pick}
                view={view}
                onView={setView}
              />
            </Suspense>
          </TabPanel>
          <TabPanel value="saisie">
            <Stack gap={5}>
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
