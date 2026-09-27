/**
 * CLI: same-shape trail-overlap clump cull (keep floor(n/2)).
 *
 *   node tools/tetromino/cullScuttlebugOverlapClumps.mjs
 *   node tools/tetromino/cullScuttlebugOverlapClumps.mjs --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  cullExactClusters,
  cullSameShapeOverlapClumps,
  rebucketByPushes,
} from './scuttlebugNearDupeCull.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const abs = path.join(repoRoot, 'puzzlegames/scuttlebug/puzzles.js')
const dryRun = process.argv.includes('--dry-run')
const cellsOnly = process.argv.includes('--cells-only')
const overlapOnly = process.argv.includes('--overlap-only')

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/scuttlebug/engine.js')).href
)
const { normalizePuzzleInput } = engine
const data = (await import(pathToFileURL(abs).href + `?t=${Date.now()}`)).default

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

let cur = {
  tutorial: data.tutorial || [],
  easy: [...(data.easy || [])],
  medium: [...(data.medium || [])],
  hard: [...(data.hard || [])],
}
const before =
  cur.easy.length + cur.medium.length + cur.hard.length + cur.tutorial.length

if (!overlapOnly) {
  const cells = cullExactClusters(cur, engine, (a) => a.cellsKey)
  console.log(`cells cull: −${cells.removed} across ${cells.clusters} clusters`)
  cur = { tutorial: cur.tutorial, ...cells.data }
}
if (!cellsOnly) {
  const overlap = cullSameShapeOverlapClumps(cur, engine)
  console.log(`overlap cull: −${overlap.removed} across ${overlap.clumps} clumps`)
  cur = {
    tutorial: cur.tutorial,
    easy: overlap.data.easy,
    medium: overlap.data.medium,
    hard: overlap.data.hard,
  }
}
const bucketed = rebucketByPushes(cur.easy, cur.medium, cur.hard)
cur = { tutorial: cur.tutorial, ...bucketed }

const after = cur.easy.length + cur.medium.length + cur.hard.length + cur.tutorial.length
console.log(
  `${before} → ${after}: tutorial ${cur.tutorial.length}, easy ${cur.easy.length}, medium ${cur.medium.length}, hard ${cur.hard.length}`
)

if (dryRun) {
  console.log('dry-run: no write')
  process.exit(0)
}

const TIERS = ['tutorial', 'easy', 'medium', 'hard']
const src = fs.readFileSync(abs, 'utf8')
const headerMatch = src.match(/^[\s\S]*?export default \{\r?\n/)
if (!headerMatch) throw new Error('header not found')
const header = headerMatch[0].replace(/\r\n/g, '\n')
const body = TIERS.map((tier) => {
  const lines = (cur[tier] || []).map(formatPuzzle).join('\n')
  return `  ${tier}: [\n${lines}\n  ],`
}).join('\n\n')
fs.writeFileSync(
  abs,
  src.includes('\r\n') ? (header + body + '\n}\n').replace(/\n/g, '\r\n') : header + body + '\n}\n',
  'utf8'
)
console.log('Wrote', abs)
