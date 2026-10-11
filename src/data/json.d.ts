// Les gros fichiers JSON sont typés dans `src/lib/catalog.ts` : TypeScript n'a pas à les analyser.
declare module '*.json' {
  const value: unknown
  export default value
}
