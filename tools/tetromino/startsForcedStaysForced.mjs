/**
 * List "starts forced, stays forced" weed-out candidates.
 *
 * Rule (see branchingStats.isStartsForcedStaysForced):
 *   open == 1
 *   forcedEarly >= 3 in the first 5 block-push decisions
 *   after the first 2 decisions: never reaches 3 options and mean options < 2
 *
 * Early 1;1;1 is OK if the path opens later (e.g. 1;1;1;3) — those are not listed.
 *
 *   node tools/tetromino/startsForcedStaysForced.mjs
 *   node tools/tetromino/startsForcedStaysForced.mjs --mode=dung
 *   node tools/tetromino/startsForcedStaysForced.mjs --mode=dung --tier=medium
 *   node tools/tetromino/startsForcedStaysForced.mjs --csv   # also write tools/reports/...-forced.csv
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  BRANCHING_TIERS,
  analyzePuzzle,
  isStartsForcedStaysForced,
} from './branchingStats.mjs'

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

const modes = args.has('mode') ? [args.get('mode')] : ['dung']
const tierFilter = args.has('tier') ? args.get('tier') : null
const writeCsv = args.has('csv')
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
  'curateTier',
  'index0',
  'pushes',
  'open',
  'forcedEarly',
  'branchScore',
  'blockReversals',
  'ballReversals',
  'optsFull',
]

let total = 0
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

  const hits = []
  console.log(`\n${slug} — StartsForcedStaysForced`)
  console.log(
    '  rule: open=1, forcedEarly>=3 (first %d), tail after 2 decisions never opens (max<3 & mean<2)\n',
    earlyK
  )

  for (const tier of BRANCHING_TIERS) {
    if (tierFilter && tier !== tierFilter) continue
    const tierHits = []
    for (const [i, raw] of (data[tier] || []).entries()) {
      const a = analyzePuzzle(engine, raw, dungMode, { earlyK })
      if (!a.ok) {
        failures++
        console.log(`  ✗ ${tier}[${i}] ${a.why}`)
        continue
      }
      const row = { game: slug, tier, index0: i, curateTier: i + 1, ...a }
      if (!isStartsForcedStaysForced(row, earlyK)) continue
      tierHits.push(row)
      hits.push(row)
    }

    if (!tierHits.length) {
      console.log(`  ${tier}: (none)`)
      continue
    }
    console.log(`  ${tier}: ${tierHits.length} candidate(s)`)
    for (const r of tierHits.sort((a, b) => a.branchScore - b.branchScore || a.curateTier - b.curateTier)) {
      console.log(
        `    #${r.curateTier}  pushes=${r.pushes}  forced=${r.forcedEarly}  opts=${r.optsFull}  branch=${r.branchScore}` +
          (dungMode ? `  bRev=${r.blockReversals} ballRev=${r.ballReversals}` : `  bRev=${r.blockReversals}`)
      )
    }
  }

  total += hits.length
  console.log(`\n  ${hits.length} weed candidate(s) total for ${slug}`)

  if (writeCsv) {
    const out = path.join(
      repoRoot,
      'tools/reports',
      `${dungMode ? 'dung' : 'scuttle'}-starts-forced-stays-forced.csv`
    )
    fs.mkdirSync(path.dirname(out), { recursive: true })
    const lines = [
      HEADER.join(','),
      ...hits.map((r) => HEADER.map((h) => csvEscape(r[h])).join(',')),
    ]
    fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8')
    console.log(`  wrote ${out}`)
  }
}

console.log(`\n${total} candidate(s), ${failures} analyze failure(s).`)
if (failures > 0) process.exit(1)
