/**
 * Bulk puzzle generator for Dung Beetle (`--mode=dung`) and Scuttlebug (`--mode=scuttle`).
 *
 * Builds candidates by undoing pushes from a solved board, then verifies each one forward to
 * get the true push optimum. Ledger lines go to stdout, progress to stderr, so output can be
 * piped straight into a file and pasted into the game's puzzles.js.
 *
 *   node tools/tetromino/findTetrominoPuzzles.mjs --mode=dung --size=7 --count=20 \
 *     --counts=1,1,1,1,1 --min-pushes=7 --max-pushes=14 --min-moved=3 --max-moves=40
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  PIECE_TYPES,
  createRng,
  generateByReversePushes,
  solvePushPuzzle,
  formatLedgerLine,
} from './pushEngine.mjs'

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
const num = (key, fallback) => (args.has(key) ? Number(args.get(key)) : fallback)
const str = (key, fallback) => (args.has(key) ? args.get(key) : fallback)

const mode = str('mode', 'dung')
const dungMode = mode === 'dung'
const size = num('size', 7)
const wanted = num('count', 10)
const minPushes = num('min-pushes', 7)
const maxPushes = num('max-pushes', minPushes + 6)
const minMoved = num('min-moved', 3)
const maxMoves = num('max-moves', 40)
const minBallPushes = num('min-ball-pushes', 0)
const maxBallPushes = num('max-ball-pushes', 99)
const maxStates = num('max-states', 250000)
const timeBudgetMs = num('verify-ms', 4000)
const attemptCap = num('attempts', 200000)
const wallClockMs = num('budget-ms', 120000)
const seed = num('seed', Date.now() & 0x7fffffff)
const quiet = args.has('quiet')
// Off by default: guaranteeing every undo is walk-valid also rules out the sealed-in wins that
// make these puzzles hard, and the forward verify already rejects anything unsolvable.
const strictChain = args.has('strict-chain')

const counts = Object.fromEntries(PIECE_TYPES.map((t) => [t, 1]))
if (args.has('counts')) {
  const parts = str('counts', '').split(',').map(Number)
  PIECE_TYPES.forEach((t, i) => {
    counts[t] = Number.isFinite(parts[i]) ? parts[i] : 0
  })
}

const pieceTotal = PIECE_TYPES.reduce((sum, t) => sum + counts[t], 0)
const log = (msg) => {
  if (!quiet) process.stderr.write(msg + '\n')
}

/* ── Preflight: refuse requests the board cannot satisfy ────────────────────── */

const problems = []
if (!['dung', 'scuttle'].includes(mode)) problems.push(`--mode must be dung or scuttle`)
if (size < 4 || size > 8) problems.push('--size must be 4..8')
if (pieceTotal < 1) problems.push('--counts must include at least one piece')
if (minMoved > pieceTotal) {
  problems.push(`--min-moved=${minMoved} exceeds the ${pieceTotal} piece(s) in --counts`)
}
if (minMoved > maxPushes) {
  problems.push(`--min-moved=${minMoved} cannot be met within --max-pushes=${maxPushes}`)
}
if (minPushes > maxPushes) problems.push('--min-pushes exceeds --max-pushes')
if (!(maxMoves >= 1)) problems.push('--max-moves must be at least 1')
if (maxMoves < minPushes) {
  problems.push(`--max-moves=${maxMoves} is below --min-pushes=${minPushes}`)
}

const freeCells = size * size - pieceTotal * 4
if (freeCells < (dungMode ? 2 : 1)) {
  problems.push(`${pieceTotal} pieces leave only ${freeCells} free cell(s) on a ${size}x${size} board`)
}
if (freeCells < pieceTotal) {
  problems.push(
    `${pieceTotal} pieces on a ${size}x${size} board leave ${freeCells} free cell(s) - pieces will rarely have room to move`
  )
}
if (!dungMode && minBallPushes > 0) problems.push('--min-ball-pushes only applies to --mode=dung')

if (problems.length) {
  problems.forEach((p) => process.stderr.write(`Impossible request: ${p}\n`))
  process.exit(1)
}

/* ── Dedupe against the pools already committed ─────────────────────────────── */

const fingerprint = (puzzle) =>
  JSON.stringify({
    s: puzzle.size,
    p: puzzle.pieces
      .map((piece) =>
        piece.cells
          .map((cell) => `${cell.r},${cell.c}`)
          .sort()
          .join('|')
      )
      .sort(),
    pl: [puzzle.player.r, puzzle.player.c],
    b: puzzle.ball ? [puzzle.ball.r, puzzle.ball.c] : null,
    t: [puzzle.target.r, puzzle.target.c],
  })

const seenFingerprints = new Set()
const existingRel = str('dedupe-against', `puzzlegames/${dungMode ? 'dungbeetle' : 'scuttlebug'}/puzzles.js`)
if (existingRel !== 'none') {
  const abs = path.join(repoRoot, existingRel)
  if (fs.existsSync(abs)) {
    const { default: data } = await import(pathToFileURL(abs).href)
    const { normalizePuzzleInput } = await import(
      pathToFileURL(path.join(repoRoot, `puzzlegames/${dungMode ? 'dungbeetle' : 'scuttlebug'}/engine.js`)).href
    )
    let loaded = 0
    for (const tier of ['tutorial', 'easy', 'medium', 'hard']) {
      for (const raw of data[tier] || []) {
        seenFingerprints.add(fingerprint(normalizePuzzleInput(raw, dungMode)))
        loaded++
      }
    }
    log(`Deduping against ${loaded} existing ${mode} puzzle(s) in ${existingRel}`)
  }
}

/* ── Generate ───────────────────────────────────────────────────────────────── */

const rng = createRng(seed)
const startedAt = Date.now()

// Reverse chains overshoot: undoing 12 pushes rarely needs 12 to solve forward. Sample a
// spread of lengths per attempt so one bad guess can't stall the run, and nudge the base
// toward whichever side of the push band is rejecting more.
let chainBase = Math.max(minPushes, minMoved) + 1
const CHAIN_SPREAD = 4
const chainCeiling = minPushes + 8
// The ball rolls for free, so pushes are only ever needed to clear its path. Retreating the
// ball a long way in reverse is what forces the forward solution to open real corridors.
const ballPulls = dungMode ? num('ball-pulls', 2 * minPushes) : 0
let lastTuned = 0
let tunedBelow = 0
let tunedAbove = 0

const tally = {
  attempts: 0,
  buildFailed: 0,
  duplicate: 0,
  unsolvable: 0,
  cutoff: 0,
  belowBand: 0,
  aboveBand: 0,
  tooFewMoved: 0,
  ballBand: 0,
  tooLong: 0,
  kept: 0,
}
/** Optimum push counts seen, so a barren run shows where the band actually sits. */
const pushHistogram = new Map()

log(
  `Seed ${seed} - ${mode} ${size}x${size}, pieces ${PIECE_TYPES.map((t) => `${t}${counts[t]}`).join('')}, ` +
    `pushes ${minPushes}-${maxPushes}, ≥${minMoved} moved, ≤${maxMoves} moves`
)

const keepers = []
let lastReport = Date.now()

while (keepers.length < wanted && tally.attempts < attemptCap) {
  if (Date.now() - startedAt > wallClockMs) {
    log(`Wall-clock budget of ${wallClockMs}ms reached.`)
    break
  }
  tally.attempts++

  const candidate = generateByReversePushes({
    size,
    counts,
    dungMode,
    reversePushes: Math.min(chainCeiling, chainBase + Math.floor(rng() * (CHAIN_SPREAD + 1))),
    minMoved,
    ballPulls,
    strictChain,
    rng,
  })
  if (!candidate) {
    tally.buildFailed++
    continue
  }

  const fp = fingerprint(candidate)
  if (seenFingerprints.has(fp)) {
    tally.duplicate++
    continue
  }
  seenFingerprints.add(fp)

  const result = solvePushPuzzle(candidate, { dungMode, maxStates, timeBudgetMs })

  if (result.solvable) {
    pushHistogram.set(result.pushes, (pushHistogram.get(result.pushes) || 0) + 1)
  }

  if (result.cutoff) tally.cutoff++
  else if (!result.solvable) tally.unsolvable++
  else if (result.pushes < minPushes) tally.belowBand++
  else if (result.pushes > maxPushes) tally.aboveBand++
  else if (result.blocksMoved < minMoved) tally.tooFewMoved++
  else if (dungMode && (result.ballPushes < minBallPushes || result.ballPushes > maxBallPushes)) {
    tally.ballBand++
  } else if (!result.solution) {
    tally.unsolvable++
  } else if (result.solution.length > maxMoves) {
    tally.tooLong++
  } else {
    tally.kept++
    keepers.push({ candidate, result })
    process.stdout.write(formatLedgerLine(candidate, result, dungMode) + '\n')
    log(
      `  kept ${keepers.length}/${wanted}: ${result.pushes} pushes, ${result.blocksMoved} moved` +
        (dungMode ? `, ${result.ballPushes} ball` : '') +
        `, ${result.solution.length} moves, ${result.statesExplored} states`
    )
  }

  if (tally.attempts - lastTuned >= 3000) {
    const below = tally.belowBand - tunedBelow
    const above = tally.aboveBand - tunedAbove
    if (below > above * 4 && chainBase < chainCeiling) chainBase++
    else if (above > below && chainBase > minMoved) chainBase--
    lastTuned = tally.attempts
    tunedBelow = tally.belowBand
    tunedAbove = tally.aboveBand
  }

  if (Date.now() - lastReport > 4000) {
    lastReport = Date.now()
    log(
      `  ${tally.attempts} attempts, ${keepers.length} kept - chain ${Math.min(chainCeiling, chainBase)}-${Math.min(chainCeiling, chainBase + CHAIN_SPREAD)}; ` +
        `below ${tally.belowBand}, above ${tally.aboveBand}, cutoff ${tally.cutoff}, ` +
        `few-moved ${tally.tooFewMoved}, unbuildable ${tally.buildFailed}`
    )
  }
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
log(`\nDone in ${elapsed}s - ${keepers.length}/${wanted} kept from ${tally.attempts} attempts.`)
log(
  `Rejections: below band ${tally.belowBand}, above band ${tally.aboveBand}, ` +
    `too few moved ${tally.tooFewMoved}, ball band ${tally.ballBand}, ` +
    `too long (>${maxMoves} moves) ${tally.tooLong}, ` +
    `verify cutoff ${tally.cutoff}, unsolvable ${tally.unsolvable}, ` +
    `unbuildable ${tally.buildFailed}, duplicate ${tally.duplicate}`
)
if (pushHistogram.size) {
  const rows = [...pushHistogram.entries()].sort((a, b) => a[0] - b[0])
  log(`Optima found: ${rows.map(([pushes, n]) => `${pushes}:${n}`).join('  ')}`)
}

if (keepers.length === 0) {
  log('\nNothing found. Try widening --min-pushes/--max-pushes, lowering --min-moved, or raising --budget-ms.')
  process.exit(2)
}
