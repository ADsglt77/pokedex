// Le thème, posé avant le premier affichage (sans éclair de l'autre) : celui choisi dans ce
// navigateur, sinon (aucun choix, valeur inconnue, stockage bloqué) celui du système. La même règle
// que `src/store/theme.ts`. Un fichier et pas un script dans la page : la politique de sécurité du
// site (`deploy/security-headers.conf`) n'accepte que les scripts du site.
{
  let stored = null
  try {
    stored = localStorage.getItem('pokedex-collection.theme')
  } catch {
    // Stockage bloqué : le thème du système.
  }
  const system = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  const theme = stored === 'light' || stored === 'dark' ? stored : system
  if (theme === 'light') {
    document.documentElement.dataset.camplyTheme = 'light'
    document.querySelector('meta[name="theme-color"]').content = '#faf6f3'
  }
}
