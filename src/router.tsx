import { createBrowserRouter, redirect } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { accountExists } from '@/lib/auth-client'
import { ErrorPage } from '@/pages/ErrorPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PokedexPage } from '@/pages/pokedex/PokedexPage'
import { PokemonPage } from '@/pages/pokemon/PokemonPage'

/**
 * Les pages, toutes dans la coquille commune (en-tête, navigation), 404 comprise, sauf la première
 * visite (`/bienvenue`) : tant que le site n'a pas de compte, toute page y mène, et elle mène à la
 * connexion une fois le compte créé ; et le Pokédex public (`/vitrine`), pour un visiteur. Une erreur d'affichage remplace toute la coquille par
 * ErrorPage. L'accueil, le Pokédex et les fiches sont dans le premier chargement ; les autres
 * pages, plus lourdes (achats, valeur…), sont chargées à leur première ouverture. Créé une fois
 * l'existence du compte connue (`main.tsx`) : le routeur lit la page ouverte dès sa création.
 */
export const createRouter = () =>
  createBrowserRouter([
    {
      path: 'bienvenue',
      errorElement: <ErrorPage />,
      loader: () => (accountExists ? redirect('/connexion') : null),
      lazy: () =>
        import('@/pages/WelcomePage').then(({ WelcomePage }) => ({ Component: WelcomePage })),
    },
    {
      path: 'vitrine',
      errorElement: <ErrorPage />,
      lazy: () =>
        import('@/pages/VitrinePage').then(({ VitrinePage }) => ({ Component: VitrinePage })),
    },
    {
      element: <AppShell />,
      errorElement: <ErrorPage />,
      loader: () => (accountExists ? null : redirect('/bienvenue')),
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
          path: 'connexion',
          lazy: () =>
            import('@/pages/LoginPage').then(({ LoginPage }) => ({ Component: LoginPage })),
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
