/**
 * Branching + reversal stats for Dung Beetle / Scuttlebug ledgers.
 *
 * At each decision (before the first block push, and after each subsequent block push
 * along the stored solution), counts how many distinct pieces the beetle can push from
 * its walk region. Also counts axis reversals per piece and for the ball.
 *
 *   node tools/tetromino/analyzeBranching.mjs
 *   node tools/tetromino/analyzeBranching.mjs --mode=dung
 *   node tools/tetromino/analyzeBranching.mjs --mode=dung --out=tools/reports/dung-branching.csv
 *
 * Weed-out list (starts forced / stays forced): tools/tetromino/startsForcedStaysForced.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { BRANCHING_TIERS, analyzePuzzle } from './branchingStats.mjs'

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

const modes = args.has('mode') ? [args.get('mode')] : ['dung', 'scuttle']
const earlyK = args.has('early') ? Number(args.get('early')) : 5

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const HEADER = [
  'game',
  'tier',
  'index0',
  'curateTier',
  'size',
  'pieces',
  'pushes',
  'ballPushes',
  'blocksMoved',
  'open',
  'forcedEarly',
  'forcedRatio',
  'minEarly',
  'meanEarly',
  'branchScore',
  'blockReversals',
  'ballReversals',
  'optsEarly',
  'optsFull',
  'solution',
]

let totalRows = 0
let failures = 0

for (const mode of modes) {
  const dungMode = mode === 'dung'
  const slug = dungMode ? 'dungbeetle' : 'scuttlebug'
  const engine = await import(
    pathToFileURL(path.join(repoRoot, `puzzlegames/${slug}/engine.js`)).href
  )
  const data = (
    await import(pathToFileURL(path.join(repoRoot, `puzzlegames/${slug}/puzzles.js`)).href)
  ).default

  const rows = []
  console.log(`\n${slug}`)

  for (const tier of BRANCHING_TIERS) {
    for (const [i, raw] of (data[tier] || []).entries()) {
      const a = analyzePuzzle(engine, raw, dungMode, { earlyK })
      if (!a.ok) {
        failures++
        console.log(`  ✗ ${tier}[${i}] ${a.why}`)
        continue
      }
      const { optsFullArr: _omit, ...rest } = a
      rows.push({
        game: slug,
        tier,
        index0: i,
        curateTier: i + 1,
        ...rest,
      })
      totalRows++
    }
  }

  const defaultOut = path.join(
    repoRoot,
    'tools/reports',
    `${dungMode ? 'dung' : 'scuttle'}-branching.csv`
  )
  const outPath = args.has('out') ? path.resolve(repoRoot, args.get('out')) : defaultOut

  const writePath =
    modes.length > 1 && args.has('out')
      ? path.join(path.dirname(outPath), `${dungMode ? 'dung' : 'scuttle'}-branching.csv`)
      : modes.length > 1
        ? defaultOut
        : outPath

  fs.mkdirSync(path.dirname(writePath), { recursive: true })
  const lines = [
    HEADER.join(','),
    ...rows.map((r) => HEADER.map((h) => csvEscape(r[h])).join(',')),
  ]
  fs.writeFileSync(writePath, lines.join('\n') + '\n', 'utf8')
  console.log(`  ${rows.length} rows → ${writePath}`)

  const opens = rows.reduce((m, r) => {
    m[r.open] = (m[r.open] || 0) + 1
    return m
  }, {})
  console.log(`  open hist: ${JSON.stringify(opens)}`)
  console.log(
    `  blockReversals max=${Math.max(0, ...rows.map((r) => r.blockReversals))} ` +
      `ballReversals max=${dungMode ? Math.max(0, ...rows.map((r) => r.ballReversals)) : 'n/a'}`
  )
}

console.log(`\n${totalRows} puzzles, ${failures} failed.`)
if (failures > 0) process.exit(1)
