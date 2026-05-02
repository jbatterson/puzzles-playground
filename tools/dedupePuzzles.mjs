/**
 * Detect and remove exact-duplicate puzzles across all puzzlegames puzzles.js files.
 *
 * Dry-run by default. Pass --write to rewrite files.
 * Run from repo root:
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/dedupePuzzles.mjs
 *
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = path.resolve(import.meta.dirname, '..')
const TIER_ORDER = ['tutorial', 'easy', 'medium', 'hard']
const write = process.argv.includes('--write')

// ---------------------------------------------------------------------------
// Canonical key — sorts object keys so { 'b': 1, 'a': 2 } === { 'a': 2, 'b': 1 }
// ---------------------------------------------------------------------------
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

function dedupeTier(list) {
  const seen = new Map()
  const keep = []
  const removed = []
  list.forEach((puzzle, i) => {
    const key = canonicalKey(puzzle)
    if (seen.has(key)) {
      removed.push({ i, dupOf: seen.get(key) })
    } else {
      seen.set(key, i)
      keep.push(puzzle)
    }
  })
  return { keep, removed }
}

// ---------------------------------------------------------------------------
// Formatters — keep each game's existing source style
// ---------------------------------------------------------------------------

function jsVal(v) {
  if (typeof v === 'string') return `'${v}'`
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v === null) return 'null'
  if (Array.isArray(v)) return `[${v.map(jsVal).join(', ')}]`
  const entries = Object.entries(v)
  return `{ ${entries.map(([k, val]) => `${/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `'${k}'`}: ${jsVal(val)}`).join(', ')} }`
}

/** Generic single-line (productiles, sumtiles) */
function formatGenericPuzzle(p) {
  return `    ${jsVal(p)},`
}

function buildTierBlock(tier, list, fmtPuzzle) {
  const lines = list.map(fmtPuzzle)
  return `  ${tier}: [\n${lines.join('\n')}\n  ],`
}

function writeGeneric(filePath, data) {
  const tiers = TIER_ORDER.filter((t) => Array.isArray(data[t]))
  const blocks = tiers.map((t) => buildTierBlock(t, data[t], formatGenericPuzzle))
  const out = `export default {\n${blocks.join('\n\n')}\n}\n`
  fs.writeFileSync(filePath, out, 'utf8')
}

// ---------------------------------------------------------------------------
// Games config
// ---------------------------------------------------------------------------
const GAMES = [
  { name: 'productiles', file: 'puzzlegames/productiles/puzzles.js', writer: writeGeneric },
  { name: 'sumtiles', file: 'puzzlegames/sumtiles/puzzles.js', writer: writeGeneric },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  let grandTotal = 0

  for (const game of GAMES) {
    const filePath = path.join(repoRoot, game.file)
    const mod = await import(pathToFileURL(filePath).href)
    const data = mod.default

    const next = {}
    let gameDups = 0

    console.log(`\n=== ${game.name} ===`)

    for (const tier of TIER_ORDER) {
      const list = data[tier]
      if (!Array.isArray(list)) continue

      const { keep, removed } = dedupeTier(list)
      next[tier] = keep
      gameDups += removed.length

      if (removed.length > 0) {
        console.log(`  ${tier}: ${list.length} → ${keep.length}  (removed ${removed.length})`)
        for (const r of removed) {
          console.log(`    - #${r.i + 1} is exact duplicate of #${r.dupOf + 1}`)
        }
      } else {
        console.log(`  ${tier}: ${list.length}  ✓ no duplicates`)
      }
    }

    grandTotal += gameDups

    if (write && gameDups > 0) {
      game.writer(filePath, next)
      console.log(`  → wrote ${game.file}`)
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Total exact duplicates found: ${grandTotal}`)
  if (!write) {
    console.log(`  Dry run — pass --write to apply changes.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
