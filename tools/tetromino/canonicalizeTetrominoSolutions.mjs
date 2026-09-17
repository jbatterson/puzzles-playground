/**
 * For each Dung Beetle / Scuttlebug puzzle missing `solns`:
 *   - recompute official `solution` (min tetromino pushes, then min glyph length, then lex)
 *   - set `solns` = distinct per-piece (+ ball) trajectories among min-push solutions
 *   - refresh `ballPushes` / `blocksMoved` from the chosen path
 *
 * Puzzles that already have a finite `solns` are skipped (resume-friendly).
 * With `--write`, rewrites puzzles.js after each newly completed puzzle.
 *
 *   node tools/tetromino/canonicalizeTetrominoSolutions.mjs --mode=dung
 *   node tools/tetromino/canonicalizeTetrominoSolutions.mjs --mode=dung --write
 *   node tools/tetromino/canonicalizeTetrominoSolutions.mjs --mode=scuttle --write
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { analyzeCanonicalTetrominoSolution } from './pushEngine.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const write = process.argv.includes('--write')
const args = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const eq = a.indexOf('=')
      return eq === -1 ? [a.slice(2), 'true'] : [a.slice(2, eq), a.slice(eq + 1)]
    })
)

const mode = args.get('mode')
if (mode !== 'dung' && mode !== 'scuttle') {
  console.error('Required: --mode=dung or --mode=scuttle')
  process.exit(2)
}

const maxStates = args.has('max-states') ? Number(args.get('max-states')) : 2_000_000
const maxPaths = args.has('max-paths') ? Number(args.get('max-paths')) : 5_000_000
const timeBudgetMs = args.has('budget-ms') ? Number(args.get('budget-ms')) : 120_000

const dungMode = mode === 'dung'
const slug = dungMode ? 'dungbeetle' : 'scuttlebug'
const TIERS = ['tutorial', 'easy', 'medium', 'hard']

const DUNG_HEADER = `/**
 * Dung Beetle daily tiers + tutorial.
 *
 * Difficulty bands (approximate): easy lower pushes, medium mid, hard higher.
 * Layouts deduped across tiers.
 * Solution glyphs: capitals push — UDLR = tetromino (par), NSWE = ball; udlr = walk.
 * Official \`solution\` is min tetromino pushes, then min total glyphs, then lex — see
 * tools/tetromino/canonicalizeTetrominoSolutions.mjs / analyzeCanonicalTetrominoSolution.
 * \`solns\` = distinct per-piece trajectories among min-push solutions (free ball routing ignored).
 * Refresh: npm run canonicalize:tetromino -- --mode=dung --write (skips rows that already have solns).
 */
export default {
`

const SCUTTLE_HEADER = `/**
 * Scuttlebug daily tiers + tutorial.
 *
 * Difficulty bands (approximate): easy lower pushes, medium mid, hard higher.
 * Layouts deduped across tiers.
 * Solution glyphs: UDLR = tetromino push (par), udlr = walk.
 * Official \`solution\` is min tetromino pushes, then min total glyphs, then lex — see
 * tools/tetromino/canonicalizeTetrominoSolutions.mjs / analyzeCanonicalTetrominoSolution.
 * \`solns\` = distinct per-piece trajectories among min-push solutions (free ball routing ignored).
 * Refresh: npm run canonicalize:tetromino -- --mode=scuttle --write (skips rows that already have solns).
 */
export default {
`

function cellPair(v) {
  if (Array.isArray(v)) return `[${v[0]},${v[1]}]`
  return `[${v.r},${v.c}]`
}

function formatDungPuzzle(raw, normalizePuzzleInput) {
  const p = normalizePuzzleInput(raw, true)
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
    `ball: ${cellPair(raw.ball ?? p.ball)}, ` +
    `hole: ${cellPair(raw.hole ?? raw.target ?? p.target)}, ` +
    `pushes: ${pushes}` +
    (Number.isFinite(raw.ballPushes) ? `, ballPushes: ${raw.ballPushes}` : '') +
    (Number.isFinite(raw.blocksMoved) ? `, blocksMoved: ${raw.blocksMoved}` : '') +
    (Number.isFinite(raw.solns) ? `, solns: ${raw.solns}` : '') +
    ','
  const sol =
    typeof raw.solution === 'string' && raw.solution
      ? `\n  solution: ${JSON.stringify(raw.solution)} },`
      : ' },'
  return head + sol
}

function formatScuttlePuzzle(raw, normalizePuzzleInput) {
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
    ','
  const sol =
    typeof raw.solution === 'string' && raw.solution
      ? `\n  solution: ${JSON.stringify(raw.solution)} },`
      : ' },'
  return head + sol
}

function writeLedger(abs, next, normalizePuzzleInput) {
  const format = dungMode ? formatDungPuzzle : formatScuttlePuzzle
  const header = dungMode ? DUNG_HEADER : SCUTTLE_HEADER
  const body = TIERS.map((tier) => {
    const lines = (next[tier] || []).map((raw) => format(raw, normalizePuzzleInput)).join('\n')
    return `  ${tier}: [\n${lines}\n  ],`
  }).join('\n\n')
  fs.writeFileSync(abs, `${header}${body}\n}\n`, 'utf8')
}

const abs = path.join(repoRoot, `puzzlegames/${slug}/puzzles.js`)
const engine = await import(pathToFileURL(path.join(repoRoot, `puzzlegames/${slug}/engine.js`)).href)
const { normalizePuzzleInput } = engine
const data = (await import(pathToFileURL(abs).href + `?t=${Date.now()}`)).default

const next = {}
for (const tier of TIERS) {
  next[tier] = [...(data[tier] || [])]
}

let skipped = 0
let updated = 0
let failed = 0
let checked = 0
const t0 = Date.now()

console.log(`\n${slug}  (${write ? 'write' : 'dry-run'})`)

for (const tier of TIERS) {
  const list = next[tier]
  for (let i = 0; i < list.length; i++) {
    const raw = list[i]
    const label = `${tier}[${i}]`
    if (Number.isFinite(raw.solns)) {
      skipped++
      continue
    }
    checked++
    const puzzle = normalizePuzzleInput(raw, dungMode)
    const analysis = analyzeCanonicalTetrominoSolution(puzzle, {
      dungMode,
      maxStates,
      maxPaths,
      timeBudgetMs,
    })
    if (!analysis.ok) {
      failed++
      const why = analysis.reason || (analysis.timedOut ? 'timedOut' : 'cutoff')
      console.log(`  ✗ ${label} ${why} (states ${analysis.statesExplored ?? '?'})`)
      continue
    }

    const oldLen = typeof raw.solution === 'string' ? raw.solution.length : null
    const storedPar = raw.pushes ?? raw.minPushes ?? null
    const parNote =
      storedPar != null && storedPar !== analysis.pushes
        ? ` PAR ${storedPar}→${analysis.pushes}`
        : ''

    const updatedRow = {
      ...raw,
      pushes: analysis.pushes,
      blocksMoved: analysis.blocksMoved,
      solns: analysis.solns,
      solution: analysis.solution,
    }
    if (dungMode) updatedRow.ballPushes = analysis.ballPushes
    list[i] = updatedRow
    updated++

    console.log(
      `  → ${label} pushes=${analysis.pushes} moves ${oldLen ?? '?'}→${analysis.moves}` +
        ` solns=${analysis.solns} paths=${analysis.pathsEnumerated}${parNote}`
    )

    if (write) {
      writeLedger(abs, next, normalizePuzzleInput)
    }
  }
}

const ms = Date.now() - t0
console.log(
  `\n${checked} analyzed, ${updated} updated, ${skipped} skipped (have solns), ${failed} failed` +
    ` in ${(ms / 1000).toFixed(1)}s.` +
    (write ? ' Wrote after each update.' : ' Dry-run (pass --write to apply).')
)
if (failed > 0) process.exit(1)
