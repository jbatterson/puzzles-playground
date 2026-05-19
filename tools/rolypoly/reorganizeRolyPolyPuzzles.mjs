/**
 * Dedupe Roly Poly puzzles (easy+medium+hard) by layout fingerprint, drop copies of tutorial layouts,
 * then assign tiers by `dif`: easy &lt; 52, medium 52–108, hard &gt; 108 (each tier sorted by dif).
 * Tutorial unchanged; `dif` from stored `solution` (run canonicalize to align).
 *
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/rolypoly/reorganizeRolyPolyPuzzles.mjs
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/rolypoly/reorganizeRolyPolyPuzzles.mjs --write
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

import { computeDifFromSolution } from './computeRolyPolyDif.mjs'
import { formatRolyPolyTier } from './rolyPolyPuzzleLedgerFormat.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const PUZZLES_REL = 'puzzlegames/rolypoly/puzzles.js'
const write = process.argv.includes('--write')

/** Inclusive medium band; easy is strictly below, hard is strictly above. */
const DIF_MEDIUM_MIN = 52
const DIF_MEDIUM_MAX = 108

const sortByDif = (a, b) => a.dif - b.dif || (a.par ?? 0) - (b.par ?? 0)

/**
 * @param {Record<string, unknown> & { dif: number }} p
 * @returns {'easy' | 'medium' | 'hard'}
 */
function tierForDif(p) {
  const d = p.dif
  if (d < DIF_MEDIUM_MIN) return 'easy'
  if (d <= DIF_MEDIUM_MAX) return 'medium'
  return 'hard'
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

  const easy = []
  const medium = []
  const hard = []
  for (const p of pool) {
    const tier = tierForDif(p)
    if (tier === 'easy') easy.push(p)
    else if (tier === 'medium') medium.push(p)
    else hard.push(p)
  }
  easy.sort(sortByDif)
  medium.sort(sortByDif)
  hard.sort(sortByDif)

  console.log(
    `Deduped pool: ${pool.length} (from ${poolRaw.length} rows). Tutorial: ${tutorial.length} (unchanged).`
  )
  console.log(
    `Tier by dif — easy: dif < ${DIF_MEDIUM_MIN} (${easy.length}), medium: ${DIF_MEDIUM_MIN}–${DIF_MEDIUM_MAX} (${medium.length}), hard: dif > ${DIF_MEDIUM_MAX} (${hard.length})`
  )

  const header = `/**
 * Roly Poly daily tiers + tutorial. Grid size: easy 5x5, medium 6x6, hard 7x7 (every puzzle lists size explicitly).
 *
 * Each puzzle's \`solution\` is a minimum-move path with the lowest inner \`dif\` weight, then lexicographic LRUD tie-break - tools/rolypoly/rolyPolyBfsSolver.mjs (\`analyzeCanonicalSolution\`). Refresh: npm run canonicalize:rolypoly -- --write
 * \`dif\` = inner sum times size multiplier (5->3, 6->4, 7->5) - tools/rolypoly/computeRolyPolyDif.mjs. Optional \`solns\` = distinct shortest winning paths.
 * Non-tutorial: sorted by dif within tier; easy dif &lt; 52, medium 52–108, hard dif &gt; 108.
 */
export default {
`
  const body = [
    formatRolyPolyTier('tutorial', tutorial),
    '',
    formatRolyPolyTier('easy', easy),
    '',
    formatRolyPolyTier('medium', medium),
    '',
    formatRolyPolyTier('hard', hard),
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
