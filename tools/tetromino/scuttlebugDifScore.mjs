/**
 * Scuttlebug difficulty (dif) from the official solution.
 *
 * Base:
 *   block push (UDLR) = 7
 *   bug walk (udlr)   = 1
 * Bonuses:
 *   +3 per block-push chunk (broken by a walk or switching pieces)
 *   +7 once if any block occupies the hole cell during the solve
 *   +7 per piece that ever pushes in opposite directions (U↔D or L↔R),
 *      max +7 per piece; opposites need not be consecutive (URRD counts)
 *
 *   import { scoreScuttlebugDif } from './scuttlebugDifScore.mjs'
 *   node tools/tetromino/writeScuttlebugDif.mjs
 */
import { dirFromSolutionChar } from './pushEngine.mjs'

function holeCovered(pieces, hole) {
  for (const p of pieces) {
    for (const c of p.cells) {
      if (c.r === hole.r && c.c === hole.c) return true
    }
  }
  return false
}

function dirLetterFromDelta(dr, dc) {
  if (dr === -1 && dc === 0) return 'U'
  if (dr === 1 && dc === 0) return 'D'
  if (dr === 0 && dc === -1) return 'L'
  if (dr === 0 && dc === 1) return 'R'
  return '?'
}

/**
 * @returns {{
 *   ok: boolean,
 *   why?: string,
 *   dif: number,
 *   walks: number,
 *   blockPushes: number,
 *   chunks: number,
 *   holeCover: boolean,
 *   reverseBlocks: number,
 *   bonus: number,
 *   base: number,
 * }}
 */
export function scoreScuttlebugDif(raw, engine) {
  const { normalizePuzzleInput, initPlayState, tryMove, checkWon, pieceAtIn } = engine
  const sol = typeof raw.solution === 'string' ? raw.solution : ''
  const empty = {
    ok: false,
    dif: 0,
    walks: 0,
    blockPushes: 0,
    chunks: 0,
    holeCover: false,
    reverseBlocks: 0,
    bonus: 0,
    base: 0,
  }
  if (!sol) return { ...empty, why: 'missing-solution' }

  let puzzle
  try {
    puzzle = normalizePuzzleInput(raw, false)
  } catch (e) {
    return { ...empty, why: `normalize:${e.message || e}` }
  }

  let state = initPlayState(puzzle)
  const hole = { r: state.target.r, c: state.target.c }

  let walks = 0
  let blockPushes = 0
  let chunks = 0
  let holeCover = holeCovered(state.pieces, hole)
  /** @type {Map<number, Set<string>>} */
  const dirsSeen = new Map()
  let lastPushPiece = -1
  let inChunk = false

  for (const ch of sol) {
    const dir = dirFromSolutionChar(ch)
    if (!dir) return { ...empty, why: `bad-char:${ch}` }

    const hit = pieceAtIn(state.pieces, state.player.r + dir.dr, state.player.c + dir.dc)
    const move = tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return { ...empty, why: `illegal:${ch}` }

    if (move.pushedTetromino && hit >= 0) {
      blockPushes++
      const dirLetter = 'UDLR'.includes(ch) ? ch : dirLetterFromDelta(dir.dr, dir.dc)
      if (!inChunk || hit !== lastPushPiece) {
        chunks++
        inChunk = true
      }
      lastPushPiece = hit
      if (!dirsSeen.has(hit)) dirsSeen.set(hit, new Set())
      dirsSeen.get(hit).add(dirLetter)
    } else {
      walks++
      inChunk = false
      lastPushPiece = -1
    }

    state = move.state
    if (!holeCover && holeCovered(state.pieces, hole)) holeCover = true
  }

  if (!checkWon(state)) return { ...empty, why: 'not-won' }

  let reverseBlocks = 0
  for (const dirs of dirsSeen.values()) {
    if ((dirs.has('U') && dirs.has('D')) || (dirs.has('L') && dirs.has('R'))) {
      reverseBlocks++
    }
  }

  const base = blockPushes * 7 + walks * 1
  const bonus = chunks * 3 + (holeCover ? 7 : 0) + reverseBlocks * 7
  return {
    ok: true,
    dif: base + bonus,
    walks,
    blockPushes,
    chunks,
    holeCover,
    reverseBlocks,
    bonus,
    base,
  }
}
