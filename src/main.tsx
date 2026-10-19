import { Button, EmptyState, ToastProvider } from '@camply/ui'
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
import { loadAccount } from './lib/account'
import { loadSpecies } from './lib/species'
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
// Les espèces viennent du serveur avant tout affichage (toutes les pages en ont besoin), avec qui
// est connecté (personne : la connexion, ou le Pokédex public), puis sa collection ; puis
// notifications et routeur. D'ici là, `#root` montre le logo (`index.html`, qui demande aussi les
// espèces et le compte avant ce script).
Promise.all([loadSpecies(), loadAccount()]).then(async ([species, account]) => {
  const loaded = species && account !== undefined && (!account || (await signIn(account)))
  root.render(
    <StrictMode>
      {loaded ? (
        <ToastProvider position="bottom-left">
          <RouterProvider router={createRouter()} />
        </ToastProvider>
      ) : (
        <main className="container">
          <EmptyState
            title="Le Pokédex ne peut pas s’afficher"
            description="Le serveur ne répond pas, ou ses données ne sont pas encore prêtes (premier démarrage). Réessayez dans un instant."
            headingLevel={2}
            actions={<Button onClick={() => location.reload()}>Réessayer</Button>}
          />
        </main>
      )}
    </StrictMode>,
  )
})
