/**
 * Recase every Dung Beetle / Scuttlebug `solution` string (capitals = pushing):
 *   UDLR = tetromino push (par)
 *   udlr = beetle walk
 *   NSWE = ball roll (N↑ S↓ W← E→; dung only)
 *
 * Does not re-solve: replays the stored path through the game engine and rewrites glyphs.
 *
 *   node tools/tetromino/annotateTetrominoSolutions.mjs
 *   node tools/tetromino/annotateTetrominoSolutions.mjs --write
 *   node tools/tetromino/annotateTetrominoSolutions.mjs --mode=dung --write
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { dirFromSolutionChar } from './pushEngine.mjs'

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
const modes = args.has('mode') ? [args.get('mode')] : ['dung', 'scuttle']
const TIERS = ['tutorial', 'easy', 'medium', 'hard']

function encodeFromDir(dir, kind) {
  if (kind === 'push') return dir.ch
  if (kind === 'ball') return dir.ball
  return dir.walk
}

/**
 * Replay and annotate. Legacy all-caps and already-annotated paths both work.
 * @returns {{ ok: true, solution: string, pushes: number } | { ok: false, why: string }}
 */
function annotateSolution(engine, puzzle, solution, dungMode) {
  if (typeof solution !== 'string' || !solution.length) {
    return { ok: false, why: 'missing solution' }
  }
  let state = engine.initPlayState(puzzle)
  let pushes = 0
  let out = ''
  let won = false

  for (const ch of solution) {
    const dir = dirFromSolutionChar(ch)
    if (!dir) return { ok: false, why: `bad character "${ch}"` }

    const ballBefore = dungMode && state.ball ? `${state.ball.r},${state.ball.c}` : null
    const move = engine.tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return { ok: false, why: `illegal move at "${ch}"` }
    state = move.state

    let kind = 'walk'
    if (move.pushedTetromino) {
      kind = 'push'
      pushes++
    } else if (dungMode && state.ball && `${state.ball.r},${state.ball.c}` !== ballBefore) {
      kind = 'ball'
    }
    out += encodeFromDir(dir, kind)

    if (engine.checkWon(state)) {
      won = true
      break
    }
  }

  if (!won) return { ok: false, why: 'path ends without a win' }
  return { ok: true, solution: out, pushes }
}

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

const DUNG_HEADER = `/**
 * Dung Beetle daily tiers + tutorial.
 *
 * Difficulty bands (approximate): easy lower pushes, medium mid, hard higher.
 * Layouts deduped across tiers.
 * Solution glyphs: capitals push — UDLR = tetromino (par), NSWE = ball; udlr = walk.
 */
export default {
`

const SCUTTLE_HEADER = `/**
 * Scuttlebug daily tiers + tutorial.
 *
 * Difficulty bands (approximate): easy lower pushes, medium mid, hard higher.
 * Solution glyphs: UDLR = tetromino push (par), udlr = walk.
 */
export default {
`

let changed = 0
let failed = 0
let checked = 0

for (const mode of modes) {
  const dungMode = mode === 'dung'
  const slug = dungMode ? 'dungbeetle' : 'scuttlebug'
  const abs = path.join(repoRoot, `puzzlegames/${slug}/puzzles.js`)
  const engine = await import(pathToFileURL(path.join(repoRoot, `puzzlegames/${slug}/engine.js`)).href)
  const { normalizePuzzleInput } = engine
  const data = (await import(pathToFileURL(abs).href + `?t=${Date.now()}`)).default

  console.log(`\n${slug}`)
  const next = {}

  for (const tier of TIERS) {
    const list = data[tier] || []
    next[tier] = []
    for (const [i, raw] of list.entries()) {
      checked++
      const puzzle = normalizePuzzleInput(raw, dungMode)
      const label = `${tier}[${i}]`
      if (!raw.solution) {
        console.log(`  · ${label} no solution`)
        next[tier].push(raw)
        continue
      }
      const annotated = annotateSolution(engine, puzzle, raw.solution, dungMode)
      if (!annotated.ok) {
        failed++
        console.log(`  ✗ ${label} ${annotated.why}`)
        next[tier].push(raw)
        continue
      }
      const storedPar = raw.pushes ?? raw.minPushes ?? null
      if (storedPar != null && annotated.pushes !== storedPar) {
        failed++
        console.log(
          `  ✗ ${label} annotated pushes ${annotated.pushes} ≠ stored par ${storedPar}`
        )
        next[tier].push(raw)
        continue
      }
      const same = annotated.solution === raw.solution
      if (!same) changed++
      console.log(
        `  ${same ? '·' : '→'} ${label} ${raw.solution.length} moves` +
          (same ? '' : `\n      ${raw.solution}\n      ${annotated.solution}`)
      )
      next[tier].push({ ...raw, solution: annotated.solution })
    }
  }

  if (write) {
    const format = dungMode ? formatDungPuzzle : formatScuttlePuzzle
    const header = dungMode ? DUNG_HEADER : SCUTTLE_HEADER
    const body = TIERS.map((tier) => {
      const lines = next[tier].map((raw) => format(raw, normalizePuzzleInput)).join('\n')
      return `  ${tier}: [\n${lines}\n  ],`
    }).join('\n\n')
    fs.writeFileSync(abs, `${header}${body}\n}\n`, 'utf8')
    console.log(`  wrote ${abs}`)
  }
}

console.log(
  `\n${checked} checked, ${changed} would change, ${failed} failed.` +
    (write ? ' Wrote files.' : ' Dry-run (pass --write to apply).')
)
if (failed > 0) process.exit(1)
