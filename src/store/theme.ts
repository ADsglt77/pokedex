/**
 * Le thème de l'app : sombre (gris foncé, jaune) ou clair (blanc pastel, rouge), `styles/theme.css`.
 * Le choix de ce navigateur est gardé (`pokedex-collection.theme`, une simple préférence, pas
 * synchronisée entre appareils, mais suivie par les autres onglets) ; sans choix (ou une valeur
 * inconnue, ou le stockage bloqué), l'app suit le système. Il est posé sur `<html>` avant le
 * premier affichage par le script d'`index.html`, qui suit la même règle.
 */

import { create } from 'zustand'

type Theme = 'dark' | 'light'

const KEY = 'pokedex-collection.theme'
/** La couleur de la barre du navigateur (mobile) : le fond de chaque thème. */
const BAR_COLOR: Record<Theme, string> = { dark: '#141414', light: '#faf6f3' }

const prefersLight = matchMedia('(prefers-color-scheme: light)')

/** Le thème choisi dans ce navigateur ; `null` sans choix, valeur inconnue ou stockage bloqué. */
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

// Chaque changement du thème est posé sur la page.
useThemeStore.subscribe(({ theme }) => apply(theme))

/** Passe à l'autre thème, et le garde pour ce navigateur. */
export function toggleTheme() {
  const theme: Theme = useThemeStore.getState().theme === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Sans stockage, le choix vaut jusqu'à la fermeture de la page.
  }
  useThemeStore.setState({ theme })
}

// Sans choix, le thème suit celui du système quand il change.
prefersLight.addEventListener('change', () => {
  if (!storedTheme()) useThemeStore.setState({ theme: systemTheme() })
})
// Un choix fait dans un autre onglet vaut aussi pour celui-ci.
window.addEventListener('storage', (event) => {
  if (event.key === KEY) useThemeStore.setState({ theme: storedTheme() ?? systemTheme() })
})
apply(useThemeStore.getState().theme)
