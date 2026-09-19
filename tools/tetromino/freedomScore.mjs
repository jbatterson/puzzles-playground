/**
 * Freedom score along a Dung Beetle official solution.
 *
 * Checkpoints: start, and after each completed sequence that occurs *before*
 * the final block sequence. No scoring after the last block sequence (remaining
 * ball rolls are just finishing).
 *
 * Sequences:
 * - Block: consecutive pushes of the same piece. A walk between same-piece
 *   pushes splits into two sequences. A piece switch also splits.
 * - Ball: consecutive ball pushes; walks between ball pushes do NOT split.
 *
 * At each checkpoint:
 *   A optionMass = (# legal piece dirs) + (1 if any ball push else 0)
 *   B temptation  = for each unused legal push (not the next sequence's first push):
 *       +3 per newly reachable (piece, dir)
 *       +4 if block push flips beetle↔ball reach false→true
 *       +4 if block push flips empty ball→hole corridor false→true
 *     (ball alternatives never get the +4 path bonuses)
 *
 * Columns: optionMass, temptation, freedom = A+B
 */
import {
  canReachBall,
  listMacroMoves,
  applyMacroMove,
} from './naiveLook.mjs'
import { dirFromSolutionChar } from './pushEngine.mjs'

const DIRS4 = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

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

function classifyGlyph(ch) {
  if ('UDLR'.includes(ch)) return 'piece'
  if ('NSWE'.includes(ch)) return 'ball'
  if ('udlr'.includes(ch)) return 'walk'
  // Legacy ball alphabet
  if ('wsae'.includes(ch)) return 'ball'
  return null
}

/** Empty-cell corridor ball→hole (pieces = walls). */
export function emptyBallCorridor(state) {
  if (!state?.ball || !state?.target) return false
  const size = state.size
  const occ = occupiedSet(state.pieces)
  const start = cellKey(state.ball.r, state.ball.c)
  const goal = cellKey(state.target.r, state.target.c)
  if (start === goal) return true
  const seen = new Set([start])
  const q = [{ r: state.ball.r, c: state.ball.c }]
  for (let i = 0; i < q.length; i++) {
    const { r, c } = q[i]
    for (const [dr, dc] of DIRS4) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
      const k = cellKey(nr, nc)
      if (seen.has(k) || occ.has(k)) continue
      if (k === goal) return true
      seen.add(k)
      q.push({ r: nr, c: nc })
    }
  }
  return false
}

function pieceDirKey(pi, dr, dc) {
  return `${pi}:${dr},${dc}`
}

function legalPieceDirSet(state, engine) {
  const set = new Set()
  for (const m of listMacroMoves(state, engine)) {
    if (m.kind === 'piece') set.add(pieceDirKey(m.pieceIndex, m.dr, m.dc))
  }
  return set
}

function optionMass(state, engine) {
  const moves = listMacroMoves(state, engine)
  let pieceDirs = 0
  let ball = false
  for (const m of moves) {
    if (m.kind === 'piece') pieceDirs++
    else ball = true
  }
  return pieceDirs + (ball ? 1 : 0)
}

function moveMatchesTaken(move, taken) {
  if (!taken) return false
  if (move.kind !== taken.kind) return false
  if (move.dr !== taken.dr || move.dc !== taken.dc) return false
  if (move.kind === 'piece' && move.pieceIndex !== taken.pieceIndex) return false
  return true
}

/**
 * Temptation (B) at a checkpoint given the taken next single push.
 */
export function temptationAt(state, engine, taken) {
  const beforeDirs = legalPieceDirSet(state, engine)
  const beforeReach = canReachBall(state)
  const beforeCorridor = emptyBallCorridor(state)
  const moves = listMacroMoves(state, engine)

  let temptation = 0
  let unused = 0
  let freeBlockBonus = 0
  let reachBonus = 0
  let corridorBonus = 0

  for (const move of moves) {
    if (moveMatchesTaken(move, taken)) continue
    unused++
    const applied = applyMacroMove(state, engine, move)
    if (!applied.ok) continue
    const after = applied.state
    const afterDirs = legalPieceDirSet(after, engine)
    let newDirs = 0
    for (const k of afterDirs) {
      if (!beforeDirs.has(k)) newDirs++
    }
    if (newDirs > 0) {
      const add = 3 * newDirs
      temptation += add
      freeBlockBonus += add
    }

    if (move.kind !== 'piece') continue

    if (!beforeReach && canReachBall(after)) {
      temptation += 4
      reachBonus += 4
    }
    if (!beforeCorridor && emptyBallCorridor(after)) {
      temptation += 4
      corridorBonus += 4
    }
  }

  return {
    temptation,
    unused,
    freeBlockBonus,
    reachBonus,
    corridorBonus,
    optionMass: beforeDirs.size + (moves.some((m) => m.kind === 'ball') ? 1 : 0),
  }
}

/**
 * Replay solution into atomic events with end-state after each glyph.
 */
function replayEvents(engine, raw) {
  const puzzle = engine.normalizePuzzleInput(raw, true)
  let state = engine.initPlayState(puzzle)
  const solution = typeof raw.solution === 'string' ? raw.solution : ''
  const events = []
  const startState = engine.clone(state)

  for (const ch of solution) {
    if (engine.checkWon(state)) break
    const kind = classifyGlyph(ch)
    const dir = dirFromSolutionChar(ch)
    if (!kind || !dir) {
      return { ok: false, why: `bad character "${ch}"`, events: [], startState }
    }

    let pieceIndex = -1
    if (kind === 'piece') {
      pieceIndex = engine.pieceAtIn(
        state.pieces,
        state.player.r + dir.dr,
        state.player.c + dir.dc
      )
    }

    const move = engine.tryMove(state, dir.dr, dir.dc)
    if (!move.ok) {
      return { ok: false, why: `illegal move at "${ch}"`, events: [], startState }
    }

    // Sanity: piece glyphs should push tetrominoes; ball glyphs should move ball.
    if (kind === 'piece' && !move.pushedTetromino) {
      return {
        ok: false,
        why: `expected piece push at "${ch}"`,
        events: [],
        startState,
      }
    }
    if (kind === 'ball') {
      const moved =
        move.state.ball.r !== state.ball.r || move.state.ball.c !== state.ball.c
      if (!moved) {
        return {
          ok: false,
          why: `expected ball push at "${ch}"`,
          events: [],
          startState,
        }
      }
    }

    state = move.state
    events.push({
      ch,
      kind,
      pieceIndex,
      dr: dir.dr,
      dc: dir.dc,
      state: engine.clone(state),
    })
  }

  return { ok: true, events, startState, endState: state }
}

/**
 * Group events into block/ball sequences per the split rules.
 * Walks alone are not sequences; they only glue ball pushes together.
 */
export function groupSequences(events) {
  const sequences = []
  let i = 0
  while (i < events.length) {
    const ev = events[i]
    if (ev.kind === 'walk') {
      i++
      continue
    }

    if (ev.kind === 'piece') {
      const run = [ev]
      let j = i + 1
      while (j < events.length) {
        const n = events[j]
        if (n.kind !== 'piece' || n.pieceIndex !== ev.pieceIndex) break
        run.push(n)
        j++
      }
      sequences.push({
        kind: 'piece',
        pieceIndex: ev.pieceIndex,
        events: run,
        first: run[0],
        endState: run[run.length - 1].state,
      })
      i = j
      continue
    }

    if (ev.kind === 'ball') {
      const run = [ev]
      let j = i + 1
      while (j < events.length) {
        const n = events[j]
        if (n.kind === 'walk') {
          j++
          continue
        }
        if (n.kind === 'ball') {
          run.push(n)
          j++
          continue
        }
        break // piece (or unknown) ends the ball run
      }
      sequences.push({
        kind: 'ball',
        pieceIndex: -1,
        events: run,
        first: run[0],
        endState: run[run.length - 1].state,
      })
      // Resume at first non-walk after the last ball in this run.
      let k = i
      const lastBall = run[run.length - 1]
      while (k < events.length && events[k] !== lastBall) k++
      k++ // past last ball
      while (k < events.length && events[k].kind === 'walk') k++
      i = k
      continue
    }

    i++
  }
  return sequences
}

function takenFromSequence(seq) {
  if (!seq) return null
  const f = seq.first
  return {
    kind: f.kind === 'piece' ? 'piece' : 'ball',
    pieceIndex: f.pieceIndex,
    dr: f.dr,
    dc: f.dc,
  }
}

/**
 * Full freedom analysis for one puzzle.
 */
export function analyzeFreedom(engine, raw) {
  const replayed = replayEvents(engine, raw)
  if (!replayed.ok) return replayed

  const sequences = groupSequences(replayed.events)
  let lastBlockIndex = -1
  for (let i = 0; i < sequences.length; i++) {
    if (sequences[i].kind === 'piece') lastBlockIndex = i
  }

  const checkpoints = []

  // Start checkpoint (only if there is a next sequence to decide toward)
  if (sequences.length > 0 && lastBlockIndex >= 0) {
    const taken = takenFromSequence(sequences[0])
    const mass = optionMass(replayed.startState, engine)
    const temp = temptationAt(replayed.startState, engine, taken)
    checkpoints.push({
      at: 'start',
      seqIndex: -1,
      optionMass: mass,
      temptation: temp.temptation,
      freedom: mass + temp.temptation,
      unused: temp.unused,
      freeBlockBonus: temp.freeBlockBonus,
      reachBonus: temp.reachBonus,
      corridorBonus: temp.corridorBonus,
    })
  }

  // After each sequence strictly before the final block sequence
  for (let k = 0; k < sequences.length; k++) {
    if (k >= lastBlockIndex) break // no checkpoint at/after final block
    const state = sequences[k].endState
    const next = sequences[k + 1]
    if (!next) break
    const taken = takenFromSequence(next)
    const mass = optionMass(state, engine)
    const temp = temptationAt(state, engine, taken)
    checkpoints.push({
      at: `afterSeq${k}`,
      seqIndex: k,
      seqKind: sequences[k].kind,
      optionMass: mass,
      temptation: temp.temptation,
      freedom: mass + temp.temptation,
      unused: temp.unused,
      freeBlockBonus: temp.freeBlockBonus,
      reachBonus: temp.reachBonus,
      corridorBonus: temp.corridorBonus,
    })
  }

  let optionMassTotal = 0
  let temptationTotal = 0
  for (const c of checkpoints) {
    optionMassTotal += c.optionMass
    temptationTotal += c.temptation
  }

  return {
    ok: true,
    pushes: raw.pushes ?? raw.minPushes ?? null,
    ballPushes: raw.ballPushes ?? null,
    blocksMoved: raw.blocksMoved ?? null,
    solns: raw.solns ?? null,
    seqCount: sequences.length,
    blockSeqCount: sequences.filter((s) => s.kind === 'piece').length,
    ballSeqCount: sequences.filter((s) => s.kind === 'ball').length,
    checkpointCount: checkpoints.length,
    lastBlockSeqIndex: lastBlockIndex,
    optionMass: optionMassTotal,
    temptation: temptationTotal,
    freedom: optionMassTotal + temptationTotal,
    checkpoints,
    sequences: sequences.map((s, i) => ({
      i,
      kind: s.kind,
      pieceIndex: s.pieceIndex,
      glyphs: s.events.map((e) => e.ch).join(''),
      isLastBlock: i === lastBlockIndex,
    })),
  }
}
