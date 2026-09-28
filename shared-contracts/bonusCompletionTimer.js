/**
 * Separate active-time timer for the bonus daily slot (Roly / Dung).
 * Same attend/focus banking model as the suite timer; never merges into suiteElapsedMs.
 */

import { lsGet } from './hubProgress.js'
import { BONUS_SLOT } from './bonusPuzzle.js'

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

export function bonusTimerStartKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:bonusTimerStart`
}

export function bonusElapsedKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:bonusElapsedMs`
}

function bonusTimerEndKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:bonusTimerEndMs`
}

export function bonusTimerBankMsKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:bonusTimerBankMs`
}

export function bonusTimerActiveModelKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:bonusTimerActiveModel`
}

function bonusElapsedFinalizedKey(gameKey, dateKey) {
  return `${gameKey}:${dateKey}:bonusElapsedFinalized`
}

function isActiveTimeModel(gameKey, dateKey) {
  return lsGet(bonusTimerActiveModelKey(gameKey, dateKey)) === '1'
}

function readBankMs(gameKey, dateKey) {
  const raw = lsGet(bonusTimerBankMsKey(gameKey, dateKey))
  if (raw == null) return 0
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function isBonusSlotComplete(gameKey, dateKey) {
  const v = lsGet(`${gameKey}:${dateKey}:${BONUS_SLOT}`)
  return v === '1' || v === '2'
}

export function ensureBonusGameTimerStart(gameKey, dateKey) {
  if (!gameKey || !dateKey) return
  lsSet(bonusTimerActiveModelKey(gameKey, dateKey), '1')
  const sk = bonusTimerStartKey(gameKey, dateKey)
  if (lsGet(sk)) return
  lsSet(sk, String(Date.now()))
}

export function addToBonusTimerBank(gameKey, dateKey, deltaMs) {
  if (!gameKey || !dateKey) return
  if (!isActiveTimeModel(gameKey, dateKey)) return
  const d = Math.floor(Number(deltaMs))
  if (!Number.isFinite(d) || d <= 0) return
  lsSet(bonusTimerBankMsKey(gameKey, dateKey), String(readBankMs(gameKey, dateKey) + d))
}

/**
 * Commit banked bonus time when the bonus slot is newly complete.
 * Idempotent after first finalize for a completed bonus.
 */
export function finalizeBonusGameTimer(gameKey, dateKey) {
  if (!gameKey || !dateKey) return
  if (!isBonusSlotComplete(gameKey, dateKey)) return
  const fk = bonusElapsedFinalizedKey(gameKey, dateKey)
  if (lsGet(fk) === '1') return

  const sk = bonusTimerStartKey(gameKey, dateKey)
  const ek = bonusElapsedKey(gameKey, dateKey)
  const endK = bonusTimerEndKey(gameKey, dateKey)
  const endMs = Date.now()

  let startMs = parseInt(lsGet(sk), 10)
  if (!Number.isFinite(startMs)) {
    startMs = endMs
    lsSet(sk, String(startMs))
  }

  const bank = readBankMs(gameKey, dateKey)
  const prevCommitted = lsGet(ek) != null ? parseInt(lsGet(ek), 10) : 0
  const baseCommitted = Number.isFinite(prevCommitted) ? Math.max(0, prevCommitted) : 0
  const elapsed = Math.max(0, baseCommitted + bank)

  lsSet(bonusTimerBankMsKey(gameKey, dateKey), '0')
  lsSet(endK, String(endMs))
  lsSet(ek, String(elapsed))
  lsSet(fk, '1')
}

/** Raw bonus elapsed ms (committed + open bank). Hide in UI when suite timer pref is off. */
export function readBonusGameElapsedMs(gameKey, dateKey) {
  if (!gameKey || !dateKey) return null
  if (!isActiveTimeModel(gameKey, dateKey) && lsGet(bonusElapsedKey(gameKey, dateKey)) == null) {
    return null
  }
  const committedRaw = lsGet(bonusElapsedKey(gameKey, dateKey))
  const committed = committedRaw != null ? parseInt(committedRaw, 10) : NaN
  const base = Number.isFinite(committed) ? Math.max(0, committed) : 0
  if (lsGet(bonusElapsedFinalizedKey(gameKey, dateKey)) === '1') return base
  return base + readBankMs(gameKey, dateKey)
}
