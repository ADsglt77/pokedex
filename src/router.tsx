import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { DataPage } from '@/pages/data/DataPage'
import { ErrorPage } from '@/pages/ErrorPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PokedexPage } from '@/pages/pokedex/PokedexPage'
import { PokemonPage } from '@/pages/pokemon/PokemonPage'
import { ValuePage } from '@/pages/value/ValuePage'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'pokedex', element: <PokedexPage /> },
      { path: 'pokemon/:id', element: <PokemonPage /> },
      { path: 'valeur', element: <ValuePage /> },
      { path: 'donnees', element: <DataPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
