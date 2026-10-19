import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      // `const { retiré, ...reste } = objet` : la façon idiomatique d'omettre une clé.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  // L'app tourne dans le navigateur ; le serveur, les tests et la configuration de Vite sous Bun :
  // chacun ses objets globaux (un `window` dans le serveur serait signalé).
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['server/**/*.ts', 'tests/**/*.ts', '*.ts'],
    languageOptions: { globals: globals.node },
  },
  // Le script de `public/` : le thème (`theme.js`), tel quel dans le navigateur.
  {
    files: ['public/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: 'script',
      globals: globals.browser,
    },
  },
])
