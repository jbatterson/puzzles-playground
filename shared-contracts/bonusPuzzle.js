/**
 * Optional 4th “bonus” daily slot for Roly Poly / Dung Beetle.
 * Unlock requires stars (storage `'2'`) on Easy, Med, and Hard — ignores dashboard tier prefs.
 */

import { GAME_KEYS } from './gameChrome.js'
import { lsGet } from './hubProgress.js'

/** Daily puzzle index for the bonus slot (Easy=0 … Hard=2, Bonus=3). */
export const BONUS_SLOT = 3

const BONUS_GAME_KEY_SET = new Set([GAME_KEYS.ROLYPOLY, GAME_KEYS.DUNGBEETLE])

/** Games that can offer a daily bonus puzzle. */
export function hasBonusPuzzleSupport(gameKey) {
  return BONUS_GAME_KEY_SET.has(gameKey)
}

/**
 * True when Easy, Med, and Hard are all starred for this game/date (indices 0–2).
 * Does not consult suite dashboard tier preferences.
 */
export function isBonusUnlocked(gameKey, dateKey) {
  if (!hasBonusPuzzleSupport(gameKey) || !dateKey) return false
  for (let i = 0; i < 3; i++) {
    if (lsGet(`${gameKey}:${dateKey}:${i}`) !== '2') return false
  }
  return true
}

/** Whether the bonus slot is marked complete (`'1'` or `'2'`). */
export function isBonusComplete(gameKey, dateKey) {
  if (!hasBonusPuzzleSupport(gameKey) || !dateKey) return false
  return ['1', '2'].includes(lsGet(`${gameKey}:${dateKey}:${BONUS_SLOT}`))
}

/** Whether the bonus slot is starred. */
export function isBonusPerfect(gameKey, dateKey) {
  if (!hasBonusPuzzleSupport(gameKey) || !dateKey) return false
  return lsGet(`${gameKey}:${dateKey}:${BONUS_SLOT}`) === '2'
}

/** Move/push count for the bonus slot, or null. */
export function loadBonusMoveCount(gameKey, dateKey) {
  if (!hasBonusPuzzleSupport(gameKey) || !dateKey) return null
  const v = lsGet(`${gameKey}:${dateKey}:${BONUS_SLOT}:moves`)
  if (v == null) return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}
