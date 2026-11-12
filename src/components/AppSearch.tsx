import { CommandPalette, type Command } from '@camply/ui'
import {
  ChartLine,
  Download,
  Grid3x3,
  House,
  Layers,
  Library,
  ListChecks,
  Lock,
  Moon,
  Receipt,
  Settings,
  Sparkles,
  Upload,
  UserRound,
  Wallet,
} from '@camply/ui/icons'
import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useExportCollection } from '@/hooks/useExportCollection'
import { fold, pokedexUrl, searchForm, settingsPath, shoppingUrl, speciesPath } from '@/lib/filters'
import { formatDexNumber } from '@/lib/format'
import { SPECIES } from '@/lib/species'
import { toggleTheme } from '@/store/theme'

const ICON = 16

/**
 * Les pages et les vues qu'on ouvre depuis la recherche, dans l'ordre de la navigation et sous ses
 * libellés ; `keywords` : ce qu'on y cherche aussi (« compte », « mot de passe »). La palette ne
 * retire pas les accents de ce qu'on tape : libellé et mots-clés y sont avec et sans.
 */
const PLACES = [
  { label: 'Accueil', to: '/', icon: House, keywords: 'tableau de bord' },
  { label: 'Collections', to: '/collections', icon: Library, keywords: 'extensions séries' },
  { label: 'Pokédex', to: '/pokedex', icon: Grid3x3, keywords: 'classeur' },
  {
    label: 'Pokémon à débloquer',
    to: pokedexUrl({ possession: 'missing' }),
    icon: Lock,
    keywords: 'manquants',
  },
  { label: 'Pokémon sans carte', to: pokedexUrl({ card: 'without' }), icon: Grid3x3 },
  { label: 'Catalogue', to: '/catalogue', icon: Layers, keywords: 'extensions cartes séries' },
  { label: 'Liste d’achats', to: shoppingUrl(), icon: ListChecks, keywords: 'souhaits' },
  {
    label: 'Prochaine commande',
    to: shoppingUrl({ view: 'prochaine-commande' }),
    icon: Sparkles,
    keywords: 'plan assistant achats',
  },
  { label: 'Commandes', to: shoppingUrl({ view: 'commandes' }), icon: Receipt, keywords: 'achats' },
  { label: 'Budget', to: shoppingUrl({ view: 'budget' }), icon: Wallet, keywords: 'plafond mois' },
  { label: 'Valeur', to: '/valeur', icon: ChartLine, keywords: 'prix cardmarket évolution' },
  {
    label: 'Réglages',
    to: settingsPath(),
    icon: Settings,
    keywords: 'paramètres données pokédex public partage',
  },
  {
    label: 'Mon compte',
    to: settingsPath('#compte'),
    icon: UserRound,
    keywords: 'pseudo mot de passe réglages supprimer',
  },
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
      ...PLACES.map(({ label, to, icon: Icon, keywords = '' }) => ({
        id: `page:${to}`,
        label,
        keywords: `${fold(label)} ${keywords} ${fold(keywords)}`,
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
      {
        id: 'action:import',
        label: 'Importer une collection',
        keywords: 'sauvegarde fichier json restaurer reglages',
        group: 'Actions',
        icon: <Upload size={ICON} />,
        onRun: () => navigate(settingsPath('#importer')),
      },
      {
        id: 'action:theme',
        label: 'Changer de thème',
        keywords: 'thème theme sombre clair nuit jour couleurs',
        group: 'Actions',
        icon: <Moon size={ICON} />,
        onRun: toggleTheme,
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
