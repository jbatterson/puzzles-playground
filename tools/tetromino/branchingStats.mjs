/**
 * Shared branching / option-count analysis for tetromino push games.
 * Used by analyzeBranching.mjs and startsForcedStaysForced.mjs.
 */
import { dirFromSolutionChar } from './pushEngine.mjs'

export const BRANCHING_TIERS = ['tutorial', 'easy', 'medium', 'hard']

const DIRS4 = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

function walkReachable(state, dungMode) {
  const size = state.size
  const blocked = new Set()
  for (const p of state.pieces) {
    for (const c of p.cells) blocked.add(`${c.r},${c.c}`)
  }
  if (dungMode && state.ball) blocked.add(`${state.ball.r},${state.ball.c}`)
  const start = `${state.player.r},${state.player.c}`
  const seen = new Set([start])
  const q = [{ r: state.player.r, c: state.player.c }]
  for (let i = 0; i < q.length; i++) {
    const { r, c } = q[i]
    for (const [dr, dc] of DIRS4) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
      const k = `${nr},${nc}`
      if (seen.has(k) || blocked.has(k)) continue
      seen.add(k)
      q.push({ r: nr, c: nc })
    }
  }
  return seen
}

/** Distinct piece indices pushable from the beetle's current walk region. */
export function pushablePieces(state, dungMode, engine) {
  const size = state.size
  const region = walkReachable(state, dungMode)
  const out = new Set()
  for (let i = 0; i < state.pieces.length; i++) {
    for (const [dr, dc] of DIRS4) {
      if (!engine.canMovePieceIn(state.pieces, i, dr, dc, size)) continue
      if (dungMode && state.ball) {
        let hitsBall = false
        for (const cell of state.pieces[i].cells) {
          if (cell.r + dr === state.ball.r && cell.c + dc === state.ball.c) {
            hitsBall = true
            break
          }
        }
        if (hitsBall) continue
      }
      for (const cell of state.pieces[i].cells) {
        const sr = cell.r - dr
        const sc = cell.c - dc
        if (!engine.inBounds(sr, sc, size)) continue
        if (!region.has(`${sr},${sc}`)) continue
        out.add(i)
        break
      }
      if (out.has(i)) break
    }
  }
  return out
}

function makeReversalTracker() {
  const last = new Map()
  let count = 0
  return {
    get count() {
      return count
    },
    note(key, dr, dc) {
      let axis = last.get(key)
      if (!axis) {
        axis = { v: null, h: null }
        last.set(key, axis)
      }
      if (dr !== 0) {
        if (axis.v != null && axis.v === -dr) count++
        axis.v = dr
      }
      if (dc !== 0) {
        if (axis.h != null && axis.h === -dc) count++
        axis.h = dc
      }
    },
  }
}

function branchScore(open, earlyOpts) {
  if (!earlyOpts.length) return +(0.4 * open).toFixed(2)
  const mean = earlyOpts.reduce((a, b) => a + b, 0) / earlyOpts.length
  const min = Math.min(...earlyOpts)
  return +(0.4 * open + 0.35 * mean + 0.25 * min).toFixed(2)
}

/**
 * Replay solution; record pushable-piece counts before each tetromino push.
 * @param {{ earlyK?: number }} [opts]
 */
export function analyzePuzzle(engine, raw, dungMode, opts = {}) {
  const earlyK = opts.earlyK ?? 5
  const puzzle = engine.normalizePuzzleInput(raw, dungMode)
  let state = engine.initPlayState(puzzle)
  const solution = typeof raw.solution === 'string' ? raw.solution : ''

  const openAtStart = pushablePieces(state, dungMode, engine).size
  const optsFull = []
  const blockRev = makeReversalTracker()
  const ballRev = makeReversalTracker()
  let pushes = 0

  for (const ch of solution) {
    if (engine.checkWon(state)) break
    const dir = dirFromSolutionChar(ch)
    if (!dir) return { ok: false, why: `bad character "${ch}"` }

    const ballBefore =
      dungMode && state.ball ? { r: state.ball.r, c: state.ball.c } : null
    const hitBefore = engine.pieceAtIn(
      state.pieces,
      state.player.r + dir.dr,
      state.player.c + dir.dc
    )

    const move = engine.tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return { ok: false, why: `illegal move at "${ch}"` }

    if (move.pushedTetromino) {
      optsFull.push(pushablePieces(state, dungMode, engine).size)
      if (hitBefore >= 0) blockRev.note(hitBefore, dir.dr, dir.dc)
      pushes++
    } else if (
      dungMode &&
      ballBefore &&
      move.state.ball &&
      (move.state.ball.r !== ballBefore.r || move.state.ball.c !== ballBefore.c)
    ) {
      ballRev.note('ball', dir.dr, dir.dc)
    }

    state = move.state
  }

  const open = optsFull.length ? optsFull[0] : openAtStart
  if (!optsFull.length) optsFull.push(open)

  const earlyOpts = optsFull.slice(0, Math.min(earlyK, optsFull.length))
  const forcedEarly = earlyOpts.filter((n) => n <= 1).length
  const forcedRatio = earlyOpts.length ? +(forcedEarly / earlyOpts.length).toFixed(3) : 0
  const minEarly = earlyOpts.length ? Math.min(...earlyOpts) : open
  const meanEarly = earlyOpts.length
    ? +(earlyOpts.reduce((a, b) => a + b, 0) / earlyOpts.length).toFixed(2)
    : open

  return {
    ok: true,
    size: puzzle.size,
    pieces: puzzle.pieces.length,
    pushes: raw.pushes ?? raw.minPushes ?? null,
    ballPushes: raw.ballPushes ?? null,
    blocksMoved: raw.blocksMoved ?? null,
    open,
    forcedEarly,
    forcedRatio,
    minEarly,
    meanEarly,
    branchScore: branchScore(open, earlyOpts),
    blockReversals: blockRev.count,
    ballReversals: dungMode ? ballRev.count : '',
    optsEarly: earlyOpts.join(';'),
    optsFull: optsFull.join(';'),
    optsFullArr: optsFull,
    solution,
    sampledPushes: pushes,
  }
}

/**
 * Weed rule: starts with only one pushable piece, stays forced through early pushes,
 * and never meaningfully opens up later.
 *
 * - open == 1
 * - forcedEarly >= 3 (among first `earlyK` decisions)
 * - after the first 2 decisions: max(tail) < 3 AND mean(tail) < 2
 *
 * `1;1;1;3` recovers (keep). `1;1;1;1` / `1;1;1;2` / `1;2;1;1` do not (weed).
 */
export function isStartsForcedStaysForced(row, earlyK = 5) {
  const opts =
    row.optsFullArr ||
    String(row.optsFull || '')
      .split(';')
      .map(Number)
      .filter((n) => Number.isFinite(n))

  const open = row.open != null ? +row.open : opts[0]
  const earlyOpts = opts.slice(0, Math.min(earlyK, opts.length))
  const forcedEarly =
    row.forcedEarly != null ? +row.forcedEarly : earlyOpts.filter((n) => n <= 1).length

  if (open !== 1 || forcedEarly < 3) return false

  const tail = opts.slice(2)
  if (!tail.length) return true
  const maxT = Math.max(...tail)
  const meanT = tail.reduce((a, b) => a + b, 0) / tail.length
  return maxT < 3 && meanT < 2
}
