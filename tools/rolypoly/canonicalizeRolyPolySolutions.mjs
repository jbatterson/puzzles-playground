/**
 * Recompute every Roly Poly puzzle’s `par`, canonical `solution` (shortest moves, then lowest inner
 * `dif` sum, then lexicographic LRUD), `dif`, and optional `solns` (count of shortest winning paths).
 *
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/rolypoly/canonicalizeRolyPolySolutions.mjs
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/rolypoly/canonicalizeRolyPolySolutions.mjs --write
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

import { analyzeCanonicalSolution } from './rolyPolyBfsSolver.mjs'
import { formatRolyPolyTier, ROLY_POLY_TIER_ORDER } from './rolyPolyPuzzleLedgerFormat.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const PUZZLES_REL = 'puzzlegames/rolypoly/puzzles.js'
const write = process.argv.includes('--write')

const HEADER = `/**
 * Roly Poly daily tiers + tutorial. Grid size: easy 5x5, medium 6x6, hard 7x7 (every puzzle lists size explicitly).
 *
 * Each puzzle's \`solution\` is a minimum-move path with the lowest inner \`dif\` weight (unlocked balls before each move), then lexicographic LRUD tie-break - see tools/rolypoly/rolyPolyBfsSolver.mjs (\`analyzeCanonicalSolution\`).
 * \`dif\` = inner sum times size multiplier (5->3, 6->4, 7->5) - see tools/rolypoly/computeRolyPolyDif.mjs.
 * \`solns\` = count of distinct shortest winning paths (same \`par\`). Refresh: npm run canonicalize:rolypoly -- --write
 * Non-tutorial: when using tools/rolypoly/reorganizeRolyPolyPuzzles.mjs, sorted by \`dif\` within tier; easy dif < 52, medium 52–108, hard dif > 108.
 */
export default {
`

function fingerprint(p) {
  return JSON.stringify({
    sz: Number.isFinite(p.size) ? p.size : 7,
    b: p.balls,
    t: p.targets,
    bl: p.blocks,
  })
}

function canonicalizePuzzle(p) {
  const a = analyzeCanonicalSolution(p)
  if (!a) {
    throw new Error(`Unsolvable or search cap hit: ${fingerprint(p)}`)
  }
  const next = {
    ...p,
    par: a.par,
    solution: a.solution,
    dif: a.dif,
  }
  if (a.solns != null) next.solns = a.solns
  else delete next.solns
  return { next, prev: p, analysis: a }
}

async function main() {
  const abs = path.join(repoRoot, PUZZLES_REL)
  const data = (await import(pathToFileURL(abs).href + `?v=${Date.now()}`)).default

  const t0 = Date.now()
  let changed = 0
  let parMismatch = 0
  const outTiers = {}

  for (const tier of ROLY_POLY_TIER_ORDER) {
    const arr = data[tier]
    if (!Array.isArray(arr)) continue
    outTiers[tier] = []
    for (const p of arr) {
      const { next, prev, analysis } = canonicalizePuzzle(p)
      outTiers[tier].push(next)
      if (
        prev.solution !== next.solution ||
        prev.dif !== next.dif ||
        prev.par !== next.par ||
        prev.solns !== next.solns
      ) {
        changed++
      }
      if (Number.isFinite(prev.par) && prev.par !== analysis.par) {
        parMismatch++
        console.warn(`par corrected ${fingerprint(prev)}: was ${prev.par}, now ${analysis.par}`)
      }
    }
  }

  const body = [
    formatRolyPolyTier('tutorial', outTiers.tutorial || []),
    '',
    formatRolyPolyTier('easy', outTiers.easy || []),
    '',
    formatRolyPolyTier('medium', outTiers.medium || []),
    '',
    formatRolyPolyTier('hard', outTiers.hard || []),
    '',
    '}',
  ].join('\n')

  const out = HEADER + body + '\n'
  const ms = Date.now() - t0

  console.log(`Canonicalized ${ROLY_POLY_TIER_ORDER.reduce((n, t) => n + (outTiers[t]?.length ?? 0), 0)} puzzles in ${ms}ms. Rows changed (solution/dif/par/solns): ${changed}.`)
  if (parMismatch) console.log(`par mismatches vs file: ${parMismatch}`)

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
