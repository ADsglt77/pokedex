import { CommandPalette, type Command } from '@camply/ui'
import {
  ChartLine,
  Database,
  Download,
  Grid3x3,
  House,
  Layers,
  Library,
  ListChecks,
  Lock,
  Receipt,
  Upload,
  Sparkles,
  Wallet,
} from '@camply/ui/icons'
import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useExportCollection } from '@/hooks/useExportCollection'
import { pokedexUrl, searchForm, shoppingUrl, speciesPath } from '@/lib/filters'
import { formatDexNumber } from '@/lib/format'
import { SPECIES } from '@/lib/species'

const ICON = 16

/** Les pages et les vues qu'on ouvre depuis la recherche, dans l'ordre de la navigation. */
const PLACES = [
  { label: 'Accueil', to: '/', icon: House },
  { label: 'Collections', to: '/collections', icon: Library },
  { label: 'Pokédex', to: '/pokedex', icon: Grid3x3 },
  { label: 'Pokémon à débloquer', to: pokedexUrl({ possession: 'missing' }), icon: Lock },
  { label: 'Pokémon sans carte', to: pokedexUrl({ card: 'without' }), icon: Grid3x3 },
  { label: 'Catalogue par extension', to: '/catalogue', icon: Layers },
  { label: 'Liste d’achats', to: shoppingUrl(), icon: ListChecks },
  {
    label: 'Prochaine commande',
    to: shoppingUrl({ view: 'prochaine-commande' }),
    icon: Sparkles,
  },
  { label: 'Commandes', to: shoppingUrl({ view: 'commandes' }), icon: Receipt },
  { label: 'Budget', to: shoppingUrl({ view: 'budget' }), icon: Wallet },
  { label: 'Valeur de la collection', to: '/valeur', icon: ChartLine },
  { label: 'Réglages', to: '/donnees', icon: Database },
  { label: 'Importer une collection', to: '/donnees#importer', icon: Upload },
]

/**
 * La recherche de toute l'app (Ctrl K, ou le bouton de la barre) : un Pokémon par son nom (fr, en,
 * ja, sans accent) ou son numéro, une page, une action. La palette de camply cherche dans le libellé
 * et les mots-clés : les noms repliés (`searchForm`) y sont pour « evoli » comme « Évoli ».
 * Mémoïsée : elle ne se redessine qu'en s'ouvrant ou en se fermant (`onClose` stable).
 */
export const AppSearch = memo(function AppSearch({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const exportCollection = useExportCollection()

  const commands = useMemo<Command[]>(
    () => [
      ...PLACES.map(({ label, to, icon: Icon }) => ({
        id: `page:${to}`,
        label,
        group: 'Pages',
        icon: <Icon size={ICON} />,
        onRun: () => navigate(to),
      })),
      {
        id: 'action:export',
        label: 'Exporter ma collection',
        keywords: 'sauvegarde fichier json',
        group: 'Actions',
        icon: <Download size={ICON} />,
        onRun: exportCollection,
      },
      ...SPECIES.map(({ id, names }) => ({
        id: `pokemon:${id}`,
        label: `${names.fr} · ${formatDexNumber(id)}`,
        keywords: [searchForm(names.fr), names.en, searchForm(names.en), names.ja ?? '', id].join(
          ' ',
        ),
        // Pas « Pokémon » : la palette cherche aussi dans le groupe, « poké » les trouverait tous.
        group: 'Espèces',
        onRun: () => navigate(speciesPath(id)),
      })),
    ],
    [navigate, exportCollection],
  )

  return (
    <CommandPalette
      open={open}
      onClose={onClose}
      commands={commands}
      limit={50}
      placeholder="Un Pokémon, une page, une action…"
      emptyMessage="Rien ne correspond : essayez un nom, un numéro ou une page."
      aria-label="Rechercher dans le Pokédex"
    />
  )
})
