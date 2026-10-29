/**
 * Ce que reçoit le Worker (`env` de `cloudflare:workers`) : ses liaisons et ses variables
 * (`wrangler.jsonc` ; en développement, `.env` ; en ligne, les secrets du Worker).
 */
declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    /** Les fichiers de l'app, construits par Vite (`index.ts`). */
    ASSETS: Fetcher
    BETTER_AUTH_URL: string
    BETTER_AUTH_SECRET?: string
    /** Le Worker des données, par sa liaison de service (`data.ts`). */
    DATA: Fetcher
    /** Les limites par visiteur (`limits.ts`). */
    COLLECTION_LIMIT: RateLimit
    ACCOUNT_LIMIT: RateLimit
    HEAVY_LIMIT: RateLimit
    DATA_LIMIT: RateLimit
    IMAGES_LIMIT: RateLimit
  }
}

/** `process.env.NODE_ENV`, que Vite écrit dans le Worker (`nodejs_compat` fournit `process`). */
declare const process: { env: { NODE_ENV?: string } }

/**
 * Ce que le Worker emploie de `node:zlib` (`nodejs_compat`) : décompresser, en s'arrêtant à
 * `maxOutputLength` octets (une `RangeError` au-delà).
 */
declare module 'node:zlib' {
  export function gunzipSync(
    data: Uint8Array,
    options: { maxOutputLength: number },
  ): Uint8Array<ArrayBuffer>
}
