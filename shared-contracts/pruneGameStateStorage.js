/**
 * Drop stale mid-puzzle resume blobs (`:gameState`) from localStorage.
 * Keeps today's Pacific daily keys (and non-dated scopes like `curate`).
 * Does not touch completion, moves, timer, or prefs keys — stats stay intact.
 */

import { getDailyKey } from './dailyPuzzleDate.js'
import { GAME_KEYS } from './gameChrome.js'

const SUITE_GAME_KEYS = Object.freeze(Object.values(GAME_KEYS))
const YMD = /^\d{4}-\d{2}-\d{2}$/
const PRACTICE_YMD = /^practice:(\d{4}-\d{2}-\d{2})$/

function lsRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/**
 * @param {string} key
 * @param {string} keepDateKey YYYY-MM-DD to retain
 * @param {readonly string[]} [gameKeys]
 * @returns {boolean} true if this key should be deleted
 */
export function isStaleGameStateKey(key, keepDateKey, gameKeys = SUITE_GAME_KEYS) {
  if (!key || typeof key !== 'string' || !key.endsWith(':gameState')) return false
  for (const gameKey of gameKeys) {
    const prefix = `${gameKey}:`
    if (!key.startsWith(prefix)) continue
    // `{game}:{dateOrScope}:{slot}:gameState`
    const mid = key.slice(prefix.length, -':gameState'.length)
    const lastColon = mid.lastIndexOf(':')
    if (lastColon < 0) return false
    const dateOrScope = mid.slice(0, lastColon)
    if (dateOrScope === keepDateKey) return false
    if (dateOrScope === `practice:${keepDateKey}`) return false
    if (YMD.test(dateOrScope)) return true
    const practice = dateOrScope.match(PRACTICE_YMD)
    if (practice) return true
    // Non-dated scopes (e.g. curate): keep
    return false
  }
  return false
}

/**
 * Remove suite `:gameState` keys that are not for `keepDateKey` (default: Pacific today).
 * @param {{ keepDateKey?: string, gameKeys?: readonly string[] }} [opts]
 * @returns {number} count of keys removed
 */
export function pruneStaleGameStateStorage(opts = {}) {
  const keepDateKey = opts.keepDateKey || getDailyKey()
  const gameKeys = opts.gameKeys || SUITE_GAME_KEYS
  const toRemove = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && isStaleGameStateKey(k, keepDateKey, gameKeys)) toRemove.push(k)
    }
  } catch {
    return 0
  }
  for (const k of toRemove) lsRemove(k)
  return toRemove.length
}
