/**
 * Single source of truth for reading per-day game progress from localStorage.
 * Shared by hub display (home.jsx), share plaintext, completion timer, and stats.
 */

/** Safe localStorage accessor — returns null if storage is blocked or unavailable. */
export function lsGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Tier completions for a three-puzzle game ([easy, med, hard]). */
export function loadCompletions(gameKey, dateKey) {
  return [0, 1, 2].map((i) => ['1', '2'].includes(lsGet(`${gameKey}:${dateKey}:${i}`)))
}

/** Tier perfects (first-try) for a three-puzzle game. */
export function loadPerfects(gameKey, dateKey) {
  return [0, 1, 2].map((i) => lsGet(`${gameKey}:${dateKey}:${i}`) === '2')
}

/** Move counts for a tile game; null per slot if not yet recorded. */
export function loadMoveCounts(gameKey, dateKey) {
  return [0, 1, 2].map((i) => {
    const v = lsGet(`${gameKey}:${dateKey}:${i}:moves`)
    if (v == null) return null
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : null
  })
}
