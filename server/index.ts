import { mkdirSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { createApp } from './app.ts'
import { startWhatsApp } from './whatsapp.ts'
import { openDb } from './db.ts'
import { seedDemoAgenda, seedIfEmpty } from './seed.ts'
import { todayIso } from '../src/lib/dates.ts'

const PORT = 5184
const WHATSAPP_PORT = 5185
const production = process.env.NODE_ENV === 'production'

mkdirSync('data', { recursive: true })
const db = openDb('data/flowreturn.db')
if (!production) {
  if (seedIfEmpty(db, todayIso())) console.log('Contas de teste criadas.')
  seedDemoAgenda(db, todayIso())
}

serve({ fetch: createApp(db, { secureCookies: production }).fetch, port: PORT }, () => {
  console.log(`API em http://localhost:${PORT}`)
})

// Porta só do WhatsApp: o túnel público não alcança o login nem as telas.
const whatsapp = startWhatsApp(db)
if (whatsapp) serve({ fetch: whatsapp.fetch, port: WHATSAPP_PORT }, () => console.log(`WhatsApp em http://localhost:${WHATSAPP_PORT}`))
else console.log('WhatsApp desligado: faltam dados no .env.')
