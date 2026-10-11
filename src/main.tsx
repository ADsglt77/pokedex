import { ToastProvider } from '@camply/ui'
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
import { router } from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider position="bottom-left">
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
)
