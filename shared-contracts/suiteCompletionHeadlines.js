/**
 * Suite win-modal reward headlines. Games with a 7-phrase list rotate by
 * Pacific calendar weekday of `dateKey` (Sun=0 … Sat=6).
 */

import { GAME_KEYS, getGameChrome } from './gameChrome.js'

const YMD_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

/** @type {Readonly<Record<string, readonly string[]>>} */
export const SUITE_COMPLETION_HEADLINES = Object.freeze({
  [GAME_KEYS.SUMTILES]: Object.freeze(['AWE-SUM!']),
  [GAME_KEYS.PRODUCTILES]: Object.freeze(['PRODUCTIVE!']),
  [GAME_KEYS.DUNGBEETLE]: Object.freeze([
    'You Dung Good!',
    "What's Done is Dung!",
    'Nicely Dung!',
    'Job Well Dung!',
    "You've Dung it Again!",
    'Easier Said Than Dung!',
    'Consider It Dung!',
  ]),
  [GAME_KEYS.ROLYPOLY]: Object.freeze([
    'On a Roll!',
    'Roll Model!',
    "We See You Rollin'!",
    'Honor Roll!',
    'Roll On!',
    'Roll With It!',
    "Rock 'n' Roll!",
  ]),
})

/**
 * Weekday index for a YYYY-MM-DD key: 0 = Sunday … 6 = Saturday (UTC noon → stable calendar day).
 * @param {string} [dateKey]
 * @returns {number}
 */
export function weekdayIndexSun0(dateKey) {
  const m = String(dateKey || '').match(YMD_KEY)
  if (!m) return 0
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const inst = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
  if (!Number.isFinite(inst.getTime())) return 0
  return inst.getUTCDay()
}

/**
 * Reward headline for the suite completion modal.
 * @param {string} gameKey
 * @param {string} [dateKey] Pacific YYYY-MM-DD for weekday rotation
 */
export function getSuiteCompletionHeadline(gameKey, dateKey) {
  const list = SUITE_COMPLETION_HEADLINES[gameKey]
  if (list?.length) {
    return list[weekdayIndexSun0(dateKey) % list.length]
  }
  const title = getGameChrome(gameKey)?.title
  return title ? `${title.toUpperCase()}!` : 'Nice!'
}
