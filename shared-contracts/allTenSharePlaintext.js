/**
 * Plaintext share format for All Ten (results modal, hub share, clipboard).
 * Kept in shared-contracts so the hub can use it without importing All Ten runtime.
 */

const LAUNCH_DATE = new Date(Date.parse('19 Sep 2022 00:00:00 PST'))
const DAY_IN_MS = 86400000
const MIN_DIGITS_PUZZLE_NUM = 3
const GREEN_CHECK_MARK = '✅'
const BLANK_BOX = '⬜'

function getSortedTargets(targets) {
  return [...targets].sort(
    (a, b) =>
      (a.solveOrder ? -1 : 0) + (b.solveOrder ? 1 : 0) || (a.solveOrder || 0) - (b.solveOrder || 0)
  )
}

export function allTenTargetsToSolveOrderPlaintext(targets) {
  if (!Array.isArray(targets)) return ''
  const sorted = getSortedTargets(targets)
  return sorted
    .map((target) =>
      target.solution ? `${target.number}${GREEN_CHECK_MARK}` : `${target.number}${BLANK_BOX}`
    )
    .join(' ')
}

/**
 * Elapsed milliseconds for share/UI timers.
 * Under one hour: MM:SS. One hour or more: HH:MM:SS (hours padded to 2+ digits).
 */
export function formatAllTenElapsedMsForShare(elapsedMs) {
  const n = Number(elapsedMs)
  if (!Number.isFinite(n)) {
    return '00:00'
  }
  const totalSec = Math.floor(Math.max(0, n) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  if (h === 0) return `${mm}:${ss}`
  const hh = String(h).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Same numbering as All Ten getPuzzleNumberAsString(problemDate). */
export function getAllTenPuzzleNumberDisplayString(date) {
  const puzzleNumber = Math.floor((Number(date) - Number(LAUNCH_DATE)) / DAY_IN_MS)
  const s = String(puzzleNumber)
  const prefix =
    s.length < MIN_DIGITS_PUZZLE_NUM ? '0'.repeat(MIN_DIGITS_PUZZLE_NUM - s.length) : ''
  return prefix + s
}

/**
 * @param {Array<{ number: number, solution?: unknown, solveOrder?: number | null }>} targets
 * @param {Date} problemDate — use `new Date()` when sharing “today” to match in-game behavior
 * @param {number | null | undefined} [elapsedMs] — wall-clock solve time; omitted from copy when nullish
 */
export function buildAllTenInPuzzleStyleSharePlaintext(targets, problemDate, elapsedMs) {
  if (!Array.isArray(targets) || targets.length === 0) return ''
  const puzzleNumberStr = getAllTenPuzzleNumberDisplayString(problemDate)
  const numCorrect = targets.filter((t) => t && t.solution != null).length
  const numTotal = targets.length
  const solveLine = allTenTargetsToSolveOrderPlaintext(targets)
  const lines = [`All Ten #${puzzleNumberStr}`, `${numCorrect}/${numTotal}`]
  if (elapsedMs != null && Number.isFinite(Number(elapsedMs))) {
    lines.push(formatAllTenElapsedMsForShare(Number(elapsedMs)))
  }
  lines.push(solveLine)
  return lines.join('\n')
}
