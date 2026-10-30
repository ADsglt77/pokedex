import type { ComponentType } from 'react'
import { createBrowserRouter, data, redirect, type LoaderFunctionArgs } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { isPseudo, loginPath } from '@/lib/account'
import { getJson } from '@/lib/api'
import { vitrineUrl } from '@/lib/filters'
import { loadSpecies } from '@/lib/species'
import { ErrorPage } from '@/pages/ErrorPage'
import { HomePage } from '@/pages/home/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PokedexPage } from '@/pages/pokedex/PokedexPage'
import { PokemonPage } from '@/pages/pokemon/PokemonPage'
import { useAccountStore } from '@/store/account'

/**
 * Les espèces (l'API des données), avant une page qui les montre : la coquille, un Pokédex public.
 * Sans elles, « Le Pokédex ne peut pas s'afficher » (503, `ErrorPage`). La connexion,
 * l'inscription et les mentions légales s'en passent.
 */
async function needSpecies() {
  if (!(await loadSpecies())) throw data(null, { status: 503 })
}

/**
 * Les pages de l'app : connecté seulement. Un visiteur arrive sur la connexion ; une autre page (un
 * lien gardé, une session expirée) y mène aussi, et elle y ramène.
 */
async function appLoader({ request }: LoaderFunctionArgs) {
  if (!useAccountStore.getState().account) {
    const { pathname, search } = new URL(request.url)
    return redirect(pathname === '/' ? '/connexion' : loginPath(pathname + search))
  }
  await needSpecies()
  return null
}

/** Une page chargée à la demande : son module, et le nom de son composant. */
const page = <M,>(module: Promise<M>, name: keyof M) =>
  module.then((loaded) => ({ Component: loaded[name] as ComponentType }))

/**
 * Les pages de l'app, dans la coquille commune (en-tête, navigation), 404 comprise : connecté
 * seulement (`appLoader`). Hors d'elle : la connexion (`/connexion`, la page d'un visiteur qui
 * ouvre le site), l'inscription (`/inscription`), les mentions légales (`/mentions-legales`) et le
 * Pokédex public de chaque compte (`/pseudo` : toute adresse d'un seul segment qui n'est pas une
 * page du site, `RESERVED_PSEUDOS` ; un pseudo inconnu, ou ce qui n'en est pas un, y est une page
 * introuvable). Toutes sous une route parente sans chemin, qui porte une seule fois la page
 * d'erreur (une erreur d'affichage remplace toute la page, coquille comprise, par ErrorPage) et
 * l'attente du premier chargement. L'accueil, le Pokédex et les fiches sont dans le premier
 * chargement ; les autres pages, plus lourdes (achats, valeur…), sont chargées à leur première
 * ouverture (`page`). La coquille et le Pokédex public attendent les espèces (`needSpecies`), pas
 * les autres pages. Créé une fois le compte connu (`main.tsx`) : le routeur lit la page ouverte dès
 * sa création.
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
          lazy: () => page(import('@/pages/LoginPage'), 'LoginPage'),
        },
        {
          path: 'inscription',
          lazy: () => page(import('@/pages/SignUpPage'), 'SignUpPage'),
        },
        {
          path: 'mentions-legales',
          lazy: () => page(import('@/pages/LegalPage'), 'LegalPage'),
        },
        {
          path: ':pseudo',
          // Ses données demandées en même temps que la page et les espèces, pas après elles
          // (`getJson` garde la réponse, que la page lit).
          loader: async ({ params }) => {
            const pseudo = params.pseudo!
            if (!isPseudo(pseudo)) return null
            void getJson(vitrineUrl(pseudo))
            await needSpecies()
            return null
          },
          lazy: () => page(import('@/pages/VitrinePage'), 'VitrinePage'),
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
              path: 'collections',
              lazy: () => page(import('@/pages/collections/CollectionsPage'), 'CollectionsPage'),
            },
            {
              path: 'collections/:set',
              lazy: () => page(import('@/pages/collections/SeriesPage'), 'SeriesPage'),
            },
            {
              path: 'valeur',
              lazy: () => page(import('@/pages/value/ValuePage'), 'ValuePage'),
            },
            {
              path: 'achats',
              lazy: () => page(import('@/pages/shopping/ShoppingPage'), 'ShoppingPage'),
            },
            {
              path: 'donnees',
              lazy: () => page(import('@/pages/data/DataPage'), 'DataPage'),
            },
            {
              path: 'catalogue',
              lazy: () => page(import('@/pages/catalog/CatalogPage'), 'CatalogPage'),
            },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ])
