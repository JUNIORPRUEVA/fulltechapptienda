import 'dotenv/config'

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma 7 generates a TS/ESM client into generated/prisma
import { PrismaClient } from '../generated/prisma/client.ts'

const app = new Hono()
app.use('*', cors())

app.get('/health', (c) => c.json({ ok: true }))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

app.get('/db/health', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return c.json({ ok: true, db: 'up' })
  } catch (error: any) {
    return c.json(
      {
        ok: false,
        db: 'down',
        error: error?.message || String(error),
      },
      500,
    )
  }
})

const port = Number.parseInt(process.env.PORT || '3000', 10)

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    // Intentionally minimal output to avoid leaking env vars
    console.log(`Backend listening on http://localhost:${info.port}`)
  },
)

const shutdown = async () => {
  await prisma.$disconnect().catch(() => undefined)
  await pool.end().catch(() => undefined)
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
