/**
 * Aggregate PLAYED / STREAK / STARS for suite games that store progress in localStorage.
 * Logic mirrors `src/home.jsx` streak and completion rules.
 */

import { GAME_KEYS } from './gameChrome.js'
import { computeStreak } from './dailyPuzzleDate.js'
import { lsGet, CLUELESS_DIFFS, loadCluelessAttempt, loadCluelessAttempts } from './hubProgress.js'
import {
  getEnabledTierIndices,
  isSuiteCompleteForPrefs,
  isThreeTierGameKey,
} from './suiteDashboardPreferences.js'

const MAX_STREAK_DAYS = 365

function dayHasMultiCompletion(gameKey, dateKey) {
  if (isThreeTierGameKey(gameKey)) return isSuiteCompleteForPrefs(gameKey, dateKey)
  for (let i = 0; i < 3; i++) {
    const v = lsGet(`${gameKey}:${dateKey}:${i}`)
    if (v === '1' || v === '2') return true
  }
  return false
}

function dayHasCluelessCompletion(dateKey) {
  return isSuiteCompleteForPrefs(GAME_KEYS.CLUELESS, dateKey)
}

function dayHasCompletion(gameKey, dateKey) {
  if (gameKey === GAME_KEYS.CLUELESS) return dayHasCluelessCompletion(dateKey)
  return dayHasMultiCompletion(gameKey, dateKey)
}

function getStreak(gameKey) {
  return computeStreak((dateKey) => dayHasCompletion(gameKey, dateKey), MAX_STREAK_DAYS)
}

function aggregateMultiGameFromStorage(gameKey) {
  const dates = new Set()
  let stars = 0
  const escaped = gameKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escaped}:(\\d{4}-\\d{2}-\\d{2}):([0-2])$`)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      const m = k.match(re)
      if (!m) continue
      dates.add(m[1])
    }
  } catch {
    // ignore
  }
  let played = 0
  for (const date of dates) {
    if (!isSuiteCompleteForPrefs(gameKey, date)) continue
    played++
    const enabled = getEnabledTierIndices(gameKey)
    for (const ti of enabled) {
      const v = lsGet(`${gameKey}:${date}:${ti}`)
      if (v === '2') stars++
    }
  }
  return { played, stars }
}

function aggregateTileMovesFromStorage(gameKey) {
  const dates = new Set()
  const totals = [0, 0, 0]
  const counts = [0, 0, 0]
  const escaped = gameKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escaped}:(\\d{4}-\\d{2}-\\d{2}):([0-2]):moves$`)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      const m = k.match(re)
      if (!m) continue
      const date = m[1]
      const idxStr = m[2]
      const idx = parseInt(idxStr, 10)
      const v = lsGet(k)
      if (v == null) continue
      const moves = parseInt(v, 10)
      if (!Number.isFinite(moves) || moves <= 0) continue
      if (idx < 0 || idx > 2) continue
      dates.add(date)
      totals[idx] += moves
      counts[idx] += 1
    }
  } catch {
    // ignore
  }
  let played = 0
  for (const date of dates) {
    if (isSuiteCompleteForPrefs(gameKey, date)) played++
  }
  const enabled = new Set(getEnabledTierIndices(gameKey))
  const parts = totals.map((sum, i) => {
    if (!enabled.has(i)) return '–'
    const c = counts[i]
    if (!c) return '–'
    return String(Math.round(sum / c))
  })
  return {
    played,
    avgMoves: parts.join('|'),
  }
}

function collectCluelessDateKeysFromStorage() {
  const dates = new Set()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('clueless:')) continue
      const m = k.match(/^clueless:(\d{4}-\d{2}-\d{2})/)
      if (m) dates.add(m[1])
    }
  } catch {
    // ignore
  }
  return dates
}

function aggregateCluelessFromStorage() {
  const dates = collectCluelessDateKeysFromStorage()
  let played = 0
  let stars = 0
  for (const dateKey of dates) {
    if (!isSuiteCompleteForPrefs(GAME_KEYS.CLUELESS, dateKey)) continue
    played++
    const attempts = loadCluelessAttempts(dateKey)
    const enabled = getEnabledTierIndices(GAME_KEYS.CLUELESS)
    for (const i of enabled) {
      if (attempts[i] === 1) stars++
    }
  }
  return { played, stars }
}

/**
 * @param {string} gameKey One of `GAME_KEYS` for suite games.
 * @returns {{ played: number, streak: number, stars: number, avgMoves?: string }}
 */
export function computeSimpleGameStats(gameKey) {
  if (gameKey === GAME_KEYS.CLUELESS) {
    const { played, stars } = aggregateCluelessFromStorage()
    return { played, streak: getStreak(gameKey), stars }
  }
  if (
    gameKey === GAME_KEYS.SCURRY ||
    gameKey === GAME_KEYS.FOLDS ||
    gameKey === GAME_KEYS.HONEYCOMBS
  ) {
    const { played, stars } = aggregateMultiGameFromStorage(gameKey)
    return { played, streak: getStreak(gameKey), stars }
  }
  if (gameKey === GAME_KEYS.SUMTILES || gameKey === GAME_KEYS.PRODUCTILES) {
    const { played, stars } = aggregateMultiGameFromStorage(gameKey)
    const { avgMoves } = aggregateTileMovesFromStorage(gameKey)
    return { played, streak: getStreak(gameKey), stars, avgMoves }
  }
  return { played: 0, streak: 0, stars: 0 }
}
