/**
 * Find / remove Scurry puzzles that are duplicates under:
 *   --mode orient           … any of the 8 transforms in `scurryDailyPresentation.js`
 *   --mode orient-translate … any of those transforms, then any translation that fits in 5×5
 *
 * Default: dry-run report only. Pass --write to rewrite `puzzlegames/scurry/puzzles.js`.
 * Default tiers: easy, medium, hard (tutorial unchanged). Add --include-tutorial to dedupe it too.
 *
 * Run from repo root: node tools/dedupeScurryPuzzles.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { scurryTransformCellIndex } from '../puzzlegames/scurry/scurryDailyPresentation.js'
import { formatScurryPuzzleSourceLine } from '../puzzlegames/scurry/formatScurryPuzzleForCopy.js'

const repoRoot = path.resolve(import.meta.dirname, '..')
const PUZZLES_PATH = path.join(repoRoot, 'puzzlegames/scurry/puzzles.js')
const TIER_ORDER = ['tutorial', 'easy', 'medium', 'hard']

const GRID = 5

/**
 * @param {number} sq
 * @returns {[number, number]}
 */
function indexToRC(sq) {
  const r = Math.floor((sq - 1) / GRID)
  const c = (sq - 1) % GRID
  return [r, c]
}

/**
 * @param {number[]} arr
 */
function sortNums(arr) {
  return [...arr].sort((a, b) => a - b)
}

/**
 * @param {[number, number][]} pairs
 */
function sortPairs(pairs) {
  return [...pairs].sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

/**
 * @param {number[]} targets
 * @param {number[]} prePlaced
 * @param {boolean} reflectH
 * @param {number} rotQuarters
 */
function remapCells(targets, prePlaced, reflectH, rotQuarters) {
  return {
    targets: targets.map((sq) => scurryTransformCellIndex(sq, reflectH, rotQuarters)),
    prePlaced: prePlaced.map((sq) => scurryTransformCellIndex(sq, reflectH, rotQuarters)),
  }
}

/**
 * @param {{ targets: number[], prePlaced: number[], maxBugs: number }} puzzle
 */
function orientCanonicalKey(puzzle) {
  let best = ''
  for (let reflectH = 0; reflectH <= 1; reflectH++) {
    const h = Boolean(reflectH)
    for (let rot = 0; rot < 4; rot++) {
      const { targets, prePlaced } = remapCells(puzzle.targets, puzzle.prePlaced, h, rot)
      const s = JSON.stringify({
        m: puzzle.maxBugs,
        t: sortNums(targets),
        p: sortNums(prePlaced),
      })
      if (!best || s < best) best = s
    }
  }
  return best
}

/**
 * After orienting, shift so min row/col of all occupied cells is (0,0).
 * @param {{ targets: number[], prePlaced: number[], maxBugs: number }} puzzle
 */
function orientTranslateCanonicalKey(puzzle) {
  let best = ''
  for (let reflectH = 0; reflectH <= 1; reflectH++) {
    const h = Boolean(reflectH)
    for (let rot = 0; rot < 4; rot++) {
      const { targets, prePlaced } = remapCells(puzzle.targets, puzzle.prePlaced, h, rot)
      const occupied = [...targets, ...prePlaced]
      let minR = Infinity
      let minC = Infinity
      for (const sq of occupied) {
        const [r, c] = indexToRC(sq)
        minR = Math.min(minR, r)
        minC = Math.min(minC, c)
      }
      const normT = sortPairs(
        targets.map((sq) => {
          const [r, c] = indexToRC(sq)
          return [r - minR, c - minC]
        })
      )
      const normP = sortPairs(
        prePlaced.map((sq) => {
          const [r, c] = indexToRC(sq)
          return [r - minR, c - minC]
        })
      )
      const s = JSON.stringify({
        m: puzzle.maxBugs,
        t: normT,
        p: normP,
      })
      if (!best || s < best) best = s
    }
  }
  return best
}

/**
 * @param {{ targets: number[], prePlaced: number[], maxBugs: number }[]} list
 * @param {(p: { targets: number[], prePlaced: number[], maxBugs: number }) => string} keyFn
 */
function dedupeTier(list, keyFn) {
  /** @type {Map<string, number>} */
  const firstIndex = new Map()
  const keep = []
  /** @type {{ tierIndex: number, duplicateOfTierIndex: number, line: string }[]} */
  const removed = []

  list.forEach((puzzle, tierIndex) => {
    const key = keyFn(puzzle)
    if (firstIndex.has(key)) {
      const dupOf = firstIndex.get(key)
      removed.push({
        tierIndex,
        duplicateOfTierIndex: /** @type {number} */ (dupOf),
        line: formatScurryPuzzleSourceLine(puzzle),
      })
    } else {
      firstIndex.set(key, tierIndex)
      keep.push(puzzle)
    }
  })

  return { keep, removed }
}

/**
 * @param {Record<string, unknown>} data
 * @param {string[]} tiers
 */
function formatPuzzlesFileBody(data, tiers) {
  const blocks = tiers.map((tier) => {
    const list = data[tier]
    if (!Array.isArray(list)) throw new Error(`Tier "${tier}" is not an array`)
    const lines = list.map((p) => `    ${formatScurryPuzzleSourceLine(p)},`)
    return `  ${tier}: [\n${lines.join('\n')}\n  ],`
  })
  return `export default {\n${blocks.join('\n\n')}\n}\n`
}

function parseArgs(argv) {
  const write = argv.includes('--write')
  let mode = 'orient-translate'
  const modeArg = argv.find((a) => a.startsWith('--mode='))
  if (modeArg) {
    const v = modeArg.slice('--mode='.length)
    if (v !== 'orient' && v !== 'orient-translate') {
      console.error(`Unknown --mode=${v} (use orient | orient-translate)`)
      process.exit(1)
    }
    mode = v
  }
  const includeTutorial = argv.includes('--include-tutorial')
  return { write, mode, includeTutorial }
}

async function main() {
  const { write, mode, includeTutorial } = parseArgs(process.argv.slice(2))
  const keyFn = mode === 'orient' ? orientCanonicalKey : orientTranslateCanonicalKey

  const tiersToDedupe = includeTutorial
    ? ['tutorial', 'easy', 'medium', 'hard']
    : ['easy', 'medium', 'hard']

  const puzzlesUrl = pathToFileURL(PUZZLES_PATH).href
  const mod = await import(puzzlesUrl)
  const puzzleData = mod.default
  if (!puzzleData || typeof puzzleData !== 'object') {
    console.error('Expected default export object from puzzles.js')
    process.exit(1)
  }

  /** @type {Record<string, unknown[]>} */
  const next = {}
  let totalBefore = 0
  let totalAfter = 0
  let totalRemoved = 0

  for (const tier of TIER_ORDER) {
    const list = puzzleData[tier]
    if (!Array.isArray(list)) continue

    if (!tiersToDedupe.includes(tier)) {
      next[tier] = list
      continue
    }

    totalBefore += list.length
    const { keep, removed } = dedupeTier(list, keyFn)
    next[tier] = keep
    totalAfter += keep.length
    totalRemoved += removed.length

    console.log(`\n## ${tier} (${mode})`)
    console.log(`  puzzles before: ${list.length}`)
    console.log(`  puzzles after:  ${keep.length}`)
    console.log(`  weeded out:     ${removed.length}`)
    if (removed.length > 0) {
      for (const r of removed) {
        console.log(
          `    - #${r.tierIndex + 1} duplicate of #${r.duplicateOfTierIndex + 1}: ${r.line}`
        )
      }
    }
  }

  console.log(`\n## Summary (${mode})`)
  console.log(`  tiers deduped: ${tiersToDedupe.join(', ')}`)
  console.log(`  total weeded out (this run): ${totalRemoved}`)
  console.log(`  total puzzles in deduped tiers before → after: ${totalBefore} → ${totalAfter}`)

  if (write) {
    const out = formatPuzzlesFileBody(
      next,
      TIER_ORDER.filter((t) => Array.isArray(puzzleData[t]))
    )
    fs.writeFileSync(PUZZLES_PATH, out, 'utf8')
    console.log(`\nWrote ${path.relative(repoRoot, PUZZLES_PATH)}`)
  } else {
    console.log(`\nDry run (no file changes). Pass --write to apply.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
