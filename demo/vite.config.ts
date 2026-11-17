import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/** O SQLite do navegador vai dentro da página, em base64: a página publicada não busca arquivos fora dela. */
function sqlWasm() {
  const id = 'virtual:sql-wasm'
  return {
    name: 'sql-wasm-inline',
    resolveId: (source: string) => (source === id ? `\0${id}` : null),
    load(source: string) {
      if (source !== `\0${id}`) return null
      const file = fileURLToPath(new URL('../node_modules/sql.js/dist/sql-wasm-browser.wasm', import.meta.url))
      return `export default ${JSON.stringify(readFileSync(file).toString('base64'))}`
    },
  }
}

/** Gera um único HTML com tudo dentro: sistema, banco e servidor. `npm run demo:build`. */
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react(), viteSingleFile(), sqlWasm()],
  define: { 'process.env': '{}' },
  resolve: {
    alias: {
      'node:sqlite': fileURLToPath(new URL('./shims/sqlite.ts', import.meta.url)),
      'node:crypto': fileURLToPath(new URL('./shims/crypto.ts', import.meta.url)),
      'hono/cookie': fileURLToPath(new URL('./shims/cookie.ts', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-demo',
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: { input: fileURLToPath(new URL('./index.html', import.meta.url)) },
  },
})
