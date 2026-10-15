/**
 * Le thème de l'app : sombre (gris foncé, jaune) ou clair (blanc pastel, rouge), `styles/theme.css`.
 * Le choix de ce navigateur est gardé (`pokedex-collection.theme`, une simple préférence, pas
 * synchronisée) ; sans choix, l'app suit le système. Il est posé sur `<html>` avant le premier
 * affichage par le script d'`index.html`, que cette règle doit suivre.
 */

import { create } from 'zustand'

export type Theme = 'dark' | 'light'

const KEY = 'pokedex-collection.theme'
/** La couleur de la barre du navigateur (mobile) : le fond de chaque thème. */
const BAR_COLOR: Record<Theme, string> = { dark: '#141414', light: '#faf6f3' }

const prefersLight = matchMedia('(prefers-color-scheme: light)')

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

const systemTheme = (): Theme => (prefersLight.matches ? 'light' : 'dark')

function apply(theme: Theme) {
  if (theme === 'light') document.documentElement.dataset.camplyTheme = 'light'
  else delete document.documentElement.dataset.camplyTheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme])
}

export const useThemeStore = create<{ theme: Theme }>(() => ({
  theme: storedTheme() ?? systemTheme(),
}))

/** Passe à l'autre thème, et le garde pour ce navigateur. */
export function toggleTheme() {
  const theme: Theme = useThemeStore.getState().theme === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Sans stockage, le choix vaut jusqu'à la fermeture de la page.
  }
  apply(theme)
  useThemeStore.setState({ theme })
}

// Sans choix, le thème suit celui du système quand il change.
prefersLight.addEventListener('change', () => {
  if (storedTheme()) return
  const theme = systemTheme()
  apply(theme)
  useThemeStore.setState({ theme })
})
apply(useThemeStore.getState().theme)
