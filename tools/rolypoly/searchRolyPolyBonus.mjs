/**
 * Timed Roly Poly bonus-pool search.
 *
 * Defaults: 7×7, 3 balls/targets; cycle 3-blocks/2m → 4-blocks/2m;
 * par 21–50, append to bonus, dedupe every 6 rounds; finish with dif≥220 cull + sort by par, dif.
 *
 *   node tools/rolypoly/searchRolyPolyBonus.mjs
 *   node tools/rolypoly/searchRolyPolyBonus.mjs --minutes=20
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { analyzeCanonicalSolution } from './rolyPolyBfsSolver.mjs'
import { formatRolyPolyTier, ROLY_POLY_TIER_ORDER } from './rolyPolyPuzzleLedgerFormat.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const PUZZLES_ABS = path.join(repoRoot, 'puzzlegames/rolypoly/puzzles.js')

const GRID = 7
const NUM_BALLS = 3
const BLOCK_CYCLE = [
  { blocks: 3, ms: 2 * 60_000 },
  { blocks: 4, ms: 2 * 60_000 },
]
const MIN_PAR = 21
const MAX_PAR = 50
const MIN_DIF = 220
const DEDUPE_EVERY = 6

function argNum(name, fallback) {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (!hit) return fallback
  const n = Number(hit.slice(prefix.length))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const TOTAL_MS = argNum('minutes', 20) * 60_000

const HEADER = `/**
 * Roly Poly daily tiers + tutorial. Grid size: easy 5x5, medium 6x6, hard 7x7 (every puzzle lists size explicitly).
 *
 * Each puzzle's \`solution\` is a minimum-move path with the lowest inner \`dif\` weight, then lexicographic LRUD tie-break - tools/rolypoly/rolyPolyBfsSolver.mjs (\`analyzeCanonicalSolution\`). Refresh: npm run canonicalize:rolypoly -- --write
 * \`dif\` = inner sum times size multiplier (5->3, 6->4, 7->5) - tools/rolypoly/computeRolyPolyDif.mjs. Optional \`solns\` = distinct shortest winning paths.
 * Non-tutorial: sorted by dif within tier; easy dif &lt; 52, medium 52–108, hard dif &gt; 108.
 * Bonus: harder-than-hard (par &gt; 20); expand toward ~75.
 */
export default {
`

function fingerprint(p) {
  return JSON.stringify({
    sz: Number.isFinite(p.size) ? p.size : GRID,
    b: p.balls,
    t: p.targets,
    bl: p.blocks,
  })
}

function pickRandom(n, exclude) {
  const used = new Set(exclude.map(([r, c]) => r * GRID + c))
  const chosen = []
  let safety = 0
  while (chosen.length < n && safety++ < 20_000) {
    const r = Math.floor(Math.random() * GRID)
    const c = Math.floor(Math.random() * GRID)
    const key = r * GRID + c
    if (used.has(key)) continue
    used.add(key)
    chosen.push([r, c])
  }
  return chosen
}

function generateLayout(numBlocks) {
  const balls = pickRandom(NUM_BALLS, [])
  const targets = pickRandom(NUM_BALLS, balls)
  const blocks = pickRandom(numBlocks, [...balls, ...targets])
  return { size: GRID, balls, targets, blocks }
}

function cloneTiers(data) {
  const out = {}
  for (const tier of ROLY_POLY_TIER_ORDER) {
    out[tier] = [...(data[tier] || [])]
  }
  return out
}

function buildSeen(tiers) {
  const seen = new Set()
  for (const tier of ROLY_POLY_TIER_ORDER) {
    for (const p of tiers[tier] || []) seen.add(fingerprint(p))
  }
  return seen
}

/** Drop bonus layouts that already appear in any tier (bonus last → loses to earlier tiers). */
function dedupeBonusAgainstPool(tiers) {
  const seen = new Set()
  for (const tier of ['tutorial', 'easy', 'medium', 'hard']) {
    for (const p of tiers[tier] || []) seen.add(fingerprint(p))
  }
  const before = (tiers.bonus || []).length
  const keep = []
  let removed = 0
  for (const p of tiers.bonus || []) {
    const fp = fingerprint(p)
    if (seen.has(fp)) {
      removed++
      continue
    }
    seen.add(fp)
    keep.push(p)
  }
  tiers.bonus = keep
  return { before, after: keep.length, removed }
}

function writePuzzles(tiers) {
  const parts = []
  for (const tier of ROLY_POLY_TIER_ORDER) {
    parts.push(formatRolyPolyTier(tier, tiers[tier] || []))
    parts.push('')
  }
  parts.push('}')
  fs.writeFileSync(PUZZLES_ABS, HEADER + parts.join('\n') + '\n', 'utf8')
}

function fmtMs(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function cullBonusLowDif(tiers, minDif) {
  const before = tiers.bonus.length
  tiers.bonus = tiers.bonus.filter((p) => Number.isFinite(p.dif) && p.dif >= minDif)
  return { before, after: tiers.bonus.length, removed: before - tiers.bonus.length }
}

function sortBonusByParThenDif(tiers) {
  tiers.bonus.sort(
    (a, b) => (a.par ?? 0) - (b.par ?? 0) || (a.dif ?? 0) - (b.dif ?? 0)
  )
}

async function main() {
  const data = (await import(pathToFileURL(PUZZLES_ABS).href + `?t=${Date.now()}`)).default
  const tiers = cloneTiers(data)

  const preCull = cullBonusLowDif(tiers, MIN_DIF)
  if (preCull.removed) {
    writePuzzles(tiers)
    console.log(`Pre-cull dif < ${MIN_DIF}: bonus ${preCull.before} → ${preCull.after}`)
  }

  let seen = buildSeen(tiers)
  const bonusStart = tiers.bonus.length

  const cycleDesc = BLOCK_CYCLE.map((s) => `${s.blocks}b/${fmtMs(s.ms)}`).join(' → ')
  console.log(
    `Roly Poly bonus search: ${GRID}x${GRID}, ${NUM_BALLS} balls, cycle ${cycleDesc}, par ${MIN_PAR}–${MAX_PAR}, dif ≥ ${MIN_DIF}`
  )
  console.log(`Duration ${fmtMs(TOTAL_MS)}, dedupe every ${DEDUPE_EVERY} rounds`)
  console.log(`Bonus pool start: ${bonusStart}`)
  console.log('')

  const t0 = Date.now()
  let round = 0
  let attempts = 0
  let foundThisRun = 0
  let solvableHits = 0
  const byBlocks = { 3: 0, 4: 0 }
  const byPar = {}

  while (Date.now() - t0 < TOTAL_MS) {
    const slot = BLOCK_CYCLE[round % BLOCK_CYCLE.length]
    const numBlocks = slot.blocks
    const roundEnd = Math.min(t0 + TOTAL_MS, Date.now() + slot.ms)
    let roundAttempts = 0
    let roundFound = 0
    round++

    process.stdout.write(
      `Round ${round} blocks=${numBlocks} ${fmtMs(slot.ms)} (elapsed ${fmtMs(Date.now() - t0)}) … `
    )

    while (Date.now() < roundEnd) {
      attempts++
      roundAttempts++
      const layout = generateLayout(numBlocks)
      const fp = fingerprint(layout)
      if (seen.has(fp)) continue

      const analysis = analyzeCanonicalSolution(layout)
      if (!analysis) continue
      solvableHits++
      if (analysis.par < MIN_PAR || analysis.par > MAX_PAR) continue
      if (analysis.dif < MIN_DIF) continue

      const puzzle = {
        size: GRID,
        balls: layout.balls,
        targets: layout.targets,
        blocks: layout.blocks,
        par: analysis.par,
        solution: analysis.solution,
        dif: analysis.dif,
        solns: analysis.solns ?? undefined,
      }
      if (puzzle.solns == null) delete puzzle.solns

      seen.add(fp)
      tiers.bonus.push(puzzle)
      foundThisRun++
      roundFound++
      byBlocks[numBlocks] = (byBlocks[numBlocks] || 0) + 1
      byPar[analysis.par] = (byPar[analysis.par] || 0) + 1
    }

    writePuzzles(tiers)
    console.log(
      `${roundFound} found / ${roundAttempts} attempts → bonus ${tiers.bonus.length}`
    )

    if (round % DEDUPE_EVERY === 0) {
      const { before, after, removed } = dedupeBonusAgainstPool(tiers)
      seen = buildSeen(tiers)
      writePuzzles(tiers)
      console.log(`  dedupe: bonus ${before} → ${after} (removed ${removed})`)
    }
  }

  const finalDedupe = dedupeBonusAgainstPool(tiers)
  const postCull = cullBonusLowDif(tiers, MIN_DIF)
  sortBonusByParThenDif(tiers)
  seen = buildSeen(tiers)
  writePuzzles(tiers)

  console.log('')
  console.log('── Done ──')
  console.log(`Elapsed: ${fmtMs(Date.now() - t0)}`)
  console.log(`Rounds: ${round}`)
  console.log(`Attempts: ${attempts}`)
  console.log(`Solvable (any par): ${solvableHits}`)
  console.log(`New bonus finds this run: ${foundThisRun}`)
  console.log(`Final dedupe removed: ${finalDedupe.removed}`)
  console.log(`Post-cull dif < ${MIN_DIF}: removed ${postCull.removed}`)
  console.log(`Bonus pool: ${bonusStart} → ${tiers.bonus.length} (sorted by par, then dif)`)
  console.log('By blocks:', byBlocks)
  console.log(
    'By par:',
    Object.keys(byPar)
      .map(Number)
      .sort((a, b) => a - b)
      .map((p) => `${p}:${byPar[p]}`)
      .join(' ') || '(none)'
  )
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
