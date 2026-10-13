import { Alert, Button, Combobox, Stack, type ComboboxOption } from '@camply/ui'
import { Plus } from '@camply/ui/icons'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CardFields } from '@/components/CardFields'
import { NewCardOptions } from '@/components/NewCardOptions'
import { PageHeader } from '@/components/PageHeader'
import { useCardDraft } from '@/hooks/useCardDraft'
import { useCollectionAction } from '@/hooks/useNotify'
import { usePokedex } from '@/hooks/usePokedex'
import { readCardmarketCard, type CardmarketCard } from '@/lib/cardmarket'
import { getSpecies, SPECIES } from '@/lib/species'
import { searchMatcher, speciesInName } from '@/lib/filters'
import { formatDexNumber, pageTitle } from '@/lib/format'
import { useCollectionStore } from '@/store/collection'
import { addCard } from '@/store/shopping'

/**
 * Ajouter une carte depuis Cardmarket (`/ajouter`) : le favori « Ajouter au Pokédex » ouvre cette
 * page avec l'id, le nom, l'extension et l'adresse de la carte qu'on regardait chez Cardmarket.
 */
export function AddCardPage() {
  const [params] = useSearchParams()
  const imported = readCardmarketCard(params)
  return (
    <div className="container container--narrow">
      <title>{pageTitle('Ajouter une carte')}</title>
      {imported ? <AddCard imported={imported} /> : <NothingToAdd />}
    </div>
  )
}

const SPECIES_OPTIONS: ComboboxOption[] = SPECIES.map(({ id, names }) => ({
  value: String(id),
  label: `${names.fr} · ${formatDexNumber(id)}`,
}))

// Comme la recherche du Pokédex : nom français, anglais ou japonais, ou numéro.
const matchesSpecies = (option: ComboboxOption, query: string) =>
  searchMatcher(query)(getSpecies(Number(option.value))!)

function AddCard({ imported }: { imported: CardmarketCard }) {
  const navigate = useNavigate()
  const act = useCollectionAction()
  const { entryById } = usePokedex()
  const customCards = useCollectionStore((state) => state.collection.customCards)
  const [guessed] = useState(() => speciesInName(imported.name))
  const [speciesId, setSpeciesId] = useState(guessed)
  const [submitted, setSubmitted] = useState(false)
  const [choices, setChoices] = useState({ owned: false, toBuy: false })
  const draft = useCardDraft(null, {
    cardmarket: imported.cardmarket,
    reference: imported.name,
    page: imported.page ?? undefined,
  })

  const species = speciesId === null ? null : getSpecies(speciesId)
  // Un Pokémon n'a qu'une carte : celle qu'il a déjà empêche d'en ajouter une autre.
  const taken = species && entryById.get(species.id)?.card
  const same = taken?.card.cardmarket === imported.cardmarket
  // La même carte, déjà notée pour un autre Pokémon (une carte de deux Pokémon, ou une erreur).
  const elsewhere = Object.values(customCards).find(
    (card) =>
      card.cardmarket === imported.cardmarket && !(species && card.dexIds.includes(species.id)),
  )

  const add = () => {
    setSubmitted(true)
    if (!species || taken) return
    draft.save([species.id], species.names.fr, (saved) => {
      act(() => addCard(saved, choices), `Carte ajoutée à ${species.names.fr}.`)
      navigate(`/pokemon/${species.id}`)
    })
  }

  return (
    <>
      <PageHeader title="Ajouter une carte">
        Depuis Cardmarket : <strong>{imported.name || `l’id ${imported.cardmarket}`}</strong>
        {imported.expansion && `, ${imported.expansion}`}. Choisissez son Pokémon, vérifiez les
        champs, puis ajoutez-la.
      </PageHeader>

      <Stack gap={6}>
        {elsewhere && (
          <Alert tone="info" title="Cette carte est déjà dans votre Pokédex">
            Elle est notée pour{' '}
            {elsewhere.dexIds.map((id, index) => (
              <span key={id}>
                {index > 0 && ', '}
                <Link to={`/pokemon/${id}`}>{getSpecies(id)?.names.fr}</Link>
              </span>
            ))}
            .
          </Alert>
        )}

        <Combobox
          label="Pokémon"
          hint={
            speciesId === null
              ? 'Le nom de la carte n’a pas suffi à le reconnaître : choisissez-le.'
              : speciesId === guessed
                ? 'Reconnu d’après le nom de la carte : vérifiez-le.'
                : undefined
          }
          placeholder="Nom ou numéro…"
          options={SPECIES_OPTIONS}
          filter={matchesSpecies}
          value={speciesId === null ? '' : String(speciesId)}
          onChange={(value) => setSpeciesId(Number(value))}
          error={submitted && !species ? 'Choisissez le Pokémon de cette carte.' : undefined}
        />

        {species && taken && (
          <Alert
            tone={same ? 'info' : 'warn'}
            title={
              same
                ? `C’est déjà la carte de ${species.names.fr}`
                : `${species.names.fr} a déjà une carte`
            }
          >
            <Stack gap={3} align="start">
              {!same && (
                <p>
                  Sa carte : {taken.card.reference}. Un Pokémon n’a qu’une carte : pour la
                  remplacer, retirez-la depuis sa fiche, puis cliquez de nouveau sur le favori.
                </p>
              )}
              <Button asChild variant="soft" size="sm">
                <Link to={`/pokemon/${species.id}`}>Voir la fiche de {species.names.fr}</Link>
              </Button>
            </Stack>
          </Alert>
        )}

        <CardFields draft={draft} speciesId={species?.id ?? null} />
        <NewCardOptions choices={choices} onChange={setChoices} />

        <div>
          <Button
            leftIcon={<Plus size={16} />}
            onClick={add}
            loading={draft.saving}
            disabled={Boolean(taken)}
          >
            {species ? `Ajouter à ${species.names.fr}` : 'Ajouter'}
          </Button>
        </div>
      </Stack>
    </>
  )
}

/** Ouverte sans le favori : rien à ajouter. */
function NothingToAdd() {
  return (
    <>
      <PageHeader title="Aucune carte à ajouter">
        Cette page s’ouvre avec le favori « Ajouter au Pokédex », depuis la page d’une carte chez
        Cardmarket. Installez-le depuis la page Données ; sinon, ajoutez une carte depuis la fiche
        de son Pokémon.
      </PageHeader>
      <Stack direction="horizontal" gap={3} wrap>
        <Button asChild>
          <Link to="/donnees">Installer le favori</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/pokedex">Ouvrir le Pokédex</Link>
        </Button>
      </Stack>
    </>
  )
}
