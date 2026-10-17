import { createBrowserRouter, redirect, type LoaderFunctionArgs } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { accountExists, loginPath } from '@/lib/auth-client'
import { ErrorPage } from '@/pages/ErrorPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PokedexPage } from '@/pages/pokedex/PokedexPage'
import { PokemonPage } from '@/pages/pokemon/PokemonPage'
import { useSyncStore } from '@/store/sync'

/** Sans compte, la première visite. */
const firstVisit = () => (accountExists ? null : redirect('/bienvenue'))

/**
 * Les pages de l'app : connecté seulement. Un visiteur arrive sur le Pokédex public ; une autre
 * page (un lien gardé, une session expirée) mène à la connexion, qui y ramène.
 */
function appLoader({ request }: LoaderFunctionArgs) {
  if (!accountExists) return redirect('/bienvenue')
  if (useSyncStore.getState().account) return null
  const { pathname, search } = new URL(request.url)
  return redirect(pathname === '/' ? '/vitrine' : loginPath(pathname + search))
}

/**
 * Les pages de l'app, dans la coquille commune (en-tête, navigation), 404 comprise : connecté
 * seulement (`appLoader`). Hors d'elle : la première visite (`/bienvenue`, tant que le site n'a pas
 * de compte, toute page y mène ; ensuite, elle mène à la connexion), la connexion (`/connexion`) et
 * le Pokédex public (`/vitrine`), la page d'accueil d'un visiteur. Toutes sous une route parente
 * sans chemin, qui porte une seule fois la page d'erreur (une erreur d'affichage remplace toute la
 * page, coquille comprise, par ErrorPage) et l'attente du premier chargement. L'accueil, le
 * Pokédex et les fiches sont dans le premier chargement ; les autres pages, plus lourdes (achats,
 * valeur…), sont chargées à leur première ouverture. Créé une fois l'existence du compte connue
 * (`main.tsx`) : le routeur lit la page ouverte dès sa création.
 */
export const createRouter = () =>
  createBrowserRouter([
    {
      errorElement: <ErrorPage />,
      // Ouverte directement sur une page chargée à la demande : rien, le temps de la charger.
      HydrateFallback: () => null,
      children: [
        {
          path: 'bienvenue',
          loader: () => (accountExists ? redirect('/connexion') : null),
          lazy: () =>
            import('@/pages/WelcomePage').then(({ WelcomePage }) => ({ Component: WelcomePage })),
        },
        {
          path: 'connexion',
          loader: firstVisit,
          lazy: () =>
            import('@/pages/LoginPage').then(({ LoginPage }) => ({ Component: LoginPage })),
        },
        {
          path: 'vitrine',
          loader: firstVisit,
          lazy: () =>
            import('@/pages/VitrinePage').then(({ VitrinePage }) => ({ Component: VitrinePage })),
        },
        {
          element: <AppShell />,
          loader: appLoader,
          children: [
            { index: true, element: <HomePage /> },
            { path: 'pokedex', element: <PokedexPage /> },
            { path: 'pokemon/:id', element: <PokemonPage /> },
            {
              path: 'valeur',
              lazy: () =>
                import('@/pages/value/ValuePage').then(({ ValuePage }) => ({
                  Component: ValuePage,
                })),
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
              path: 'catalogue',
              lazy: () =>
                import('@/pages/CatalogPage').then(({ CatalogPage }) => ({
                  Component: CatalogPage,
                })),
            },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ])
