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

function escapeJsSingleQuotedString(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function compareCellKeys(ka, kb) {
  const [ar, ac] = ka.split(',').map(Number)
  const [br, bc] = kb.split(',').map(Number)
  if (ar !== br) return ar - br
  return ac - bc
}

function formatBoardRecordForPuzzlesJs(board) {
  if (!board || typeof board !== 'object') return '{}'
  const keys = Object.keys(board).sort(compareCellKeys)
  return '{ ' + keys.map((k) => `'${k}': '${board[k]}'`).join(', ') + ' }'
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

/** Folds — matches puzzlegames/folds/puzzles.js */
function formatFoldsPuzzleForPuzzlesJs(puzzle) {
  if (!puzzle || typeof puzzle !== 'object') return null
  if (!puzzle.start || !puzzle.target || typeof puzzle.folds !== 'number') return null
  return `{ start: ${formatBoardRecordForPuzzlesJs(puzzle.start)}, target: ${formatBoardRecordForPuzzlesJs(puzzle.target)}, folds: ${puzzle.folds} }`
}

const CLUELESS_KEY_ORDER = ['h1', 'h2', 'h3', 'v1', 'v2', 'v3']

/** Honeycombs — matches puzzlegames/honeycombs/puzzles.js */
function formatHoneycombPuzzleForPuzzlesJs(puzzle) {
  if (!puzzle || typeof puzzle !== 'object') return JSON.stringify(puzzle)
  const { size, clues } = puzzle
  if (typeof size !== 'string' || !Array.isArray(clues)) return JSON.stringify(puzzle)
  const tripleStr = (t) => {
    if (!Array.isArray(t) || t.length < 3) return JSON.stringify(t)
    return `[${t[0]}, ${t[1]}, ${t[2]}]`
  }
  return `{ size: '${size}', clues: [${clues.map(tripleStr).join(', ')}] }`
}

/** Scurry — matches puzzlegames/scurry/puzzles.js */
function formatScurryPuzzleForPuzzlesJs(puzzle) {
  if (!puzzle || typeof puzzle !== 'object') return JSON.stringify(puzzle)
  const { targets, maxBugs, prePlaced } = puzzle
  if (!Array.isArray(targets) || typeof maxBugs !== 'number' || !Array.isArray(prePlaced)) {
    return JSON.stringify(puzzle)
  }
  const nums = (arr) => arr.join(', ')
  return `{ targets: [${nums(targets)}], maxBugs: ${maxBugs}, prePlaced: [${nums(prePlaced)}] }`
}

/** Clueless — matches puzzlegames/clueless/puzzles.js */
function formatCluelessPuzzleForPuzzlesJs(puzzle) {
  if (!puzzle || typeof puzzle !== 'object') return null
  const seen = new Set()
  const keys = []
  for (const k of CLUELESS_KEY_ORDER) {
    if (Object.prototype.hasOwnProperty.call(puzzle, k)) {
      keys.push(k)
      seen.add(k)
    }
  }
  for (const k of Object.keys(puzzle).sort()) {
    if (!seen.has(k)) keys.push(k)
  }
  if (keys.length === 0) return null
  const parts = keys.map((k) => {
    const v = puzzle[k]
    return typeof v === 'string'
      ? `${k}: '${escapeJsSingleQuotedString(v)}'`
      : `${k}: ${JSON.stringify(v)}`
  })
  return '{ ' + parts.join(', ') + ' }'
}

/**
 * Line 2 matches how puzzles appear in each game's puzzles.js (spacing, quotes).
 * Falls back to truncated JSON.stringify for unknown shapes / games.
 *
 * @param {string} gameSlug e.g. 'sumtiles', 'folds', 'clueless'
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
    case 'folds':
      line2 = formatFoldsPuzzleForPuzzlesJs(puzzle)
      break
    case 'honeycombs':
      line2 = formatHoneycombPuzzleForPuzzlesJs(puzzle)
      break
    case 'scurry':
      line2 = formatScurryPuzzleForPuzzlesJs(puzzle)
      break
    case 'clueless':
      line2 = formatCluelessPuzzleForPuzzlesJs(puzzle)
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
 * Flat roster from a single array (e.g. Clueless default export).
 * @param {unknown[]} items
 * @param {string} [tierLabel]
 */
export function buildFlatPuzzleRoster(items, tierLabel = 'all') {
  if (!Array.isArray(items)) return []
  return items.map((puzzle, indexInTier) => ({ tier: tierLabel, indexInTier, puzzle }))
}
