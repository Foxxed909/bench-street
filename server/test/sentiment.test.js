import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'bs-sentiment-'))

const { default: db } = await import('../src/db.js')
const { scoreText, aggregate, applySentiment } = await import('../src/sentiment.js')

describe('title scoring', () => {
  it('votes positive, negative, or neutral per title', () => {
    expect(scoreText('This model is amazing and fast')).toBe(1)
    expect(scoreText('Benchmark regression — worse and slow')).toBe(-1)
    expect(scoreText('New model released today')).toBe(0)
    expect(scoreText('great model but buggy tooling')).toBe(0) // balanced → neutral
  })

  it('aggregates title votes into a bounded -1..1 score', () => {
    expect(aggregate([])).toBe(0)
    expect(aggregate([1, 1, 1, 1, 1, 1])).toBeCloseTo(Math.tanh(1), 3)
    expect(aggregate([-1, -1, -1, -1, -1, -1])).toBeCloseTo(-Math.tanh(1), 3)
    expect(Math.abs(aggregate(Array(100).fill(1)))).toBeLessThanOrEqual(1)
    expect(aggregate([1, -1])).toBe(0)
  })
})

describe('sentiment application', () => {
  const now = new Date().toISOString()
  const ins = db.prepare(
    `INSERT INTO models (slug, name, company, ticker, effort, created_at)
     VALUES (?, ?, 'TestLab', ?, ?, ?)`
  )
  // Effort variants share the base model's exact display name.
  const base = ins.run('sent-grok-4', 'Grok 4', 'SG4', null, now).lastInsertRowid
  const low = ins.run('sent-grok-4-low', 'Grok 4', 'SG4L', 'low', now).lastInsertRowid
  const other = ins.run('sent-grok-4-5', 'Grok 4.5', 'SG45', null, now).lastInsertRowid
  const prefixed = ins.run('sent-gpt-pro', 'GPT-5.5 Pro', 'SGP', null, now).lastInsertRowid
  ins.run('sent-gpt', 'GPT-5.5', 'SGB', null, now)

  const sentimentOf = (id) => db.prepare('SELECT sentiment FROM models WHERE id = ?').get(id).sentiment

  it('copies a score to same-name effort variants only', () => {
    applySentiment(base, 'Grok 4', 0.5)
    expect(sentimentOf(base)).toBe(0.5)
    expect(sentimentOf(low)).toBe(0.5)
  })

  // Regression: a prefix LIKE match leaked "Grok 4" onto "Grok 4.5" and
  // "GPT-5.5" onto "GPT-5.5 Pro", silently repricing distinct models.
  it('never leaks a score onto a different model whose name shares a prefix', () => {
    applySentiment(base, 'Grok 4', -0.8)
    expect(sentimentOf(other)).toBe(0)

    const gptBase = db.prepare("SELECT id FROM models WHERE slug = 'sent-gpt'").get().id
    applySentiment(gptBase, 'GPT-5.5', 0.9)
    expect(sentimentOf(prefixed)).toBe(0)
  })
})
