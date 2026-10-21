import { ToastProvider } from '@camply/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
// Le jeu latin seul : il couvre le français (œ, €, ’, « », l'espace fine insécable) ; les autres
// (cyrillique, grec, vietnamien, latin étendu) alourdiraient le CSS qui bloque l'affichage.
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@camply/ui/styles.css'
import './styles/theme.css'
import './styles/global.css'
import { PokedexUnavailable } from './components/PokedexUnavailable'
import { loadAccount } from './lib/account'
import { createRouter } from './router'
import { signIn } from './store/account'

// Un déploiement a remplacé les fichiers de l'app pendant que cette page était ouverte : une page
// chargée à la demande n'existe plus (404). La page se recharge, avec la nouvelle version ; une
// fois par minute au plus (un fichier qui manquerait encore ne la ferait pas recharger sans fin).
const RELOADED_KEY = 'pokedex-collection.reloaded'
addEventListener('vite:preloadError', (event) => {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED_KEY)) < 60_000) return
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  location.reload()
})

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
