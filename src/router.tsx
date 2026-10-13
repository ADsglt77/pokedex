import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { AddCardPage } from '@/pages/AddCardPage'
import { CatalogPage } from '@/pages/CatalogPage'
import { DataPage } from '@/pages/data/DataPage'
import { ErrorPage } from '@/pages/ErrorPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PokedexPage } from '@/pages/pokedex/PokedexPage'
import { PokemonPage } from '@/pages/pokemon/PokemonPage'
import { ShoppingPage } from '@/pages/shopping/ShoppingPage'
import { ValuePage } from '@/pages/value/ValuePage'

/**
 * Les pages, toutes dans la coquille commune (en-tête, navigation), 404 comprise. Une erreur
 * d'affichage remplace toute la coquille par ErrorPage.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'pokedex', element: <PokedexPage /> },
      { path: 'pokemon/:id', element: <PokemonPage /> },
      { path: 'valeur', element: <ValuePage /> },
      { path: 'achats', element: <ShoppingPage /> },
      { path: 'donnees', element: <DataPage /> },
      { path: 'ajouter', element: <AddCardPage /> },
      { path: 'catalogue', element: <CatalogPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
