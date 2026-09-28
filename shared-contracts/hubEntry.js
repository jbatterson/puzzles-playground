/**
 * Hub deep-links to the first unfinished daily puzzle (1=easiest … 3=hardest, 4=bonus).
 * Games read `?p=1|2|3|4` and map to index 0..3.
 *
 * Refresh keeps the last-opened slot via `hubDailySlot:{gameKey}:{dateKey}` in localStorage.
 * Hub links still append `?p=` so entering from home picks the lowest-numbered incomplete puzzle.
 */

const HUB_DAILY_SLOT_PREFIX = 'hubDailySlot:'

export function hubDailySlotStorageKey(gameKey, dateKey) {
  return `${HUB_DAILY_SLOT_PREFIX}${gameKey}:${dateKey}`
}

/**
 * @param {string} [search] defaults to `window.location.search` in browser
 * @returns {number | null} 0..3 when `p` is valid; `null` if absent or invalid
 */
export function parseHubDailyPuzzleIndexFromUrl(search) {
  const s = search ?? (typeof window !== 'undefined' ? window.location.search : '')
  try {
    const p = new URLSearchParams(s).get('p')
    if (p == null) return null
    const n = parseInt(p, 10)
    if (n >= 1 && n <= 4) return n - 1
  } catch {
    // ignore
  }
  return null
}

export function stripHubDailyPuzzleParamFromUrl() {
  if (typeof window === 'undefined') return
  const u = new URL(window.location.href)
  if (!u.searchParams.has('p')) return
  u.searchParams.delete('p')
  const q = u.searchParams.toString()
  window.history.replaceState(null, '', u.pathname + (q ? `?${q}` : '') + u.hash)
}

/**
 * @param {string} gameKey from `GAME_KEYS`
 * @param {string} dateKey same string used for that game’s daily saves (e.g. PST calendar key)
 * @param {string} [search] URL search, usually `window.location.search`
 * @returns {number} daily slot index 0..3
 */
export function resolveHubDailySlotOnLoad(gameKey, dateKey, search) {
  const fromUrl = parseHubDailyPuzzleIndexFromUrl(search)
  const k = hubDailySlotStorageKey(gameKey, dateKey)
  if (fromUrl != null) {
    try {
      localStorage.setItem(k, String(fromUrl))
    } catch {
      // ignore quota / private mode
    }
    stripHubDailyPuzzleParamFromUrl()
    return fromUrl
  }
  try {
    const raw = localStorage.getItem(k)
    if (raw != null) {
      const n = parseInt(raw, 10)
      if (n >= 0 && n <= 3) return n
    }
  } catch {
    // ignore
  }
  return 0
}

export function persistHubDailySlot(gameKey, dateKey, idx) {
  if (idx < 0 || idx > 3) return
  try {
    localStorage.setItem(hubDailySlotStorageKey(gameKey, dateKey), String(idx))
  } catch {
    // ignore
  }
}

/** @param {string} [search] defaults to `window.location.search` in browser */
export function parseHubDailyPuzzleParam(search) {
  const v = parseHubDailyPuzzleIndexFromUrl(search)
  return v != null ? v : 0
}

/** @param {boolean[]} doneThree — completion flags for puzzles 1..3 */
export function hubHrefFirstUnfinishedThree(href, doneThree) {
  if (!Array.isArray(doneThree) || doneThree.length < 3) return href
  const first = [0, 1, 2].find((i) => !doneThree[i])
  const idx = first !== undefined ? first : 0
  return `${href}${href.includes('?') ? '&' : '?'}p=${idx + 1}`
}

/** @param {(number|null|undefined)[]} attempts — null/undefined = not finished */
export function hubHrefFirstUnfinishedClueless(href, attempts) {
  if (!Array.isArray(attempts) || attempts.length < 3) return href
  const first = [0, 1, 2].find((i) => attempts[i] == null)
  const idx = first !== undefined ? first : 0
  return `${href}${href.includes('?') ? '&' : '?'}p=${idx + 1}`
}
