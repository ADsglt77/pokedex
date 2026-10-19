import { createBrowserRouter, redirect, type LoaderFunctionArgs } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { loginPath } from '@/lib/account'
import { getJson } from '@/lib/api'
import { vitrinePseudo } from '@/lib/filters'
import { ErrorPage } from '@/pages/ErrorPage'
import { HomePage } from '@/pages/home/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PokedexPage } from '@/pages/pokedex/PokedexPage'
import { PokemonPage } from '@/pages/pokemon/PokemonPage'
import { useSyncStore } from '@/store/sync'

/**
 * Les pages de l'app : connecté seulement. Un visiteur arrive sur la connexion ; une autre page (un
 * lien gardé, une session expirée) y mène aussi, et elle y ramène.
 */
function appLoader({ request }: LoaderFunctionArgs) {
  if (useSyncStore.getState().account) return null
  const { pathname, search } = new URL(request.url)
  return redirect(pathname === '/' ? '/connexion' : loginPath(pathname + search))
}

/**
 * Les pages de l'app, dans la coquille commune (en-tête, navigation), 404 comprise : connecté
 * seulement (`appLoader`). Hors d'elle : la connexion (`/connexion`, la page d'un visiteur qui
 * ouvre le site), l'inscription (`/inscription`), les mentions légales (`/mentions-legales`) et le
 * Pokédex public de chaque compte
 * (`/@pseudo` : un seul segment, que le routeur ne sait pas découper ; une autre adresse d'un
 * segment, inconnue, y est une page introuvable). Toutes sous une route parente sans chemin, qui
 * porte une seule fois la page d'erreur (une erreur d'affichage remplace toute la page, coquille
 * comprise, par ErrorPage) et l'attente du premier chargement. L'accueil, le Pokédex et les fiches
 * sont dans le premier chargement ; les autres pages, plus lourdes (achats, valeur…), sont
 * chargées à leur première ouverture. Créé une fois le compte connu (`main.tsx`) : le routeur lit
 * la page ouverte dès sa création.
 */
export const createRouter = () =>
  createBrowserRouter([
    {
      errorElement: <ErrorPage />,
      // Ouverte directement sur une page chargée à la demande : rien, le temps de la charger.
      HydrateFallback: () => null,
      children: [
        {
          path: 'connexion',
          lazy: () =>
            import('@/pages/LoginPage').then(({ LoginPage }) => ({ Component: LoginPage })),
        },
        {
          path: 'inscription',
          lazy: () =>
            import('@/pages/SignUpPage').then(({ SignUpPage }) => ({ Component: SignUpPage })),
        },
        {
          path: 'mentions-legales',
          lazy: () =>
            import('@/pages/LegalPage').then(({ LegalPage }) => ({ Component: LegalPage })),
        },
        {
          path: ':handle',
          // Ses données demandées en même temps que la page, pas après elle (`getJson` garde la
          // réponse, que la page lit).
          loader: ({ params }) => {
            const pseudo = vitrinePseudo(params.handle!)
            if (pseudo) void getJson(`/api/vitrine/${pseudo}`)
            return null
          },
          lazy: () =>
            import('@/pages/VitrinePage').then(({ VitrinePage }) => ({ Component: VitrinePage })),
        },
        {
          // Le classeur, rendu par la coquille, qui le garde en vie d'une page à l'autre.
          element: <AppShell pokedex={<PokedexPage />} />,
          loader: appLoader,
          children: [
            { index: true, element: <HomePage /> },
            // Rendu par la coquille (`pokedex`), pas ici.
            { path: 'pokedex', element: null },
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
                import('@/pages/catalog/CatalogPage').then(({ CatalogPage }) => ({
                  Component: CatalogPage,
                })),
            },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ])
