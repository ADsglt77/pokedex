import { ToastProvider } from '@camply/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
// Le jeu latin seul : il couvre le français (œ, €, ’, « », l'espace fine insécable) ; les autres
// (cyrillique, grec, vietnamien, latin étendu) alourdiraient le CSS qui bloque l'affichage. Les
// graisses que l'app emploie, et elles seules (celles de camply comprises) : Manrope, le texte, en
// 400, 500, 600 et 700 (`strong`) ; Space Grotesk, les titres et les chiffres, en 600 et 700.
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@camply/ui/styles.css'
import './styles/theme.css'
import './styles/global.css'
import { PokedexUnavailable } from './components/PokedexUnavailable'
import { loadAccount } from './lib/account'
import { MINUTE } from './lib/time'
import { createRouter } from './router'
import { signIn } from './store/account'

// Un déploiement a remplacé les fichiers de l'app pendant que cette page était ouverte : une page
// chargée à la demande n'existe plus (404). La page se recharge, avec la nouvelle version ; une
// fois par minute au plus (un fichier qui manquerait encore ne la ferait pas recharger sans fin).
// Hors ligne (`navigator.onLine` : un réseau sans Internet compte pour en ligne), la page n'a
// manqué que de réseau : recharger mènerait à l'écran d'erreur du navigateur, hors de l'app et
// de ses modifications en attente. L'erreur suit son cours (la page d'erreur de l'app, pour une
// page) ; l'app reste en mémoire, et ses modifications partent au retour du réseau. Cette page-là
// ne s'ouvre ensuite qu'après un rechargement : le routeur garde l'échec.
const RELOADED_KEY = 'pokedex-collection.reloaded'
addEventListener('vite:preloadError', (event) => {
  if (!navigator.onLine) return
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED_KEY)) < MINUTE) return
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  location.reload()
})

// Une entrée de l'historique sans clé : chargée en entier (adresse tapée, favori, lien d'un autre
// site), ou créée par une ancre de la page (`#main`, `#importer`). Le routeur leur donnerait à
// toutes « default », et une page reprendrait la position de défilement gardée pour une autre
// (`ScrollRestoration`, `AppShell`). Chacune reçoit sa clé avant que le routeur la lise, comme
// celles qu'il crée : au chargement, et à `popstate`, écouté avant lui ; un rechargement ou
// « Précédent » la garde, et retrouve sa position. Son rang (`idx`) reste nul, comme le routeur
// l'attend d'une entrée qu'il n'a pas créée : absent, il compterait les suivantes en `NaN`, et la
// garde d'abandon d'une saisie (`useBlocker`) rechargerait la page au lieu de demander.
const giveKey = () => {
  if (!history.state?.key) {
    history.replaceState(
      { idx: null, ...history.state, key: Math.random().toString(36).slice(2, 10) },
      '',
    )
  }
}
giveKey()
addEventListener('popstate', giveKey)

const root = createRoot(document.getElementById('root')!)

// Point d'entrée : polices, styles camply, le thème (ses couleurs redéfinies), puis ceux de l'app.
// Qui est connecté vient du serveur avant tout affichage (personne : la connexion, ou le Pokédex
// public), puis sa collection (et ses espèces, en même temps : `signIn`) ; puis notifications et
// routeur. D'ici là, `#root` montre le logo (`index.html`, qui demande aussi le compte avant ce
// script). Les espèces, l'API des données, ne sont attendues que par les pages qui les montrent
// (`router.tsx`) : la connexion, l'inscription et les mentions légales s'affichent sans elles.
loadAccount().then(async (account) => {
  const loaded = account !== undefined && (!account || (await signIn(account)))
  root.render(
    <StrictMode>
      {loaded ? (
        <ToastProvider position="bottom-left">
          <RouterProvider router={createRouter()} />
        </ToastProvider>
      ) : (
        <PokedexUnavailable />
      )}
    </StrictMode>,
  )
})
