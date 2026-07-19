import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'bs-http-'))

const { default: db } = await import('../src/db.js')
const { seedDatabase } = await import('../src/seed.js')
const { createUser, signToken } = await import('../src/auth.js')
const { priceFor } = await import('../src/pricing-core.js')
const { default: modelRoutes } = await import('../src/routes/models.js')
const { default: tradeRoutes } = await import('../src/routes/trade.js')

let server
let base
let token

beforeAll(async () => {
  seedDatabase()
  const app = express()
  app.use(express.json())
  app.set('io', null)
  app.use('/api/models', modelRoutes)
  app.use('/api/trade', tradeRoutes)
  await new Promise((resolve) => {
    server = app.listen(0, () => resolve())
  })
  base = `http://127.0.0.1:${server.address().port}`
  const user = createUser({ username: 'trader-one', password: 'pw-123456' })
  token = signToken(user)
})

afterAll(() => new Promise((resolve) => server.close(resolve)))

const api = async (method, url, body) => {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : undefined
  })
  return { status: res.status, body: await res.json() }
}

describe('voting', () => {
  it('casts, switches, and toggles a stance', () => {
    return (async () => {
      let r = await api('POST', '/api/models/gpt-5-2/vote', { value: 1 })
      expect(r.status).toBe(200)
      expect(r.body.myVote).toBe(1)
      expect(r.body.likes).toBe(1)

      r = await api('POST', '/api/models/gpt-5-2/vote', { value: -1 })
      expect(r.body.myVote).toBe(-1)
      expect(r.body.likes).toBe(0)
      expect(r.body.dislikes).toBe(1)

      r = await api('POST', '/api/models/gpt-5-2/vote', { value: -1 })
      expect(r.body.myVote).toBe(0)
      expect(r.body.dislikes).toBe(0)
    })()
  })

  it('rejects voting on suspended models', async () => {
    const r = await api('POST', '/api/models/claude-fable-5/vote', { value: 1 })
    expect(r.status).toBe(400)
  })

  it('rejects out-of-range vote values', async () => {
    const r = await api('POST', '/api/models/gpt-5-2/vote', { value: 5 })
    expect(r.status).toBe(400)
  })
})

describe('trading', () => {
  const cash = () => db.prepare("SELECT cash FROM users WHERE username = 'trader-one'").get().cash

  it('buys and sells at the execution price with exact cash accounting', async () => {
    const before = cash()
    const buy = await api('POST', '/api/trade', { slug: 'claude-opus-4-8', side: 'buy', shares: 2 })
    expect(buy.status).toBe(200)
    expect(buy.body.executed.total).toBeCloseTo(buy.body.executed.price * 2, 2)
    expect(cash()).toBeCloseTo(before - buy.body.executed.total, 2)

    const sell = await api('POST', '/api/trade', { slug: 'claude-opus-4-8', side: 'sell', shares: 2 })
    expect(sell.status).toBe(200)
    expect(cash()).toBeCloseTo(before, 2)
  })

  it('rejects selling shares that are not held', async () => {
    const r = await api('POST', '/api/trade', { slug: 'gemini-3-pro', side: 'sell', shares: 1 })
    expect(r.status).toBe(400)
  })

  it('rejects a buy larger than available cash', async () => {
    const r = await api('POST', '/api/trade', { slug: 'claude-opus-4-8', side: 'buy', shares: 999999 })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/insufficient/)
  })

  it('rejects trades on suspended models', async () => {
    const r = await api('POST', '/api/trade', { slug: 'claude-mythos-5', side: 'buy', shares: 1 })
    expect(r.status).toBe(400)
  })

  it("excludes the trader's own vote from their execution price", async () => {
    await api('POST', '/api/models/deepseek-v4/vote', { value: 1 })
    const detail = await api('GET', '/api/models/deepseek-v4')
    const m = detail.body.model
    expect(m.myVote).toBe(1)
    expect(m.selfVoteExcluded).toBe(true)
    // Public price counts the like; the trader's own quote must not.
    expect(m.executionPrice).toBeLessThan(m.price)

    const buy = await api('POST', '/api/trade', { slug: 'deepseek-v4', side: 'buy', shares: 1 })
    expect(buy.body.executed.price).toBeCloseTo(m.executionPrice, 2)
    await api('POST', '/api/trade', { slug: 'deepseek-v4', side: 'sell', shares: 1 })
    await api('POST', '/api/models/deepseek-v4/vote', { value: 1 }) // toggle off
  })
})

describe('sentiment in quotes', () => {
  it('applies the sentiment tilt to execution prices exactly as to public prices', async () => {
    db.prepare("UPDATE models SET sentiment = 0.4 WHERE slug = 'qwen3-max'").run()
    const detail = await api('GET', '/api/models/qwen3-max')
    const m = detail.body.model
    const net = (m.baseVotes || 0) + m.likes - m.dislikes
    expect(m.executionPrice).toBeCloseTo(priceFor(net, m.tokenPrice, 0.4), 2)
    db.prepare("UPDATE models SET sentiment = 0 WHERE slug = 'qwen3-max'").run()
  })
})
