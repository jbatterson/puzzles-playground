/**
 * Full-ledger freedom report for Dung Beetle.
 *
 *   node tools/tetromino/analyzeFreedom.mjs
 *   node tools/tetromino/analyzeFreedom.mjs --tier=hard
 *   node tools/tetromino/analyzeFreedom.mjs --trace --tier=tutorial --index=0
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { analyzeFreedom } from './freedomScore.mjs'

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

const tierFilter = args.get('tier') || null
const trace = args.has('trace')
const indexArg = args.get('index')
const indexes = indexArg
  ? indexArg
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n))
  : null
const outPath = path.resolve(
  repoRoot,
  args.get('out') || 'tools/reports/dung-freedom.csv'
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
  'seqCount',
  'blockSeqCount',
  'ballSeqCount',
  'checkpointCount',
  'optionMass',
  'temptation',
  'freedom',
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

console.log('dungbeetle freedom score')

for (const tier of TIERS) {
  if (tierFilter && tier !== tierFilter) continue
  const list = data[tier] || []
  const pick =
    indexes && tierFilter
      ? indexes
      : indexes && !tierFilter
        ? null
        : [...list.keys()]

  const toScan = pick ?? [...list.keys()]
  console.log(`\n${tier} (${toScan.length}/${list.length})`)

  let freedomSum = 0
  let nOk = 0

  for (const i of toScan) {
    const raw = list[i]
    if (!raw) continue
    const a = analyzeFreedom(engine, raw)
    if (!a.ok) {
      failures++
      console.log(`  ✗ ${tier}[${i}] ${a.why}`)
      continue
    }

    if (trace) {
      console.log(
        `#${i} freedom=${a.freedom} A=${a.optionMass} B=${a.temptation} ` +
          `checkpoints=${a.checkpointCount} seqs=${a.sequences.map((s) => `${s.kind}:${s.glyphs}`).join(' | ')}`
      )
      for (const c of a.checkpoints) {
        console.log(
          `  ${c.at.padEnd(12)} A=${String(c.optionMass).padStart(3)} B=${String(c.temptation).padStart(3)} ` +
            `free=${c.freedom} unused=${c.unused} (+block ${c.freeBlockBonus} +reach ${c.reachBonus} +corr ${c.corridorBonus})`
        )
      }
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
      seqCount: a.seqCount,
      blockSeqCount: a.blockSeqCount,
      ballSeqCount: a.ballSeqCount,
      checkpointCount: a.checkpointCount,
      optionMass: a.optionMass,
      temptation: a.temptation,
      freedom: a.freedom,
    })
    freedomSum += a.freedom
    nOk++
  }

  console.log(
    `  done: ${nOk}  meanFreedom=${nOk ? (freedomSum / nOk).toFixed(1) : '—'}`
  )
}

if (!trace || args.has('out')) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  const lines = [
    HEADER.join(','),
    ...rows.map((r) => HEADER.map((h) => csvEscape(r[h])).join(',')),
  ]
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')
  console.log(`\nwrote ${outPath}`)
}

const ms = Date.now() - t0
console.log(`${rows.length} rows, ${failures} failures, ${ms}ms`)
if (failures) process.exit(1)
