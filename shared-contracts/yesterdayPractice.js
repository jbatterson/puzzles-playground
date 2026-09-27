/**
 * Yesterday-practice mode: replay prior Pacific daily boards without touching
 * official daily stats / streak / timer keys.
 *
 * Progress is stored under `{gameKey}:practice:{YYYY-MM-DD}:{slot}` so the
 * usual `YYYY-MM-DD` stats scanners never count it.
 */

import { getDateKey } from './dailyPuzzleDate.js'

const YMD_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Uppercase month abbreviations (SEPT not SEP). */
const SHORT_MONTHS = Object.freeze([
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEPT',
  'OCT',
  'NOV',
  'DEC',
])

/**
 * Storage dateKey segment for practice progress for a calendar day.
 * @param {string} calendarDateKey YYYY-MM-DD
 * @returns {string} e.g. "practice:2026-09-24"
 */
export function toPracticeStorageDateKey(calendarDateKey) {
  return `practice:${calendarDateKey}`
}

/** Pacific calendar key for yesterday's daily puzzles. */
export function getYesterdayCalendarKey() {
  return getDateKey(1)
}

/**
 * Short nav label, e.g. "SEPT 23".
 * @param {string} dateKey YYYY-MM-DD
 */
export function getShortMonthDayLabel(dateKey) {
  const m = String(dateKey || '').match(YMD_KEY)
  if (!m) return ''
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(mo) || mo < 1 || mo > 12 || !Number.isFinite(d)) return ''
  return `${SHORT_MONTHS[mo - 1]} ${d}`
}

/**
 * In-game date line while viewing yesterday's puzzles, e.g. "SEPT 23 (YESTERDAY)".
 * @param {string} [calendarDateKey] defaults to Pacific yesterday
 */
export function getYesterdayNavDateLabel(calendarDateKey = getYesterdayCalendarKey()) {
  const short = getShortMonthDayLabel(calendarDateKey)
  return short ? `${short} (YESTERDAY)` : 'YESTERDAY'
}
