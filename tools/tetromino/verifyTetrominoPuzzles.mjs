/**
 * Re-solves every committed Dung Beetle / Scuttlebug puzzle and reports rows whose stored par
 * (`pushes` / `minPushes`) or `blocksMoved` disagrees with the solver, then replays each stored
 * `solution` through the game's own engine to confirm it actually wins at that push count.
 *
 * A par that is too high lets players beat par, so this is worth running after any bulk
 * generation. Doubles as the regression test for tools/tetromino/pushEngine.mjs.
 *
 *   node tools/tetromino/verifyTetrominoPuzzles.mjs
 *   node tools/tetromino/verifyTetrominoPuzzles.mjs --mode=scuttle --max-states=600000
 *   node tools/tetromino/verifyTetrominoPuzzles.mjs --file=out.txt --mode=dung
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { DIRS, solvePushPuzzle } from './pushEngine.mjs'

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

const modes = args.has('mode') ? [args.get('mode')] : ['dung', 'scuttle']
const maxStates = args.has('max-states') ? Number(args.get('max-states')) : 1500000
const timeBudgetMs = args.has('verify-ms') ? Number(args.get('verify-ms')) : 30000

const TIERS = ['tutorial', 'easy', 'medium', 'hard']
/** Ledger lines from the generator, for checking a batch before pasting it in. */
const fileRel = args.get('file')
let failures = 0
let cutoffs = 0
let checked = 0

/**
 * Replay a UDLR path through the game's own engine: the source of truth for what a player
 * can actually do. Catches any drift between the solver's move rules and the game's.
 */
function replay(engine, puzzle, solution) {
  let state = engine.initPlayState(puzzle)
  let pushes = 0
  for (const ch of solution) {
    const dir = DIRS.find((d) => d.ch === ch)
    if (!dir) return { ok: false, why: `bad character "${ch}"` }
    const move = engine.tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return { ok: false, why: `illegal move at "${ch}"` }
    state = move.state
    if (move.pushedTetromino) pushes++
    if (engine.checkWon(state)) return { ok: true, pushes }
  }
  return { ok: false, why: 'path ends without a win' }
}

for (const mode of modes) {
  const dungMode = mode === 'dung'
  const dir = dungMode ? 'dungbeetle' : 'scuttlebug'
  const engine = await import(pathToFileURL(path.join(repoRoot, `puzzlegames/${dir}/engine.js`)).href)
  const { normalizePuzzleInput } = engine

  let data
  if (fileRel) {
    // Generator output is a comma-separated list of object literals. PowerShell's `>` writes
    // UTF-16LE with a BOM, so sniff the encoding rather than assuming UTF-8.
    const buf = fs.readFileSync(path.resolve(repoRoot, fileRel))
    const isUtf16 = buf.length > 1 && buf[0] === 0xff && buf[1] === 0xfe
    const text = buf.toString(isUtf16 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, '')
    const body = text.trim().replace(/,\s*$/, '')
    const rows = Function(`"use strict"; return [${body}]`)()
    data = { tutorial: [], easy: [], medium: [], hard: rows }
    console.log(`\n${fileRel} (${rows.length} rows, ${mode})`)
  } else {
    data = (await import(pathToFileURL(path.join(repoRoot, `puzzlegames/${dir}/puzzles.js`)).href)).default
    console.log(`\n${dir}`)
  }

  for (const tier of TIERS) {
    for (const [i, raw] of (data[tier] || []).entries()) {
      const puzzle = normalizePuzzleInput(raw, dungMode)
      const storedPar = raw.pushes ?? raw.minPushes ?? null
      const result = solvePushPuzzle(puzzle, { dungMode, maxStates, timeBudgetMs })
      checked++

      const label = `${tier}[${i}] ${puzzle.size}x${puzzle.size} ${puzzle.pieces.length}p`
      if (result.cutoff) {
        cutoffs++
        console.log(`  ? ${label} budget exhausted (stored par ${storedPar})`)
        continue
      }
      if (!result.solvable) {
        failures++
        console.log(`  ✗ ${label} UNSOLVABLE (stored par ${storedPar})`)
        continue
      }

      const notes = []
      if (storedPar != null && storedPar !== result.pushes) {
        notes.push(`par ${storedPar} → ${result.pushes}`)
      }
      if (raw.blocksMoved != null && raw.blocksMoved !== result.blocksMoved) {
        notes.push(`blocksMoved ${raw.blocksMoved} → ${result.blocksMoved}`)
      }
      if (puzzle.solution) {
        const replayed = replay(engine, puzzle, puzzle.solution)
        if (!replayed.ok) notes.push(`solution ${replayed.why}`)
        else if (replayed.pushes !== result.pushes) {
          notes.push(`solution spends ${replayed.pushes} pushes, par is ${result.pushes}`)
        }
      }
      if (notes.length) {
        failures++
        console.log(`  ✗ ${label} ${notes.join(', ')}`)
      } else {
        console.log(`  ✓ ${label} ${result.pushes} pushes, ${result.statesExplored} states`)
      }
    }
  }
}

console.log(`\n${checked} checked, ${failures} mismatch(es), ${cutoffs} over budget.`)
if (failures > 0 || cutoffs > 0) process.exit(1)
