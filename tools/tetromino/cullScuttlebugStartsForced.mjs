/**
 * Remove Scuttlebug daily puzzles that match starts-forced-stays-forced.
 * Tutorial is never touched. Default tiers: medium, hard.
 *
 *   node tools/tetromino/cullScuttlebugStartsForced.mjs
 *   node tools/tetromino/cullScuttlebugStartsForced.mjs --tiers=medium,hard
 *   node tools/tetromino/cullScuttlebugStartsForced.mjs --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { analyzePuzzle, isStartsForcedStaysForced } from './branchingStats.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const abs = path.join(repoRoot, 'puzzlegames/scuttlebug/puzzles.js')
const args = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const eq = a.indexOf('=')
      return eq === -1 ? [a.slice(2), 'true'] : [a.slice(2, eq), a.slice(eq + 1)]
    })
)
const dryRun = args.has('dry-run')
const tierList = (args.get('tiers') || 'medium,hard')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/scuttlebug/engine.js')).href
)
const { normalizePuzzleInput } = engine
const data = (await import(pathToFileURL(abs).href + `?t=${Date.now()}`)).default

const TIERS = ['tutorial', 'easy', 'medium', 'hard']

function cellPair(v) {
  if (Array.isArray(v)) return `[${v[0]},${v[1]}]`
  return `[${v.r},${v.c}]`
}

function formatPuzzle(raw) {
  const p = normalizePuzzleInput(raw, false)
  let piecesPart
  if (raw.pieces && !Array.isArray(raw.pieces)) {
    piecesPart = JSON.stringify(raw.pieces)
  } else {
    const grouped = {}
    for (const piece of p.pieces) {
      const type = piece.type || '?'
      if (!grouped[type]) grouped[type] = []
      grouped[type].push(piece.cells.map((c) => [c.r, c.c]))
    }
    piecesPart = JSON.stringify(grouped)
  }
  const pushes = raw.pushes ?? raw.minPushes
  const head =
    `    { size: ${p.size}, pieces: ${piecesPart}, ` +
    `player: ${cellPair(raw.player ?? p.player)}, ` +
    `hole: ${cellPair(raw.hole ?? raw.target ?? p.target)}, ` +
    `pushes: ${pushes}` +
    (Number.isFinite(raw.blocksMoved) ? `, blocksMoved: ${raw.blocksMoved}` : '') +
    (Number.isFinite(raw.solns) ? `, solns: ${raw.solns}` : '') +
    (Number.isFinite(raw.dif) ? `, dif: ${raw.dif}` : '') +
    (typeof raw.note === 'string' && raw.note ? `, note: ${JSON.stringify(raw.note)}` : '') +
    ','
  const sol =
    typeof raw.solution === 'string' && raw.solution
      ? `\n  solution: ${JSON.stringify(raw.solution)} },`
      : ' },'
  return head + sol
}

const next = {}
const removed = []
let fails = 0

for (const tier of TIERS) {
  const list = data[tier] || []
  if (!tierList.includes(tier)) {
    next[tier] = [...list]
    continue
  }
  const keep = []
  for (const [i, raw] of list.entries()) {
    const a = analyzePuzzle(engine, raw, false)
    if (!a.ok) {
      fails++
      keep.push(raw)
      console.warn(`  keep (analyze fail) ${tier}#${i + 1}: ${a.why}`)
      continue
    }
    if (isStartsForcedStaysForced(a)) {
      removed.push({
        tier,
        n: i + 1,
        pushes: a.pushes,
        opts: a.optsFull,
        dif: raw.dif,
      })
      continue
    }
    keep.push(raw)
  }
  next[tier] = keep
}

console.log(
  `Removed ${removed.length} starts-forced-stays-forced from ${tierList.join(',')}` +
    (fails ? ` (${fails} analyze failures kept)` : '')
)
for (const tier of tierList) {
  const n = removed.filter((r) => r.tier === tier).length
  console.log(
    `  ${tier}: −${n}  → ${next[tier].length} left (was ${(data[tier] || []).length})`
  )
}
console.log(
  `Ledger: tutorial ${next.tutorial.length}, easy ${next.easy.length}, medium ${next.medium.length}, hard ${next.hard.length}`
)

if (dryRun) {
  console.log('dry-run: no write')
  process.exit(0)
}

const src = fs.readFileSync(abs, 'utf8')
const headerMatch = src.match(/^[\s\S]*?export default \{\r?\n/)
if (!headerMatch) throw new Error('header not found')
const header = headerMatch[0].replace(/\r\n/g, '\n')
const body = TIERS.map((tier) => {
  const lines = next[tier].map(formatPuzzle).join('\n')
  return `  ${tier}: [\n${lines}\n  ],`
}).join('\n\n')
const out = `${header}${body}\n}\n`
fs.writeFileSync(abs, src.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out, 'utf8')
console.log('Wrote', abs)
