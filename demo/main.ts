/**
 * Demonstração: o Flow Return inteiro rodando dentro do navegador, sem servidor.
 * O mesmo servidor (Hono) responde às chamadas de /api, com o banco SQLite em memória (sql.js).
 * Os dados são os de teste e voltam ao início quando a página recarrega. A atendente IA fica desligada.
 */
import initSqlJs from 'sql.js'
import wasm from 'virtual:sql-wasm'
import { BufferShim } from './shims/crypto'
import { useEngine } from './shims/sqlite'

Object.assign(globalThis, { Buffer: BufferShim })

function wasmBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function start() {
  useEngine(await initSqlJs({ wasmBinary: wasmBytes(wasm) as unknown as ArrayBuffer }))

  const [{ openDb }, { seedDemoAgenda, seedIfEmpty }, { createApp }, { AiUnavailable }, { todayIso }] = await Promise.all([
    import('../server/db.ts'),
    import('../server/seed.ts'),
    import('../server/app.ts'),
    import('../server/ai.ts'),
    import('../src/lib/dates.ts'),
  ])

  const db = openDb(':memory:')
  seedIfEmpty(db, todayIso())
  seedDemoAgenda(db, todayIso())
  const app = createApp(db, {
    chat: async () => {
      throw new AiUnavailable()
    },
  })

  // Toda chamada a /api vai para o servidor aqui dentro. A sessão fica em shims/cookie.ts.
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith('/api')) return realFetch(input, init)
    return app.fetch(new Request(`https://demo.flowreturn.local${url}`, init))
  }

  // Abre já dentro da Barbearia do Bigode. As outras contas estão em docs/CONTAS-DE-TESTE.md.
  await window.fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'barbearia@flowreturn.test', password: 'barbearia-return-2026' }),
  })

  await import('../src/main.tsx')
}

start().catch((failure: unknown) => {
  document.getElementById('root')!.textContent = `A demonstração não abriu: ${failure instanceof Error ? failure.message : String(failure)}`
})
