/**
 * Canonical daily-puzzle date helpers — single source of truth for Pacific Time date keys.
 * Uses Intl.DateTimeFormat with timeZone: 'America/Los_Angeles' so DST is handled
 * correctly (the hardcoded UTC−8 offset used previously was wrong during PDT).
 */

const PAC_YMD = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const PAC_LABEL = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  month: 'long',
  day: 'numeric',
})

function formatPacificDateKey(date) {
  const dIn =
    date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  try {
    const parts = PAC_YMD.formatToParts(dIn)
    const y = parts.find((p) => p.type === 'year')?.value
    const m = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    if (y != null && m != null && day != null) return `${y}-${m}-${day}`
  } catch {
    // Intl / formatToParts can fail in edge environments; avoid blank hub from thrown render.
  }
  // Degraded: UTC calendar day (not Pacific). Wrong within ~hours of PT midnight, but stable string.
  return dIn.toISOString().slice(0, 10)
}

/** Today's daily-puzzle date key in Pacific Time ("YYYY-MM-DD"). */
export function getDailyKey() {
  return formatPacificDateKey(new Date())
}

/**
 * Date key offset from today in Pacific Time.
 * @param {number} dayOffset 0 = today, 1 = yesterday, …
 */
export function getDateKey(dayOffset) {
  const d = new Date()
  d.setDate(d.getDate() - dayOffset)
  return formatPacificDateKey(d)
}

/** Days since epoch (2020-01-01 UTC) for a YYYY-MM-DD key. Pure calendar math — no timezone. */
export function getDayIndex(key) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const epoch = new Date(Date.UTC(2020, 0, 1))
  return Math.floor((date - epoch) / 86400000)
}

const YMD_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Human-readable date in Pacific Time, e.g. "April 9".
 * Pass a YYYY-MM-DD `dateKey` to format a specific puzzle day (safe for long-lived tabs).
 * Called without arguments falls back to the current wall-clock date.
 * Non-YYYY-MM-DD keys (e.g. curate scope `"curate"`) fall back to today so Intl never sees an invalid Date.
 * @param {string} [dateKey]
 */
export function getDateLabel(dateKey) {
  if (!dateKey) return PAC_LABEL.format(new Date())
  const m = String(dateKey).match(YMD_KEY)
  if (!m) return PAC_LABEL.format(new Date())
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  // Noon UTC ensures the date is the same calendar day in Pacific time.
  const inst = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
  if (!Number.isFinite(inst.getTime())) return PAC_LABEL.format(new Date())
  return PAC_LABEL.format(inst)
}

/**
 * Count consecutive days with a qualifying completion, working backward from today.
 * Includes today when hasCompletion(todayKey) is true; otherwise starts from yesterday.
 * This handles the "today counts if you've already played" streak display rule.
 *
 * @param {(dateKey: string) => boolean} hasCompletion - return true if that Pacific-date key has a completion
 * @param {number} [maxDays] - how far back to search (default 365)
 * @returns {number}
 */
export function computeStreak(hasCompletion, maxDays = 365) {
  const hasToday = hasCompletion(getDateKey(0))
  const startOffset = hasToday ? 0 : 1
  let count = 0
  for (let dayOffset = startOffset; dayOffset <= maxDays; dayOffset++) {
    if (hasCompletion(getDateKey(dayOffset))) count++
    else break
  }
  return count
}
