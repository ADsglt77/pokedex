import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { ErrorPage } from '@/pages/ErrorPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PokedexPage } from '@/pages/pokedex/PokedexPage'
import { PokemonPage } from '@/pages/pokemon/PokemonPage'

/**
 * Les pages, toutes dans la coquille commune (en-tête, navigation), 404 comprise. Une erreur
 * d'affichage remplace toute la coquille par ErrorPage. L'accueil, le Pokédex et les fiches sont
 * dans le premier chargement ; les autres pages, plus lourdes (achats, valeur…), sont chargées à
 * leur première ouverture.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <ErrorPage />,
    // Ouverte directement sur une page chargée à la demande : rien, le temps de la charger.
    HydrateFallback: () => null,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'pokedex', element: <PokedexPage /> },
      { path: 'pokemon/:id', element: <PokemonPage /> },
      {
        path: 'valeur',
        lazy: () =>
          import('@/pages/value/ValuePage').then(({ ValuePage }) => ({ Component: ValuePage })),
      },
      {
        path: 'achats',
        lazy: () =>
          import('@/pages/shopping/ShoppingPage').then(({ ShoppingPage }) => ({
            Component: ShoppingPage,
          })),
      },
      {
        path: 'donnees',
        lazy: () =>
          import('@/pages/data/DataPage').then(({ DataPage }) => ({ Component: DataPage })),
      },
      {
        path: 'ajouter',
        lazy: () =>
          import('@/pages/AddCardPage').then(({ AddCardPage }) => ({ Component: AddCardPage })),
      },
      {
        path: 'connexion',
        lazy: () => import('@/pages/LoginPage').then(({ LoginPage }) => ({ Component: LoginPage })),
      },
      {
        path: 'catalogue',
        lazy: () =>
          import('@/pages/CatalogPage').then(({ CatalogPage }) => ({ Component: CatalogPage })),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
