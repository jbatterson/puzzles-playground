/**
 * Find puzzles whose target + block layout matches another under rotation/reflection
 * (ball start positions ignored). Reports counts only — does not modify puzzles.js.
 *
 *   node --import ./tools/registerSharedContractsResolve.mjs tools/rolypoly/findRolyPolySymmetryDuplicates.mjs
 */
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

import { ROLY_POLY_TIER_ORDER } from './rolyPolyPuzzleLedgerFormat.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const PUZZLES_REL = 'puzzlegames/rolypoly/puzzles.js'

/** @param {[number, number]} cell */
function transformCell([r, c], sym, n) {
  switch (sym) {
    case 0:
      return [r, c]
    case 1:
      return [c, n - 1 - r]
    case 2:
      return [n - 1 - r, n - 1 - c]
    case 3:
      return [n - 1 - c, r]
    case 4:
      return [r, n - 1 - c]
    case 5:
      return [n - 1 - r, c]
    case 6:
      return [c, r]
    case 7:
      return [n - 1 - c, n - 1 - r]
    default:
      throw new Error(`bad sym ${sym}`)
  }
}

function compareCell(a, b) {
  return a[0] - b[0] || a[1] - b[1]
}

function sortCells(cells) {
  return cells.map((c) => [...c]).sort(compareCell)
}

/**
 * Canonical key for (size, targets, blocks) under D4 symmetries.
 * @param {{ size?: number, targets?: [number, number][], blocks?: [number, number][] }} p
 */
export function symmetryLayoutKey(p) {
  const n = Number.isFinite(p.size) && p.size >= 3 ? Math.trunc(p.size) : 7
  const targets = p.targets ?? []
  const blocks = p.blocks ?? []

  let best = null
  for (let sym = 0; sym < 8; sym++) {
    const t = sortCells(targets.map((cell) => transformCell(cell, sym, n)))
    const bl = sortCells(blocks.map((cell) => transformCell(cell, sym, n)))
    const key = JSON.stringify({ sz: n, t, bl })
    if (best == null || key < best) best = key
  }
  return best
}

async function main() {
  const abs = path.join(repoRoot, PUZZLES_REL)
  const data = (await import(pathToFileURL(abs).href + `?v=${Date.now()}`)).default

  /** @type {{ id: string, tier: string, index: number, par?: number, dif?: number }[]} */
  const entries = []
  for (const tier of ROLY_POLY_TIER_ORDER) {
    const list = data[tier]
    if (!Array.isArray(list)) continue
    list.forEach((p, index) => {
      entries.push({
        id: `${tier}#${index + 1}`,
        tier,
        index: index + 1,
        par: p.par,
        dif: p.dif,
        key: symmetryLayoutKey(p),
      })
    })
  }

  /** @type {Map<string, typeof entries>} */
  const groups = new Map()
  for (const e of entries) {
    const g = groups.get(e.key) ?? []
    g.push(e)
    groups.set(e.key, g)
  }

  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1)
  duplicateGroups.sort((a, b) => b.length - a.length || a[0].id.localeCompare(b[0].id))

  const puzzlesInDupGroups = duplicateGroups.reduce((s, g) => s + g.length, 0)
  const extraCopies = duplicateGroups.reduce((s, g) => s + (g.length - 1), 0)

  console.log('Roly Poly symmetry duplicate scan (targets + blocks only; balls ignored)')
  console.log('Symmetries: 4 rotations + 4 reflections on the square grid (D4).\n')
  console.log(`Puzzles scanned:     ${entries.length}`)
  console.log(`Unique layouts:      ${groups.size}`)
  console.log(`Duplicate classes:   ${duplicateGroups.length} (groups with 2+ puzzles)`)
  console.log(`Puzzles in a class:  ${puzzlesInDupGroups} (member of some duplicate group)`)
  console.log(`Redundant copies:    ${extraCopies} (could remove this many and keep one per class)\n`)

  if (duplicateGroups.length === 0) {
    console.log('No symmetry-equivalent duplicate layouts found.')
    return
  }

  const byTier = { tutorial: 0, easy: 0, medium: 0, hard: 0 }
  for (const g of duplicateGroups) {
    for (const e of g) byTier[e.tier] = (byTier[e.tier] ?? 0) + 1
  }
  console.log('Puzzles in duplicate groups by tier:', byTier)

  const crossTier = duplicateGroups.filter((g) => new Set(g.map((e) => e.tier)).size > 1)
  console.log(`Groups spanning multiple tiers: ${crossTier.length}\n`)

  const show = Math.min(duplicateGroups.length, 15)
  console.log(`Largest duplicate groups (showing up to ${show}):\n`)
  for (let i = 0; i < show; i++) {
    const g = duplicateGroups[i]
    const layout = JSON.parse(g[0].key)
    console.log(
      `  ×${g.length}  size ${layout.sz}  targets ${layout.t.length}  blocks ${layout.bl.length}`
    )
    for (const e of g) {
      console.log(`      ${e.id}  par ${e.par ?? '—'}  dif ${e.dif ?? '—'}`)
    }
    console.log('')
  }
  if (duplicateGroups.length > show) {
    console.log(`  … and ${duplicateGroups.length - show} more duplicate classes`)
  }
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])

if (isMain) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
