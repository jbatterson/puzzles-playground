/**
 * Suite session timer: elapsed active play time (tab visible, not on post-win hub CTAs
 * “Next Puzzle” / “All Puzzles”). Persisted bank + optional open segment; finalize merges into
 * suiteElapsedMs. Recording runs regardless of the hub “timer on” display preference.
 */

import { GAME_KEYS } from './gameChrome.js'
import { lsGet, CLUELESS_DIFFS, loadCluelessAttempt } from './hubProgress.js'

function lsSet(key, val) {
  try {
    localStorage.setItem(key, val)
  } catch {
    // ignore
  }
}

function lsRemove(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function suiteTimerStartKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:suiteTimerStart`
}

export function suiteElapsedKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:suiteElapsedMs`
}

function suiteTimerEndKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:suiteTimerEndMs`
}

/** Active-time model: banked ms since last finalize + optional running segment. */
function suiteTimerBankMsKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:suiteTimerBankMs`
}

function suiteTimerResumeAtKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:suiteTimerResumeAt`
}

function suiteTimerActiveModelKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:suiteTimerActiveModel`
}

/** Bitmask of which daily slots (0–2) were complete when end time was last updated. */
function suiteElapsedCompletionMaskKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:suiteElapsedCompletionMask`
}

function isActiveTimeModel(gameKey, dateKey) {
  return lsGet(suiteTimerActiveModelKey(gameKey, dateKey)) === '1'
}

function readBankMs(gameKey, dateKey) {
  const raw = lsGet(suiteTimerBankMsKey(gameKey, dateKey))
  if (raw == null) return 0
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

/** Add open segment [resumeAt, atMs] into bank; clear resume. */
export function flushSuiteTimerOpenSegment(gameKey, dateKey, atMs) {
  if (!gameKey || !dateKey) return
  if (!isActiveTimeModel(gameKey, dateKey)) return
  const rk = suiteTimerResumeAtKey(gameKey, dateKey)
  const raw = lsGet(rk)
  if (raw == null) return
  const t = parseInt(raw, 10)
  lsRemove(rk)
  if (!Number.isFinite(t)) return
  const delta = Math.max(0, atMs - t)
  if (delta === 0) return
  const bk = suiteTimerBankMsKey(gameKey, dateKey)
  lsSet(bk, String(readBankMs(gameKey, dateKey) + delta))
}

function readOpenSegmentMs(gameKey, dateKey, atMs) {
  if (!isActiveTimeModel(gameKey, dateKey)) return 0
  const raw = lsGet(suiteTimerResumeAtKey(gameKey, dateKey))
  if (raw == null) return 0
  const t = parseInt(raw, 10)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, atMs - t)
}

function readLegacyWallElapsedMs(gameKey, dateKey) {
  const sk = lsGet(suiteTimerStartKey(gameKey, dateKey))
  const endRaw = lsGet(suiteTimerEndKey(gameKey, dateKey))
  if (sk != null && endRaw != null) {
    const startMs = parseInt(sk, 10)
    const endMs = parseInt(endRaw, 10)
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) return Math.max(0, endMs - startMs)
  }
  const raw = lsGet(suiteElapsedKey(gameKey, dateKey))
  if (raw == null) return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? Math.max(0, n) : null
}

/** @returns {number} bits 1|2|4 for slots 0,1,2 — matches hub / game storage. */
function readDailySlotCompletionMask(gameKey, dateKey) {
  if (gameKey === GAME_KEYS.CLUELESS) {
    let mask = 0
    for (let i = 0; i < 3; i++) {
      if (loadCluelessAttempt(dateKey, CLUELESS_DIFFS[i]) != null) mask |= 1 << i
    }
    return mask
  }
  let mask = 0
  for (let i = 0; i < 3; i++) {
    const v = lsGet(`${gameKey}:${dateKey}:${i}`)
    if (v === '1' || v === '2') mask |= 1 << i
  }
  return mask
}

/**
 * @param {string} gameKey
 * @param {string} dateKey
 * @param {{ track: boolean, alreadyFullyComplete: boolean }} opts
 */
export function ensureSuiteGameTimerStart(gameKey, dateKey, opts) {
  const { track, alreadyFullyComplete } = opts
  if (!track || !gameKey || !dateKey) return
  if (alreadyFullyComplete) return
  markSuiteTimerActiveTimeModel(gameKey, dateKey)
  const sk = suiteTimerStartKey(gameKey, dateKey)
  if (lsGet(sk)) return
  lsSet(sk, String(Date.now()))
}

/** Enable active-time keys for this game/date (idempotent). */
function markSuiteTimerActiveTimeModel(gameKey, dateKey) {
  if (!gameKey || !dateKey) return
  lsSet(suiteTimerActiveModelKey(gameKey, dateKey), '1')
}

/**
 * Start or stop the open segment from persisted bank based on whether play time should accrue.
 * Call whenever tab visibility or hub-complete CTA pause toggles (and on mount).
 */
export function syncSuiteTimerPlayingState(gameKey, dateKey, shouldCountMs) {
  if (!gameKey || !dateKey) return
  if (!isActiveTimeModel(gameKey, dateKey)) return
  const now = Date.now()
  const rk = suiteTimerResumeAtKey(gameKey, dateKey)
  const hasResume = lsGet(rk) != null
  if (shouldCountMs) {
    if (!hasResume) lsSet(rk, String(now))
    return
  }
  flushSuiteTimerOpenSegment(gameKey, dateKey, now)
}

/**
 * On completion modal open: if at least one daily slot was newly completed since we
 * last recorded an end time, set end = now and elapsed. Active model: committed ek +
 * banked session ms (+ flush open segment).
 */
export function finalizeSuiteGameTimerFromModal(gameKey, dateKey) {
  if (!gameKey || !dateKey) return
  const sk = suiteTimerStartKey(gameKey, dateKey)
  const ek = suiteElapsedKey(gameKey, dateKey)
  const endK = suiteTimerEndKey(gameKey, dateKey)
  const mk = suiteElapsedCompletionMaskKey(gameKey, dateKey)

  const currentMask = readDailySlotCompletionMask(gameKey, dateKey) & 7
  const mkRaw = lsGet(mk)
  const endRaw = lsGet(endK)
  const ekLegacy = lsGet(ek)

  // Old saves: elapsed only, no end/start pair — lock mask once so reopen doesn’t bump end.
  if (mkRaw == null && ekLegacy != null && endRaw == null) {
    lsSet(mk, String(currentMask))
    return
  }

  const prevMask = mkRaw != null ? parseInt(mkRaw, 10) & 7 : 0
  const newSlots = currentMask & ~prevMask
  if (newSlots === 0) return

  const endMs = Date.now()
  let startMs = parseInt(lsGet(sk), 10)
  if (!Number.isFinite(startMs)) {
    if (ekLegacy != null) {
      const prevElapsed = parseInt(ekLegacy, 10)
      startMs = Number.isFinite(prevElapsed) ? endMs - Math.max(0, prevElapsed) : endMs
    } else {
      startMs = endMs
    }
    lsSet(sk, String(startMs))
  }

  let elapsed
  if (isActiveTimeModel(gameKey, dateKey)) {
    flushSuiteTimerOpenSegment(gameKey, dateKey, endMs)
    const bank = readBankMs(gameKey, dateKey)
    const prevCommitted = ekLegacy != null ? parseInt(ekLegacy, 10) : 0
    const baseCommitted = Number.isFinite(prevCommitted) ? Math.max(0, prevCommitted) : 0
    elapsed = Math.max(0, baseCommitted + bank)
    lsSet(suiteTimerBankMsKey(gameKey, dateKey), '0')
    lsRemove(suiteTimerResumeAtKey(gameKey, dateKey))
  } else {
    elapsed = Math.max(0, endMs - startMs)
  }

  lsSet(endK, String(endMs))
  lsSet(ek, String(elapsed))
  lsSet(mk, String(currentMask))
}

/** Raw elapsed from storage. UI and share should hide this when the timer display pref is off (`isSuiteTimerEnabled`). */
export function readSuiteGameElapsedMs(gameKey, dateKey) {
  if (!gameKey || !dateKey) return null
  if (isActiveTimeModel(gameKey, dateKey)) {
    const now = Date.now()
    const committedRaw = lsGet(suiteElapsedKey(gameKey, dateKey))
    const committed = committedRaw != null ? parseInt(committedRaw, 10) : NaN
    const base = Number.isFinite(committed) ? Math.max(0, committed) : 0
    return Math.max(
      0,
      base + readBankMs(gameKey, dateKey) + readOpenSegmentMs(gameKey, dateKey, now)
    )
  }
  return readLegacyWallElapsedMs(gameKey, dateKey)
}

/** Long date line for the puzzle day (PST calendar), e.g. "Wednesday, April 8, 2026". */
export function formatPuzzleDateHeading(dateKey) {
  const parts = String(dateKey).split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dateKey
  const [y, m, d] = parts
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return dt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  })
}
