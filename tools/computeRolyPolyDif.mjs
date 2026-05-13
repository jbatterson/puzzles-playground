/**
 * Compute `dif` along the stored solution: before each slide, add the number of balls not yet
 * locked on a target (each such ball counts 1 toward that move’s weight). That sum is then multiplied
 * by grid size (5×5 → ×5, 6×6 → ×6, 7×7 → ×7) so larger boards rank harder for the same path weight.
 * Matches puzzlegames/rolypoly/rolypoly.jsx slide physics.
 *
 * Dry-run: prints tier dif ranges. Pass --write to set or refresh `, dif: N` in puzzles.js.
 *
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/computeRolyPolyDif.mjs
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/computeRolyPolyDif.mjs --write
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const repoRoot = path.resolve(import.meta.dirname, '..')
const PUZZLES_REL = 'puzzlegames/rolypoly/puzzles.js'
const write = process.argv.includes('--write')

const TIER_ORDER = ['tutorial', 'easy', 'medium', 'hard']

function gridSizeOf(p) {
  const s = p.size
  if (Number.isFinite(s) && s >= 3 && s <= 16) return Math.trunc(s)
  return 7
}

function initFromPuzzle(p) {
  const balls = p.balls.map(([r, c], i) => ({ id: i, row: r, col: c, locked: false }))
  const targets = p.targets.map(([r, c]) => ({ row: r, col: c }))
  const blocks = p.blocks.map(([r, c]) => ({ row: r, col: c }))
  return { balls, targets, blocks }
}

function isBlockAt(blocks, r, c) {
  return blocks.some((b) => b.row === r && b.col === c)
}

function slide(dir, ballsIn, targets, blocks, gridSize) {
  const next = ballsIn.map((b) => ({ ...b }))
  let sorted
  if (dir === 'left') sorted = next.slice().sort((a, b) => a.col - b.col)
  if (dir === 'right') sorted = next.slice().sort((a, b) => b.col - a.col)
  if (dir === 'up') sorted = next.slice().sort((a, b) => a.row - b.row)
  if (dir === 'down') sorted = next.slice().sort((a, b) => b.row - a.row)

  sorted.forEach((ball) => {
    if (ball.locked) return
    let r = ball.row
    let c = ball.col
    while (true) {
      let nr = r
      let nc = c
      if (dir === 'left') nc--
      if (dir === 'right') nc++
      if (dir === 'up') nr--
      if (dir === 'down') nr++
      if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) break
      if (isBlockAt(blocks, nr, nc)) break
      if (next.some((o) => o.id !== ball.id && o.row === nr && o.col === nc)) break
      r = nr
      c = nc
      if (targets.some((t) => t.row === r && t.col === c)) {
        ball.locked = true
        break
      }
    }
    ball.row = r
    ball.col = c
  })

  return next
}

const DIR_MAP = { L: 'left', R: 'right', U: 'up', D: 'down' }

/**
 * @param {object} p puzzle with balls, targets, blocks, solution
 * @returns {number|null} (weighted move sum) × grid size; null if no solution string or no balls
 */
export function computeDifFromSolution(p) {
  if (!p || typeof p.solution !== 'string' || p.solution.length === 0) return null
  const n = Array.isArray(p.balls) ? p.balls.length : 0
  if (n < 1) return null
  const gridSize = gridSizeOf(p)
  const init = initFromPuzzle(p)
  let balls = init.balls
  const { targets, blocks } = init
  let base = 0
  for (const ch of p.solution.toUpperCase()) {
    const dir = DIR_MAP[ch]
    if (!dir) continue
    const unlocked = balls.filter((b) => !b.locked).length
    base += unlocked
    balls = slide(dir, balls, targets, blocks, gridSize)
  }
  return base * gridSize
}

function isPuzzleObjectLine(line) {
  const t = line.trim()
  return t.startsWith('{') && t.includes('balls:')
}

function patchPuzzlesFile(text, data) {
  const lines = text.split(/\n/)
  let currentTier = null
  let idxInTier = 0
  const stats = { patched: 0, skippedNoSolution: 0, mismatched: 0 }

  const out = lines.map((line) => {
    const tierMatch = line.match(/^\s*(tutorial|easy|medium|hard):\s*\[\s*$/)
    if (tierMatch) {
      currentTier = tierMatch[1]
      idxInTier = 0
      return line
    }
    if (currentTier && /^\s*\],\s*$/.test(line)) {
      currentTier = null
      return line
    }

    if (!currentTier || !isPuzzleObjectLine(line)) return line

    const list = data[currentTier]
    if (!Array.isArray(list) || idxInTier >= list.length) {
      stats.mismatched++
      idxInTier++
      return line
    }
    const p = list[idxInTier]
    idxInTier++

    if (!p || typeof p.solution !== 'string' || !p.solution.length) {
      stats.skippedNoSolution++
      return line
    }

    const dif = computeDifFromSolution(p)
    if (dif == null) {
      stats.skippedNoSolution++
      return line
    }
    stats.patched++
    if (/,?\s*dif:\s*\d+/.test(line)) {
      return line.replace(/,?\s*dif:\s*\d+/, `, dif: ${dif}`)
    }
    return line.replace(/(solution:\s*"[^"]*")/, `$1, dif: ${dif}`)
  })

  return { text: out.join('\n'), stats }
}

async function main() {
  const abs = path.join(repoRoot, PUZZLES_REL)
  const url = pathToFileURL(abs).href + `?v=${Date.now()}`
  const mod = await import(url)
  const data = mod.default

  const summary = []
  for (const tier of TIER_ORDER) {
    const arr = data[tier]
    if (!Array.isArray(arr)) continue
    let withSol = 0
    let difs = []
    for (const p of arr) {
      if (typeof p?.solution === 'string' && p.solution.length) {
        withSol++
        const d = computeDifFromSolution(p)
        if (d != null) difs.push(d)
      }
    }
    summary.push({ tier, count: arr.length, withSolution: withSol, difMin: difs.length ? Math.min(...difs) : null, difMax: difs.length ? Math.max(...difs) : null })
  }

  console.log(
    'Roly Poly `dif` = (sum over solution moves of unlocked balls before each move) × grid size.\n'
  )
  for (const s of summary) {
    console.log(
      `${s.tier}: ${s.count} puzzles, ${s.withSolution} with solution — dif range ${s.difMin ?? '—'}..${s.difMax ?? '—'}`
    )
  }

  const raw = fs.readFileSync(abs, 'utf8')
  const { text: next, stats } = patchPuzzlesFile(raw, data)
  console.log('\nPatch stats:', stats)

  if (write) {
    if (stats.mismatched) {
      console.error('Refusing --write: line/puzzle count mismatch')
      process.exit(1)
    }
    fs.writeFileSync(abs, next, 'utf8')
    console.log(`Wrote ${PUZZLES_REL}`)
  } else {
    console.log('\nDry run — pass --write to update puzzles.js')
  }
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
