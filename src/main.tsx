import { Button, EmptyState, ToastProvider } from '@camply/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@camply/ui/styles.css'
import './styles/global.css'
import { loadAccount } from './lib/auth-client'
import { loadSpecies } from './lib/species'
import { createRouter } from './router'
import { requestPersistentStorage } from './store/persist'

requestPersistentStorage()

const root = createRoot(document.getElementById('root')!)

// Point d'entrée : polices, styles camply puis ceux de l'app. Les espèces viennent du serveur
// avant tout affichage (toutes les pages en ont besoin), avec l'existence du compte (sans lui, la
// première visite) ; puis notifications et routeur.
Promise.all([loadSpecies(), loadAccount()]).then(([loaded]) =>
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
  ),
)
