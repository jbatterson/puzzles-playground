/**
 * Naive "how solved does this board look?" score for Dung Beetle.
 *
 *   h = 100*(1-reachBall) + 10*(1-clear) + (clear ? ballDist : softDist)
 *
 * - reachBall: beetle can stand on an empty neighbor of the ball
 * - clear / ballDist: with pieces frozen, min ball pushes to hole (walk free)
 * - softDist: BFS ball→hole with empty cost 1, piece cell cost P
 *
 * Lower is better. Solved board → 0.
 */

const DIRS4 = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

const DEFAULT_PIECE_COST = 4

function cellKey(r, c) {
  return `${r},${c}`
}

function occupiedSet(pieces) {
  const occ = new Set()
  for (const p of pieces) {
    for (const c of p.cells) occ.add(cellKey(c.r, c.c))
  }
  return occ
}

/** Flood empty cells from start; ball and pieces are walls. */
export function walkRegion(state) {
  const size = state.size
  const occ = occupiedSet(state.pieces)
  const ballK = cellKey(state.ball.r, state.ball.c)
  const start = cellKey(state.player.r, state.player.c)
  if (occ.has(start) || start === ballK) return new Set()

  const seen = new Set([start])
  const q = [{ r: state.player.r, c: state.player.c }]
  for (let i = 0; i < q.length; i++) {
    const { r, c } = q[i]
    for (const [dr, dc] of DIRS4) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
      const k = cellKey(nr, nc)
      if (seen.has(k) || occ.has(k) || k === ballK) continue
      seen.add(k)
      q.push({ r: nr, c: nc })
    }
  }
  return seen
}

export function canReachBall(state) {
  if (!state?.ball || !state?.player) return false
  const region = walkRegion(state)
  for (const [dr, dc] of DIRS4) {
    const r = state.ball.r + dr
    const c = state.ball.c + dc
    if (r < 0 || r >= state.size || c < 0 || c >= state.size) continue
    if (region.has(cellKey(r, c))) return true
  }
  return false
}

/**
 * Soft BFS: empty=1, piece=pieceCost. Ball start; hole goal.
 * Player is ignored (geometry only).
 */
export function softBallDist(state, pieceCost = DEFAULT_PIECE_COST) {
  const size = state.size
  const hole = state.target
  const occ = occupiedSet(state.pieces)
  const start = cellKey(state.ball.r, state.ball.c)
  const goal = cellKey(hole.r, hole.c)
  if (start === goal) return 0

  const dist = new Map([[start, 0]])
  const q = [{ r: state.ball.r, c: state.ball.c }]
  for (let i = 0; i < q.length; i++) {
    const { r, c } = q[i]
    const base = dist.get(cellKey(r, c))
    for (const [dr, dc] of DIRS4) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
      const k = cellKey(nr, nc)
      const step = occ.has(k) ? pieceCost : 1
      const next = base + step
      if (dist.has(k) && dist.get(k) <= next) continue
      dist.set(k, next)
      q.push({ r: nr, c: nc })
    }
  }
  return dist.has(goal) ? dist.get(goal) : size * size * pieceCost
}

/**
 * With pieces frozen: can beetle push ball onto hole?
 * Returns { clear, ballDist } where ballDist is min ball pushes (Infinity if not clear).
 */
export function frozenBallPushSearch(state, opts = {}) {
  const maxStates = opts.maxStates ?? 50000
  const size = state.size
  const hole = state.target
  const occ = occupiedSet(state.pieces)
  const holeK = cellKey(hole.r, hole.c)

  function regionFrom(playerR, playerC, ballR, ballC) {
    const ballK = cellKey(ballR, ballC)
    const start = cellKey(playerR, playerC)
    if (occ.has(start) || start === ballK) return new Set()
    const seen = new Set([start])
    const q = [{ r: playerR, c: playerC }]
    for (let i = 0; i < q.length; i++) {
      const { r, c } = q[i]
      for (const [dr, dc] of DIRS4) {
        const nr = r + dr
        const nc = c + dc
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
        const k = cellKey(nr, nc)
        if (seen.has(k) || occ.has(k) || k === ballK) continue
        seen.add(k)
        q.push({ r: nr, c: nc })
      }
    }
    return seen
  }

  function regionRep(region) {
    let best = null
    for (const k of region) {
      if (best == null || k < best) best = k
    }
    return best ?? ''
  }

  const startRegion = regionFrom(state.player.r, state.player.c, state.ball.r, state.ball.c)
  if (!startRegion.size) {
    return { clear: false, ballDist: Infinity, states: 0 }
  }

  const startBall = cellKey(state.ball.r, state.ball.c)
  if (startBall === holeK) return { clear: true, ballDist: 0, states: 0 }

  const startKey = `${startBall}|${regionRep(startRegion)}`
  const dist = new Map([[startKey, 0]])
  // BFS on ball-push cost; walks are free so we expand all push options from a region.
  const q = [
    {
      br: state.ball.r,
      bc: state.ball.c,
      region: startRegion,
      cost: 0,
    },
  ]

  let states = 0
  for (let qi = 0; qi < q.length; qi++) {
    const node = q[qi]
    states++
    if (states > maxStates) break

    const ballK = cellKey(node.br, node.bc)
    for (const [dr, dc] of DIRS4) {
      const standR = node.br - dr
      const standC = node.bc - dc
      if (standR < 0 || standR >= size || standC < 0 || standC >= size) continue
      if (!node.region.has(cellKey(standR, standC))) continue

      const nr = node.br + dr
      const nc = node.bc + dc
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
      const destK = cellKey(nr, nc)
      if (occ.has(destK)) continue

      const nextCost = node.cost + 1
      if (destK === holeK) {
        return { clear: true, ballDist: nextCost, states }
      }

      // After push, beetle stands where the ball was.
      const nextRegion = regionFrom(node.br, node.bc, nr, nc)
      if (!nextRegion.size) continue
      const key = `${destK}|${regionRep(nextRegion)}`
      if (dist.has(key) && dist.get(key) <= nextCost) continue
      dist.set(key, nextCost)
      q.push({ br: nr, bc: nc, region: nextRegion, cost: nextCost })
    }
  }

  return { clear: false, ballDist: Infinity, states }
}

/**
 * @param {object} state play state from engine.initPlayState
 * @param {{ pieceCost?: number }} [opts]
 */
export function computeNaiveLook(state, opts = {}) {
  const pieceCost = opts.pieceCost ?? DEFAULT_PIECE_COST

  if (!state?.ball || !state?.target) {
    return {
      h: Infinity,
      reachBall: false,
      clear: false,
      ballDist: null,
      softDist: null,
      won: false,
    }
  }

  const won =
    state.ball.r === state.target.r && state.ball.c === state.target.c
  if (won) {
    return {
      h: 0,
      reachBall: true,
      clear: true,
      ballDist: 0,
      softDist: 0,
      won: true,
    }
  }

  const reachBall = canReachBall(state)
  const frozen = frozenBallPushSearch(state)
  const softDist = softBallDist(state, pieceCost)
  const clear = frozen.clear
  const ballDist = clear ? frozen.ballDist : null
  const progress = clear ? frozen.ballDist : softDist
  const h = 100 * (reachBall ? 0 : 1) + 10 * (clear ? 0 : 1) + progress

  return {
    h,
    reachBall,
    clear,
    ballDist,
    softDist,
    won: false,
    frozenStates: frozen.states,
  }
}

/**
 * Replay solution; record naive-look after start and each tetromino push.
 * @param {object} engine dungbeetle/engine.js module
 * @param {object} raw puzzle row
 */
export function traceNaiveLook(engine, raw, opts = {}) {
  const puzzle = engine.normalizePuzzleInput(raw, true)
  let state = engine.initPlayState(puzzle)
  const solution = typeof raw.solution === 'string' ? raw.solution : ''

  const { dirFromSolutionChar } = opts
  if (!dirFromSolutionChar) {
    return { ok: false, why: 'dirFromSolutionChar required' }
  }

  const start = computeNaiveLook(state, opts)
  const events = [
    {
      at: 'start',
      ch: '',
      pushIndex: 0,
      ...start,
      counterintuitive: false,
      delta: 0,
    },
  ]

  let pushes = 0
  let prevH = start.h

  for (const ch of solution) {
    if (engine.checkWon(state)) break
    const dir = dirFromSolutionChar(ch)
    if (!dir) return { ok: false, why: `bad character "${ch}"`, events }

    const move = engine.tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return { ok: false, why: `illegal move at "${ch}"`, events }
    state = move.state

    if (!move.pushedTetromino) continue

    pushes++
    const look = computeNaiveLook(state, opts)
    const delta = look.h - prevH
    events.push({
      at: `push${pushes}`,
      ch,
      pushIndex: pushes,
      ...look,
      counterintuitive: delta > 0,
      delta,
    })
    prevH = look.h
  }

  const counterintuitive = events.filter((e) => e.counterintuitive).length
  const clearFlipAt = events.find((e) => e.at !== 'start' && e.clear)?.pushIndex ?? null
  const startClear = events[0]?.clear ?? false

  return {
    ok: true,
    pushes: raw.pushes ?? raw.minPushes ?? null,
    ballPushes: raw.ballPushes ?? null,
    solution,
    events,
    counterintuitive,
    hStart: events[0]?.h ?? null,
    hEnd: events[events.length - 1]?.h ?? null,
    clearAtStart: startClear,
    clearFlipAt: startClear ? 0 : clearFlipAt,
    sampledPushes: pushes,
  }
}

function stateKey(state) {
  const parts = []
  for (let i = 0; i < state.pieces.length; i++) {
    const cells = state.pieces[i].cells
      .map((c) => cellKey(c.r, c.c))
      .sort()
    parts.push(`${i}:${cells.join(';')}`)
  }
  parts.push(`b:${cellKey(state.ball.r, state.ball.c)}`)
  const region = walkRegion(state)
  let rep = ''
  for (const k of region) {
    if (!rep || k < rep) rep = k
  }
  parts.push(`r:${rep}`)
  return parts.join('|')
}

/**
 * Legal macro-moves from the current walk region: ball pushes + piece pushes.
 * Each move includes a stand cell so tryMove can apply it.
 */
export function listMacroMoves(state, engine) {
  const size = state.size
  const region = walkRegion(state)
  const moves = []

  for (let di = 0; di < DIRS4.length; di++) {
    const [dr, dc] = DIRS4[di]
    const standR = state.ball.r - dr
    const standC = state.ball.c - dc
    if (!engine.inBounds(standR, standC, size)) continue
    if (!region.has(cellKey(standR, standC))) continue
    const destR = state.ball.r + dr
    const destC = state.ball.c + dc
    if (!engine.inBounds(destR, destC, size)) continue
    if (engine.pieceAtIn(state.pieces, destR, destC) !== -1) continue
    moves.push({
      kind: 'ball',
      pieceIndex: -1,
      dr,
      dc,
      dirIndex: di,
      standR,
      standC,
    })
  }

  for (let pi = 0; pi < state.pieces.length; pi++) {
    for (let di = 0; di < DIRS4.length; di++) {
      const [dr, dc] = DIRS4[di]
      if (!engine.canMovePieceIn(state.pieces, pi, dr, dc, size)) continue
      let hitsBall = false
      for (const cell of state.pieces[pi].cells) {
        if (cell.r + dr === state.ball.r && cell.c + dc === state.ball.c) {
          hitsBall = true
          break
        }
      }
      if (hitsBall) continue

      let standR = null
      let standC = null
      for (const cell of state.pieces[pi].cells) {
        const sr = cell.r - dr
        const sc = cell.c - dc
        if (!engine.inBounds(sr, sc, size)) continue
        if (!region.has(cellKey(sr, sc))) continue
        // Stand cell must not be another cell of this piece.
        if (engine.pieceAtIn(state.pieces, sr, sc) !== -1) continue
        standR = sr
        standC = sc
        break
      }
      if (standR == null) continue
      moves.push({
        kind: 'piece',
        pieceIndex: pi,
        dr,
        dc,
        dirIndex: di,
        standR,
        standC,
      })
    }
  }

  return moves
}

export function applyMacroMove(state, engine, move) {
  const next = {
    ...state,
    pieces: state.pieces.map((p) => ({
      ...p,
      cells: p.cells.map((c) => ({ ...c })),
    })),
    player: { r: move.standR, c: move.standC },
    ball: { ...state.ball },
    target: state.target,
  }
  return engine.tryMove(next, move.dr, move.dc)
}

function moveSortKey(move, h) {
  // Prefer lower h, then ball pushes, then earlier piece / dir.
  const kindRank = move.kind === 'ball' ? 0 : 1
  return [h, kindRank, move.pieceIndex, move.dirIndex]
}

function betterKey(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return true
    if (a[i] > b[i]) return false
  }
  return false
}

/**
 * Pure greedy: repeatedly take the macro-move with best h (deterministic ties).
 * If clear, treat as solved (ball rolls are free under this metric).
 *
 * @returns {{ ok, outcome, greedySolved, greedyPushes, greedyHEnd, steps, why? }}
 */
export function runGreedyNaive(engine, raw, opts = {}) {
  const puzzle = engine.normalizePuzzleInput(raw, true)
  let state = engine.initPlayState(puzzle)
  const par = raw.pushes ?? raw.minPushes ?? 10
  const budget = opts.budget ?? Math.max(2 * par, par + 4)
  const noImproveLimit = opts.noImproveLimit ?? 6

  const visited = new Set([stateKey(state)])
  let pushes = 0
  let steps = 0
  let noImprove = 0
  let look = computeNaiveLook(state, opts)

  if (look.won || look.clear) {
    return {
      ok: true,
      outcome: 'solved',
      greedySolved: 1,
      greedyPushes: 0,
      greedyHEnd: look.clear && !look.won ? look.ballDist : 0,
      steps: 0,
      greedyBudget: budget,
    }
  }

  while (true) {
    steps++
    const moves = listMacroMoves(state, engine)
    let best = null
    let bestKey = null
    let bestState = null
    let bestLook = null

    for (const move of moves) {
      const applied = applyMacroMove(state, engine, move)
      if (!applied.ok) continue
      const key = stateKey(applied.state)
      if (visited.has(key)) continue
      const nextLook = computeNaiveLook(applied.state, opts)
      const sortKey = moveSortKey(move, nextLook.h)
      if (!best || betterKey(sortKey, bestKey)) {
        best = move
        bestKey = sortKey
        bestState = applied.state
        bestLook = nextLook
      }
    }

    if (!best) {
      return {
        ok: true,
        outcome: 'trapped',
        greedySolved: 0,
        greedyPushes: pushes,
        greedyHEnd: look.h,
        steps,
        greedyBudget: budget,
      }
    }

    const improved = bestLook.h < look.h
    state = bestState
    visited.add(stateKey(state))
    look = bestLook
    if (best.kind === 'piece') pushes++

    if (look.won || look.clear) {
      return {
        ok: true,
        outcome: 'solved',
        greedySolved: 1,
        greedyPushes: pushes,
        greedyHEnd: look.won ? 0 : look.ballDist,
        steps,
        greedyBudget: budget,
      }
    }

    if (pushes > budget) {
      return {
        ok: true,
        outcome: 'budget',
        greedySolved: 0,
        greedyPushes: pushes,
        greedyHEnd: look.h,
        steps,
        greedyBudget: budget,
      }
    }

    if (improved) noImprove = 0
    else noImprove++
    if (noImprove >= noImproveLimit) {
      return {
        ok: true,
        outcome: 'plateau',
        greedySolved: 0,
        greedyPushes: pushes,
        greedyHEnd: look.h,
        steps,
        greedyBudget: budget,
      }
    }
  }
}

/**
 * Counterintuitive trace + greedy agent for one puzzle.
 */
export function analyzeNaivePuzzle(engine, raw, opts = {}) {
  const trace = traceNaiveLook(engine, raw, opts)
  if (!trace.ok) return trace
  const greedy = runGreedyNaive(engine, raw, opts)
  return {
    ok: true,
    pushes: trace.pushes,
    ballPushes: trace.ballPushes,
    blocksMoved: raw.blocksMoved ?? null,
    solns: raw.solns ?? null,
    hStart: trace.hStart,
    hEnd: trace.hEnd,
    counterintuitive: trace.counterintuitive,
    clearAtStart: trace.clearAtStart ? 1 : 0,
    clearFlipAt: trace.clearFlipAt,
    greedySolved: greedy.greedySolved,
    greedyOutcome: greedy.outcome,
    greedyPushes: greedy.greedyPushes,
    greedyHEnd: greedy.greedyHEnd,
    greedyBudget: greedy.greedyBudget,
    greedySteps: greedy.steps,
    events: trace.events,
  }
}
