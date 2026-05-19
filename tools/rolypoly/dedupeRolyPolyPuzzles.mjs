/**
 * Remove duplicate Roly Poly puzzles in puzzlegames/rolypoly/puzzles.js:
 * - Within each tier: exact duplicate objects (same layout + metadata).
 * - Across easy/medium/hard: same layout fingerprint (balls/targets/blocks/size), keep first seen.
 *
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/rolypoly/dedupeRolyPolyPuzzles.mjs
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/rolypoly/dedupeRolyPolyPuzzles.mjs --write
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

import { formatRolyPolyTier, ROLY_POLY_TIER_ORDER } from './rolyPolyPuzzleLedgerFormat.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const PUZZLES_REL = 'puzzlegames/rolypoly/puzzles.js'
const write = process.argv.includes('--write')

const POOL_TIERS = ['easy', 'medium', 'hard']

function canonicalKey(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(canonicalKey).join(',') + ']'
  return (
    '{' +
    Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalKey(v[k])}`)
      .join(',') +
    '}'
  )
}

function fingerprint(p) {
  return JSON.stringify({
    sz: Number.isFinite(p.size) ? p.size : 7,
    b: p.balls,
    t: p.targets,
    bl: p.blocks,
  })
}

function dedupeTierExact(list) {
  const seen = new Map()
  const keep = []
  let removed = 0
  for (const p of list) {
    const key = canonicalKey(p)
    if (seen.has(key)) {
      removed++
      continue
    }
    seen.set(key, true)
    keep.push(p)
  }
  return { keep, removed }
}

function dedupePoolByLayout(tiers) {
  const seen = new Set()
  const out = { easy: [], medium: [], hard: [] }
  let removed = 0
  for (const tier of POOL_TIERS) {
    for (const p of tiers[tier] || []) {
      const fp = fingerprint(p)
      if (seen.has(fp)) {
        removed++
        continue
      }
      seen.add(fp)
      out[tier].push(p)
    }
  }
  return { tiers: out, removed }
}

const HEADER = `/**
 * Roly Poly daily tiers + tutorial. Grid size: easy 5x5, medium 6x6, hard 7x7 (every puzzle lists size explicitly).
 *
 * Each puzzle's \`solution\` is a minimum-move path with the lowest inner \`dif\` weight, then lexicographic LRUD tie-break - tools/rolypoly/rolyPolyBfsSolver.mjs (\`analyzeCanonicalSolution\`). Refresh: npm run canonicalize:rolypoly -- --write
 * \`dif\` = inner sum times size multiplier (5->3, 6->4, 7->5) - tools/rolypoly/computeRolyPolyDif.mjs. Optional \`solns\` = distinct shortest winning paths.
 * Non-tutorial: sorted by dif within tier; easy dif < 52, medium 52–108, hard dif > 108 (reorganize script).
 */
export default {
`

async function main() {
  const abs = path.join(repoRoot, PUZZLES_REL)
  const data = (await import(pathToFileURL(abs).href + `?v=${Date.now()}`)).default

  const tutorial = [...(data.tutorial || [])]
  let exactRemoved = 0
  const afterExact = {}
  for (const tier of POOL_TIERS) {
    const list = data[tier] || []
    const { keep, removed } = dedupeTierExact(list)
    afterExact[tier] = keep
    exactRemoved += removed
    if (removed) console.log(`${tier}: exact duplicates removed ${removed} (${list.length} → ${keep.length})`)
  }

  const poolBefore = POOL_TIERS.reduce((n, t) => n + afterExact[t].length, 0)
  const { tiers: afterLayout, removed: layoutRemoved } = dedupePoolByLayout(afterExact)
  const poolAfter = POOL_TIERS.reduce((n, t) => n + afterLayout[t].length, 0)

  console.log(
    `Pool: ${poolBefore} → ${poolAfter} (layout duplicates removed: ${layoutRemoved}, exact duplicates removed: ${exactRemoved})`
  )
  console.log(`Tutorial: ${tutorial.length} (unchanged)`)

  if (!write) {
    console.log('\nDry run — pass --write to update', PUZZLES_REL)
    return
  }

  const body = [
    formatRolyPolyTier('tutorial', tutorial),
    '',
    formatRolyPolyTier('easy', afterLayout.easy),
    '',
    formatRolyPolyTier('medium', afterLayout.medium),
    '',
    formatRolyPolyTier('hard', afterLayout.hard),
    '',
    '}',
  ].join('\n')

  fs.writeFileSync(abs, HEADER + body + '\n', 'utf8')
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
