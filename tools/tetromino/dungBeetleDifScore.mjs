/**
 * Dung Beetle difficulty (dif) from the official solution.
 *
 * Base:
 *   block push (UDLR) = 7
 *   ball push (NSWE)  = 2
 *   walk (udlr)       = 1
 * Bonuses:
 *   +7 once if any block occupies the hole cell during the solve
 *   +7 per piece that ever pushes in opposite directions (U↔D or L↔R),
 *      max +7 per piece; opposites need not be consecutive
 *   ball-set triangular: +1+2+…+n for n maximal ball-push runs
 *      (walks don't break a run; block pushes do)
 *
 *   import { scoreDungBeetleDif } from './dungBeetleDifScore.mjs'
 *   node tools/tetromino/dungBeetleDifScore.mjs   (checks stored dif in puzzles.js)
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { dirFromSolutionChar } from './pushEngine.mjs'

function holeCovered(pieces, hole) {
  for (const p of pieces) {
    for (const c of p.cells) {
      if (c.r === hole.r && c.c === hole.c) return true
    }
  }
  return false
}

/**
 * @returns {{
 *   ok: boolean,
 *   why?: string,
 *   dif: number,
 *   walks: number,
 *   ballPushes: number,
 *   blockPushes: number,
 *   ballRuns: number,
 *   holeCover: boolean,
 *   reverseBlocks: number,
 *   bonus: number,
 *   base: number,
 * }}
 */
export function scoreDungBeetleDif(raw, engine) {
  const { normalizePuzzleInput, initPlayState, tryMove, checkWon, pieceAtIn } = engine
  const sol = typeof raw.solution === 'string' ? raw.solution : ''
  const empty = {
    ok: false,
    dif: 0,
    walks: 0,
    ballPushes: 0,
    blockPushes: 0,
    ballRuns: 0,
    holeCover: false,
    reverseBlocks: 0,
    bonus: 0,
    base: 0,
  }
  if (!sol) return { ...empty, why: 'missing-solution' }

  let puzzle
  try {
    puzzle = normalizePuzzleInput(raw, true)
  } catch (e) {
    return { ...empty, why: `normalize:${e.message || e}` }
  }

  let state = initPlayState(puzzle)
  const hole = { r: state.target.r, c: state.target.c }

  let walks = 0
  let ballPushes = 0
  let blockPushes = 0
  let ballRuns = 0
  let inBallRun = false
  let holeCover = holeCovered(state.pieces, hole)
  /** @type {Map<number, Set<string>>} */
  const dirsSeen = new Map()

  for (const ch of sol) {
    const dir = dirFromSolutionChar(ch)
    if (!dir) return { ...empty, why: `bad-char:${ch}` }

    const tr = state.player.r + dir.dr
    const tc = state.player.c + dir.dc
    const hit = pieceAtIn(state.pieces, tr, tc)
    const ballAhead = state.ball.r === tr && state.ball.c === tc
    const move = tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return { ...empty, why: `illegal:${ch}` }

    if (move.pushedTetromino && hit >= 0) {
      blockPushes++
      inBallRun = false
      const axisDir = dir.dr ? `V${dir.dr}` : `H${dir.dc}`
      if (!dirsSeen.has(hit)) dirsSeen.set(hit, new Set())
      dirsSeen.get(hit).add(axisDir)
    } else if (ballAhead) {
      ballPushes++
      if (!inBallRun) {
        ballRuns++
        inBallRun = true
      }
    } else {
      walks++
    }

    state = move.state
    if (!holeCover && holeCovered(state.pieces, hole)) holeCover = true
  }

  if (!checkWon(state)) return { ...empty, why: 'not-won' }

  let reverseBlocks = 0
  for (const dirs of dirsSeen.values()) {
    if ((dirs.has('V1') && dirs.has('V-1')) || (dirs.has('H1') && dirs.has('H-1'))) {
      reverseBlocks++
    }
  }

  const base = blockPushes * 7 + ballPushes * 2 + walks
  const bonus = (holeCover ? 7 : 0) + reverseBlocks * 7 + (ballRuns * (ballRuns + 1)) / 2
  return {
    ok: true,
    dif: base + bonus,
    walks,
    ballPushes,
    blockPushes,
    ballRuns,
    holeCover,
    reverseBlocks,
    bonus,
    base,
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const repoRoot = path.resolve(import.meta.dirname, '..', '..')
  const engine = await import(
    pathToFileURL(path.join(repoRoot, 'puzzlegames/dungbeetle/engine.js')).href
  )
  const abs = path.join(repoRoot, 'puzzlegames/dungbeetle/puzzles.js')
  const data = (await import(pathToFileURL(abs).href + `?t=${Date.now()}`)).default
  let match = 0
  let mismatch = 0
  let unrated = 0
  for (const [tier, list] of Object.entries(data)) {
    list.forEach((raw, i) => {
      const s = scoreDungBeetleDif(raw, engine)
      if (!s.ok) {
        mismatch++
        console.log(`  ✗ ${tier}[${i}] ${s.why}`)
      } else if (!Number.isFinite(raw.dif)) {
        unrated++
        console.log(`  ? ${tier}[${i}] no stored dif (computed ${s.dif})`)
      } else if (s.dif !== raw.dif) {
        mismatch++
        console.log(`  ≠ ${tier}[${i}] stored ${raw.dif} computed ${s.dif}`)
      } else {
        match++
      }
    })
  }
  console.log(`\n${match} match, ${mismatch} mismatch, ${unrated} unrated`)
  if (mismatch > 0) process.exit(1)
}
