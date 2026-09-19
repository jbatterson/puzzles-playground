/**
 * Full-ledger naive-look report for Dung Beetle: counterintuitive pushes + greedy agent.
 *
 *   node tools/tetromino/analyzeNaiveLook.mjs
 *   node tools/tetromino/analyzeNaiveLook.mjs --out=tools/reports/dung-naive-look.csv
 *   node tools/tetromino/analyzeNaiveLook.mjs --tier=easy
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { dirFromSolutionChar } from './pushEngine.mjs'
import { analyzeNaivePuzzle } from './naiveLook.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const args = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const eq = a.indexOf('=')
      return eq === -1 ? [a.slice(2), 'true'] : [a.slice(2, eq), a.slice(eq + 1)]
    })
)

const pieceCost = args.has('piece-cost') ? Number(args.get('piece-cost')) : 4
const tierFilter = args.get('tier') || null
const outPath = path.resolve(
  repoRoot,
  args.get('out') || 'tools/reports/dung-naive-look.csv'
)

const TIERS = ['tutorial', 'easy', 'medium', 'hard']

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/dungbeetle/engine.js')).href
)
const data = (
  await import(pathToFileURL(path.join(repoRoot, 'puzzlegames/dungbeetle/puzzles.js')).href)
).default

const HEADER = [
  'tier',
  'index0',
  'curateTier',
  'size',
  'pushes',
  'ballPushes',
  'blocksMoved',
  'solns',
  'hStart',
  'hEnd',
  'counterintuitive',
  'clearAtStart',
  'clearFlipAt',
  'greedySolved',
  'greedyOutcome',
  'greedyPushes',
  'greedyHEnd',
  'greedyBudget',
  'greedySteps',
]

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const rows = []
let failures = 0
const t0 = Date.now()

console.log(`dungbeetle naive-look  pieceCost=${pieceCost}`)

for (const tier of TIERS) {
  if (tierFilter && tier !== tierFilter) continue
  const list = data[tier] || []
  let solved = 0
  let ciSum = 0
  console.log(`\n${tier} (${list.length})`)

  for (const [i, raw] of list.entries()) {
    const a = analyzeNaivePuzzle(engine, raw, { dirFromSolutionChar, pieceCost })
    if (!a.ok) {
      failures++
      console.log(`  ✗ ${tier}[${i}] ${a.why}`)
      continue
    }
    const puzzle = engine.normalizePuzzleInput(raw, true)
    rows.push({
      tier,
      index0: i,
      curateTier: i + 1,
      size: puzzle.size,
      pushes: a.pushes,
      ballPushes: a.ballPushes,
      blocksMoved: a.blocksMoved,
      solns: a.solns,
      hStart: a.hStart,
      hEnd: a.hEnd,
      counterintuitive: a.counterintuitive,
      clearAtStart: a.clearAtStart,
      clearFlipAt: a.clearFlipAt ?? '',
      greedySolved: a.greedySolved,
      greedyOutcome: a.greedyOutcome,
      greedyPushes: a.greedyPushes,
      greedyHEnd: a.greedyHEnd,
      greedyBudget: a.greedyBudget,
      greedySteps: a.greedySteps,
    })
    solved += a.greedySolved
    ciSum += a.counterintuitive
    if ((i + 1) % 25 === 0 || i + 1 === list.length) {
      process.stderr.write(`  … ${i + 1}/${list.length}\n`)
    }
  }

  const n = rows.filter((r) => r.tier === tier).length
  console.log(
    `  done: ${n}  greedySolved=${solved}/${n}  meanCI=${n ? (ciSum / n).toFixed(2) : '—'}`
  )
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
const lines = [
  HEADER.join(','),
  ...rows.map((r) => HEADER.map((h) => csvEscape(r[h])).join(',')),
]
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')

const ms = Date.now() - t0
const gOk = rows.filter((r) => r.greedySolved === 1).length
console.log(`\nwrote ${outPath}`)
console.log(`${rows.length} rows, ${gOk} greedy-solved, ${failures} failures, ${ms}ms`)
if (failures) process.exit(1)
