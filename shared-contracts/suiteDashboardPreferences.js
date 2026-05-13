/**
 * Hub dashboard visibility and per-game Easy/Med/Hard tier set.
 * Versioned JSON in localStorage; games + share + timer read the same shape.
 */

import {
  hubDailySlotStorageKey,
  parseHubDailyPuzzleIndexFromUrl,
  stripHubDailyPuzzleParamFromUrl,
} from './hubEntry.js'
import { GAME_KEYS } from './gameChrome.js'

export const SUITE_DASHBOARD_PREFS_KEY = 'suiteDashboardPreferences'
export const SUITE_DASHBOARD_PREFS_VERSION = 1

/** Fired on `window` after prefs are written (same tab + other tabs via `storage`). */
export const SUITE_PREFS_UPDATED_EVENT = 'suite-prefs-updated'

function dispatchSuitePrefsUpdated() {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(SUITE_PREFS_UPDATED_EVENT))
  } catch {
    // ignore
  }
}

/** Games with three daily slots (hub dice). */
export const THREE_TIER_GAME_KEYS = Object.freeze([
  GAME_KEYS.SUMTILES,
  GAME_KEYS.PRODUCTILES,
  GAME_KEYS.ROLYPOLY,
])

const THREE_TIER_SET = new Set(THREE_TIER_GAME_KEYS)

const ALL_HUB_GAME_KEYS = Object.freeze([...THREE_TIER_GAME_KEYS])

function defaultTierOn() {
  return [true, true, true]
}

function defaultPuzzleOn() {
  /** @type {Record<string, boolean>} */
  const o = {}
  for (const k of ALL_HUB_GAME_KEYS) o[k] = true
  return o
}

function defaultTierOnMap() {
  /** @type {Record<string, [boolean, boolean, boolean]>} */
  const o = {}
  for (const k of THREE_TIER_GAME_KEYS) o[k] = defaultTierOn()
  return o
}

export function createDefaultSuiteDashboardPreferences() {
  return {
    v: SUITE_DASHBOARD_PREFS_VERSION,
    puzzleOn: defaultPuzzleOn(),
    tierOn: defaultTierOnMap(),
    timerOn: true,
  }
}

function lsGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function lsSet(key, val) {
  try {
    localStorage.setItem(key, val)
  } catch {
    // ignore
  }
}

/**
 * @returns {{ v: number, puzzleOn: Record<string, boolean>, tierOn: Record<string, [boolean, boolean, boolean]>, timerOn: boolean }}
 */
export function readSuiteDashboardPreferences() {
  const raw = lsGet(SUITE_DASHBOARD_PREFS_KEY)
  const base = createDefaultSuiteDashboardPreferences()
  if (!raw) return base
  try {
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') return base
    const puzzleOn = {
      ...base.puzzleOn,
      ...(p.puzzleOn && typeof p.puzzleOn === 'object' ? p.puzzleOn : {}),
    }
    const tierOn = { ...base.tierOn }
    if (p.tierOn && typeof p.tierOn === 'object') {
      for (const k of THREE_TIER_GAME_KEYS) {
        if (Array.isArray(p.tierOn[k]) && p.tierOn[k].length === 3) {
          tierOn[k] = [!!p.tierOn[k][0], !!p.tierOn[k][1], !!p.tierOn[k][2]]
        }
      }
    }
    for (const k of ALL_HUB_GAME_KEYS) {
      if (typeof puzzleOn[k] !== 'boolean') puzzleOn[k] = true
    }
    for (const k of THREE_TIER_GAME_KEYS) {
      if (!tierOn[k]) tierOn[k] = defaultTierOn()
      if (!tierOn[k].some(Boolean)) tierOn[k] = defaultTierOn()
    }
    const timerOn = typeof p.timerOn === 'boolean' ? p.timerOn : base.timerOn
    return { v: SUITE_DASHBOARD_PREFS_VERSION, puzzleOn, tierOn, timerOn }
  } catch {
    return base
  }
}

/**
 * Merge partial updates and persist. Enforces at least one tier on per three-tier game.
 * @param {{ puzzleOn?: Record<string, boolean>, tierOn?: Record<string, [boolean, boolean, boolean]>, timerOn?: boolean }} updates
 */
export function writeSuiteDashboardPreferences(updates) {
  const cur = readSuiteDashboardPreferences()
  const next = {
    v: SUITE_DASHBOARD_PREFS_VERSION,
    puzzleOn: { ...cur.puzzleOn, ...(updates.puzzleOn || {}) },
    tierOn: { ...cur.tierOn },
    timerOn: typeof updates.timerOn === 'boolean' ? updates.timerOn : cur.timerOn,
  }
  for (const k of THREE_TIER_GAME_KEYS) {
    if (updates.tierOn && updates.tierOn[k] !== undefined) {
      const arr = updates.tierOn[k]
      next.tierOn[k] =
        Array.isArray(arr) && arr.length === 3 ? [!!arr[0], !!arr[1], !!arr[2]] : [...cur.tierOn[k]]
    } else {
      next.tierOn[k] = [...cur.tierOn[k]]
    }
    if (!next.tierOn[k].some(Boolean)) next.tierOn[k] = defaultTierOn()
  }
  lsSet(SUITE_DASHBOARD_PREFS_KEY, JSON.stringify(next))
  dispatchSuitePrefsUpdated()
}

export function isSuiteTimerEnabled(prefs = readSuiteDashboardPreferences()) {
  return prefs.timerOn !== false
}

/**
 * Turn a tier on/off. Cannot turn off the last enabled tier (returns false).
 */
export function trySetTierEnabled(
  gameKey,
  tierIndex,
  enabled,
  prefs = readSuiteDashboardPreferences()
) {
  if (!isThreeTierGameKey(gameKey) || tierIndex < 0 || tierIndex > 2) return false
  const mask = [...getTierMask(gameKey, prefs)]
  if (!enabled && mask[tierIndex] && mask.filter(Boolean).length <= 1) return false
  mask[tierIndex] = !!enabled
  writeSuiteDashboardPreferences({ tierOn: { [gameKey]: mask } })
  return true
}

export function isThreeTierGameKey(gameKey) {
  return THREE_TIER_SET.has(gameKey)
}

export function isPuzzleOnInSuitePrefs(gameKey, prefs = readSuiteDashboardPreferences()) {
  if (!gameKey) return true
  return prefs.puzzleOn[gameKey] !== false
}

/** @returns {[boolean, boolean, boolean]} */
export function getTierMask(gameKey, prefs = readSuiteDashboardPreferences()) {
  if (!isThreeTierGameKey(gameKey)) return [true, true, true]
  const m = prefs.tierOn[gameKey]
  return m && m.length === 3 ? m : defaultTierOn()
}

/** @returns {number[]} tier indices 0..2 that are enabled */
export function getEnabledTierIndices(gameKey, prefs = readSuiteDashboardPreferences()) {
  const mask = getTierMask(gameKey, prefs)
  return [0, 1, 2].filter((i) => mask[i])
}

export function clampDailyIndexToTierPrefs(gameKey, idx, prefs = readSuiteDashboardPreferences()) {
  const enabled = getEnabledTierIndices(gameKey, prefs)
  if (enabled.length === 0) return 0
  const n = typeof idx === 'number' && Number.isFinite(idx) ? Math.floor(idx) : 0
  if (enabled.includes(n)) return n
  return enabled[0]
}

/**
 * Like `resolveHubDailySlotOnLoad` but clamps to enabled tiers and strips bad `?p=`.
 * @returns {number} 0..2
 */
export function resolveHubDailySlotWithPrefs(
  gameKey,
  dateKey,
  search,
  prefs = readSuiteDashboardPreferences()
) {
  const fromUrl = parseHubDailyPuzzleIndexFromUrl(search)
  const k = hubDailySlotStorageKey(gameKey, dateKey)
  let resolved = 0
  if (fromUrl != null) {
    resolved = clampDailyIndexToTierPrefs(gameKey, fromUrl, prefs)
    try {
      localStorage.setItem(k, String(resolved))
    } catch {
      // ignore
    }
    stripHubDailyPuzzleParamFromUrl()
    return resolved
  }
  try {
    const raw = localStorage.getItem(k)
    if (raw != null) {
      const n = parseInt(raw, 10)
      if (n >= 0 && n <= 2) {
        return clampDailyIndexToTierPrefs(gameKey, n, prefs)
      }
    }
  } catch {
    // ignore
  }
  return clampDailyIndexToTierPrefs(gameKey, 0, prefs)
}

function storageGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function loadMultiCompletions(gameKey, dateKey) {
  return [0, 1, 2].map((i) => ['1', '2'].includes(storageGet(`${gameKey}:${dateKey}:${i}`)))
}

/**
 * Every enabled tier has a completion for this game/date (matches timer + completion modal).
 */
export function isSuiteCompleteForPrefs(gameKey, dateKey, prefs = readSuiteDashboardPreferences()) {
  if (!gameKey || !dateKey) return false
  if (!isThreeTierGameKey(gameKey)) return false
  const enabled = getEnabledTierIndices(gameKey, prefs)
  if (enabled.length === 0) return true
  const completions = loadMultiCompletions(gameKey, dateKey)
  return enabled.every((i) => completions[i])
}

/**
 * First incomplete enabled tier with index !== `fromIdx` (scan 0,1,2 — matches legacy next-puzzle behavior).
 * @returns {number|null}
 */
export function nextIncompleteEnabledTierExcluding(
  gameKey,
  dateKey,
  fromIdx,
  prefs = readSuiteDashboardPreferences()
) {
  const enabled = new Set(getEnabledTierIndices(gameKey, prefs))
  const completions = loadMultiCompletions(gameKey, dateKey)
  for (let i = 0; i < 3; i++) {
    if (!enabled.has(i) || i === fromIdx) continue
    if (!completions[i]) return i
  }
  return null
}

/**
 * First enabled tier index that is incomplete, or first enabled if all done.
 */
export function firstUnfinishedEnabledTierIndex(
  gameKey,
  dateKey,
  prefs = readSuiteDashboardPreferences()
) {
  const enabled = getEnabledTierIndices(gameKey, prefs)
  if (enabled.length === 0) return 0
  const completions = loadMultiCompletions(gameKey, dateKey)
  const first = enabled.find((i) => !completions[i])
  return first !== undefined ? first : enabled[0]
}

/**
 * @param {string} href
 * @param {boolean[]} doneThree length 3
 */
export function hubHrefFirstUnfinishedThreeWithPrefs(
  href,
  doneThree,
  prefs = readSuiteDashboardPreferences()
) {
  const gameKey = hrefToGameKey(href)
  if (!gameKey || !isThreeTierGameKey(gameKey)) {
    return href
  }
  const enabled = getEnabledTierIndices(gameKey, prefs)
  if (!Array.isArray(doneThree) || doneThree.length < 3) return href
  const first = enabled.find((i) => !doneThree[i])
  const idx = first !== undefined ? first : (enabled[0] ?? 0)
  return `${href}${href.includes('?') ? '&' : '?'}p=${idx + 1}`
}

function hrefToGameKey(href) {
  const m = String(href).match(/puzzlegames\/([^/]+)\/?/)
  return m ? m[1] : null
}

/**
 * After completing daily slot `currentIdx`, advance to the next enabled tier in order (e.g. easy+hard → jump over med).
 * If already on the last enabled slot, returns `currentIdx`.
 */
export function nextEnabledDailyIdxAfterWin(
  gameKey,
  currentIdx,
  prefs = readSuiteDashboardPreferences()
) {
  const slots = getEnabledTierIndices(gameKey, prefs)
  const pos = slots.indexOf(currentIdx)
  if (pos >= 0 && pos < slots.length - 1) return slots[pos + 1]
  return currentIdx
}

/**
 * Filter parallel length-3 arrays to enabled tiers only (order preserved).
 * @template T
 * @param {string} gameKey
 * @param {(T|null|undefined)[]} arr
 * @returns {T[]}
 */
export function pickEnabledTierValues(gameKey, arr, prefs = readSuiteDashboardPreferences()) {
  if (!Array.isArray(arr)) return []
  const enabled = getEnabledTierIndices(gameKey, prefs)
  return enabled.map((i) => arr[i])
}
