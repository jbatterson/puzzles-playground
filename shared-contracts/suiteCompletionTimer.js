/**
 * Suite session timer: time spent with an unsolved daily puzzle on screen in a visible,
 * focused window. The hook adds capped per-tick deltas into a persisted bank; finalize
 * merges the bank into suiteElapsedMs. Recording runs regardless of the hub “timer on”
 * display preference.
 */

import { lsGet } from './hubProgress.js'

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

/** Active-time model: ms banked since last finalize. */
export function suiteTimerBankMsKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:suiteTimerBankMs`
}

/** Written by the previous open-segment model; ignored now and cleared when seen. */
function suiteTimerResumeAtKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:suiteTimerResumeAt`
}

export function suiteTimerActiveModelKey(gameKey, dateKey) {
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
  let mask = 0
  for (let i = 0; i < 3; i++) {
    const v = lsGet(`${gameKey}:${dateKey}:${i}`)
    if (v === '1' || v === '2') mask |= 1 << i
  }
  return mask
}

/**
 * Mark this game/date as using the active-time model and record a first-start timestamp
 * (idempotent). Clears any open segment left by the previous timer model.
 */
export function ensureSuiteGameTimerStart(gameKey, dateKey) {
  if (!gameKey || !dateKey) return
  lsSet(suiteTimerActiveModelKey(gameKey, dateKey), '1')
  lsRemove(suiteTimerResumeAtKey(gameKey, dateKey))
  const sk = suiteTimerStartKey(gameKey, dateKey)
  if (lsGet(sk)) return
  lsSet(sk, String(Date.now()))
}

/** Add counted play time to the persisted bank. No-op unless the active-time model is on. */
export function addToSuiteTimerBank(gameKey, dateKey, deltaMs) {
  if (!gameKey || !dateKey) return
  if (!isActiveTimeModel(gameKey, dateKey)) return
  const d = Math.floor(Number(deltaMs))
  if (!Number.isFinite(d) || d <= 0) return
  lsSet(suiteTimerBankMsKey(gameKey, dateKey), String(readBankMs(gameKey, dateKey) + d))
}

/**
 * On completion modal open: if at least one daily slot was newly completed since we
 * last recorded an end time, set end = now and elapsed. Active model: committed ek +
 * banked ms.
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
    const committedRaw = lsGet(suiteElapsedKey(gameKey, dateKey))
    const committed = committedRaw != null ? parseInt(committedRaw, 10) : NaN
    const base = Number.isFinite(committed) ? Math.max(0, committed) : 0
    return base + readBankMs(gameKey, dateKey)
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
