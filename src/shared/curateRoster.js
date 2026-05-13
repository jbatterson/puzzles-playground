/** Tier order for suite games (tutorial + daily difficulties). */
export const DEFAULT_SUITE_TIER_ORDER = ['tutorial', 'easy', 'medium', 'hard']

/**
 * @param {Record<string, unknown>} puzzleData — default export from a game's puzzles.js
 * @param {string[]} [tierOrder]
 * @returns {{ tier: string, indexInTier: number, puzzle: unknown }[]}
 */
export function buildTierRoster(puzzleData, tierOrder = DEFAULT_SUITE_TIER_ORDER) {
  const list = []
  for (const tier of tierOrder) {
    const arr = puzzleData[tier]
    if (!Array.isArray(arr)) continue
    arr.forEach((puzzle, indexInTier) => {
      list.push({ tier, indexInTier, puzzle })
    })
  }
  return list
}

/**
 * @param {string} search — e.g. `window.location.search`
 * @returns {{ curate: boolean, i: number }} `i` is 0-based flat roster index
 */
export function parseCurateParams(search) {
  const params = new URLSearchParams(search)
  const c = params.get('curate')
  const curate = c === '1' || c === 'true' || c === ''
  const iRaw = params.get('i')
  let i = 0
  if (iRaw != null) {
    const n = parseInt(iRaw, 10)
    if (!Number.isNaN(n) && n >= 0) i = n
  }
  return { curate, i }
}

/** Sum Tiles / Productiles — matches each game's puzzlegames/.../puzzles.js one-liners */
function formatTilePuzzleForPuzzlesJs(puzzle) {
  if (!puzzle || typeof puzzle !== 'object') return null
  const t = puzzle.t
  if (!t || !Array.isArray(t.rows) || !Array.isArray(t.cols) || !Array.isArray(puzzle.b))
    return null
  const rows = t.rows.join(', ')
  const cols = t.cols.join(', ')
  const bStr = puzzle.b.map((row) => '[' + row.join(', ') + ']').join(', ')
  let line = `{ s: ${puzzle.s}, t: { rows: [${rows}], cols: [${cols}] }, b: [${bStr}]`
  if (Number.isFinite(puzzle.minMoves)) line += `, minMoves: ${puzzle.minMoves}`
  line += ' }'
  return line
}

/** Roly Poly — matches puzzlegames/rolypoly/puzzles.js object shape */
function formatRolyPolyPuzzleForPuzzlesJs(puzzle) {
  if (!puzzle || typeof puzzle !== 'object') return null
  if (
    !Array.isArray(puzzle.balls) ||
    !Array.isArray(puzzle.targets) ||
    !Array.isArray(puzzle.blocks)
  )
    return null
  const fmtPairs = (arr) => arr.map((p) => (Array.isArray(p) ? `[${p.join(', ')}]` : '')).join(', ')
  let line = '{ '
  if (Number.isFinite(puzzle.size) && puzzle.size !== 7) line += `size: ${puzzle.size}, `
  line += `balls: [${fmtPairs(puzzle.balls)}], targets: [${fmtPairs(puzzle.targets)}], blocks: [${fmtPairs(puzzle.blocks)}]`
  if (Number.isFinite(puzzle.minMoves)) line += `, minMoves: ${puzzle.minMoves}`
  else if (Number.isFinite(puzzle.par)) line += `, par: ${puzzle.par}`
  line += ' }'
  return line
}

/**
 * Line 2 matches how puzzles appear in each game's puzzles.js (spacing, quotes).
 * Falls back to truncated JSON.stringify for unknown shapes / games.
 *
 * @param {string} gameSlug e.g. 'sumtiles', 'productiles'
 * @param {string} tier
 * @param {number} indexOneBased
 * @param {unknown} puzzle
 * @param {number} [jsonPrefixLength] max length when falling back to JSON.stringify only
 */
export function formatCurateClipboard(
  gameSlug,
  tier,
  indexOneBased,
  puzzle,
  jsonPrefixLength = 100
) {
  const line1 = `${gameSlug} ${tier} ${indexOneBased}`
  let line2 = null
  switch (gameSlug) {
    case 'sumtiles':
    case 'productiles':
      line2 = formatTilePuzzleForPuzzlesJs(puzzle)
      break
    case 'rolypoly':
      line2 = formatRolyPolyPuzzleForPuzzlesJs(puzzle)
      break
    default:
      break
  }
  if (line2 == null) {
    line2 = JSON.stringify(puzzle)
    if (jsonPrefixLength > 0 && line2.length > jsonPrefixLength) {
      line2 = line2.slice(0, jsonPrefixLength)
    }
  }
  return `${line1}\n${line2}`
}

/**
 * Flat roster from a single array.
 * @param {unknown[]} items
 * @param {string} [tierLabel]
 */
export function buildFlatPuzzleRoster(items, tierLabel = 'all') {
  if (!Array.isArray(items)) return []
  return items.map((puzzle, indexInTier) => ({ tier: tierLabel, indexInTier, puzzle }))
}
