/**
 * Dedupe Roly Poly puzzles (easy+medium+hard) by layout fingerprint, drop copies of tutorial layouts,
 * then assign tiers by scaled `dif` rank: easiest ~3/12 → easy, next ~4/12 → medium, ~5/12 → hard
 * (integer split from pool size via largest remainder). Tutorial unchanged; `dif` from computeRolyPolyDif.
 *
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/reorganizeRolyPolyPuzzles.mjs
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/reorganizeRolyPolyPuzzles.mjs --write
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

import { computeDifFromSolution } from './computeRolyPolyDif.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..')
const PUZZLES_REL = 'puzzlegames/rolypoly/puzzles.js'
const write = process.argv.includes('--write')

/** Target shares of deduped pool: 3 : 4 : 5 (easy : medium : hard). */
const TIER_WEIGHTS = [3, 4, 5]

/**
 * @param {number} n deduped non-tutorial pool size
 * @returns {{ easy: number, medium: number, hard: number }}
 */
function tierCountsFromPool(n) {
  if (n <= 0) return { easy: 0, medium: 0, hard: 0 }
  const quota = TIER_WEIGHTS.map((w) => (n * w) / 12)
  const floors = quota.map((q) => Math.floor(q))
  let rem = n - floors.reduce((a, b) => a + b, 0)
  const order = [0, 1, 2].sort((i, j) => quota[j] - floors[j] - (quota[i] - floors[i]))
  const counts = [...floors]
  for (let k = 0; k < rem; k++) counts[order[k]]++
  return { easy: counts[0], medium: counts[1], hard: counts[2] }
}

/** Same layout = duplicate (size default 7). */
function fingerprint(p) {
  return JSON.stringify({
    sz: Number.isFinite(p.size) ? p.size : 7,
    b: p.balls,
    t: p.targets,
    bl: p.blocks,
  })
}

function ensureDif(p) {
  const d = computeDifFromSolution(p)
  if (d == null) throw new Error(`Missing dif for puzzle: ${fingerprint(p)}`)
  return { ...p, dif: d }
}

function formatPuzzle(p) {
  const bits = []
  const sz = Number.isFinite(p.size) ? Math.trunc(p.size) : 7
  bits.push(`size: ${sz}`)
  bits.push(`balls: ${JSON.stringify(p.balls)}`)
  bits.push(`targets: ${JSON.stringify(p.targets)}`)
  bits.push(`blocks: ${JSON.stringify(p.blocks)}`)
  if (Number.isFinite(p.par)) bits.push(`par: ${p.par}`)
  else if (Number.isFinite(p.minMoves)) bits.push(`minMoves: ${p.minMoves}`)
  if (typeof p.solution === 'string' && p.solution.length) bits.push(`solution: ${JSON.stringify(p.solution)}`)
  if (Number.isFinite(p.dif)) bits.push(`dif: ${p.dif}`)
  return `    { ${bits.join(', ')} }`
}

function formatTier(name, puzzles) {
  const lines = [`  ${name}: [`, '']
  for (const p of puzzles) {
    lines.push(formatPuzzle(p) + ',')
  }
  lines.push('', '  ],')
  return lines.join('\n')
}

async function main() {
  const abs = path.join(repoRoot, PUZZLES_REL)
  const data = (await import(pathToFileURL(abs).href + `?v=${Date.now()}`)).default

  const tutorial = (data.tutorial || []).map((p) => ensureDif({ ...p }))
  const tutorialFp = new Set(tutorial.map(fingerprint))

  const poolRaw = [...(data.easy || []), ...(data.medium || []), ...(data.hard || [])]
  const seen = new Set()
  const pool = []
  for (const p of poolRaw) {
    const fp = fingerprint(p)
    if (tutorialFp.has(fp)) continue
    if (seen.has(fp)) continue
    seen.add(fp)
    pool.push(ensureDif({ ...p }))
  }

  const sorted = pool.slice().sort((a, b) => a.dif - b.dif || (a.par ?? 0) - (b.par ?? 0))
  const n = sorted.length
  const { easy: easyN, medium: mediumN } = tierCountsFromPool(n)
  const easy = sorted.slice(0, easyN)
  const medium = sorted.slice(easyN, easyN + mediumN)
  const hard = sorted.slice(easyN + mediumN)

  console.log(
    `Deduped pool: ${pool.length} (from ${poolRaw.length} rows). Tutorial: ${tutorial.length} (unchanged).`
  )
  console.log(`Tier sizes — easy: ${easy.length}, medium: ${medium.length}, hard: ${hard.length}`)

  const header = `/**
 * Roly Poly daily tiers + tutorial. Grid size: easy 5×5, medium 6×6, hard 7×7 (every puzzle lists size explicitly).
 *
 * dif = (sum over solution moves of unlocked balls before each move) × grid size — see tools/computeRolyPolyDif.mjs.
 * Non-tutorial: sorted by dif; split ~3/12 → easy, ~4/12 → medium, ~5/12 → hard (integer split from pool size).
 */
export default {
`
  const body = [
    formatTier('tutorial', tutorial),
    '',
    formatTier('easy', easy),
    '',
    formatTier('medium', medium),
    '',
    formatTier('hard', hard),
    '',
    '}',
  ].join('\n')

  const out = header + body + '\n'

  if (!write) {
    console.log('\nDry run — pass --write to update', PUZZLES_REL)
    return
  }

  fs.writeFileSync(abs, out, 'utf8')
  console.log('\nWrote', PUZZLES_REL)
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
