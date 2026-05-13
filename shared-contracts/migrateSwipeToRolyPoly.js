/**
 * One-time browser migration: legacy game slug `swipe` → `rolypoly`.
 * Idempotent via `rolypoly:migratedFromSwipe:v1` in localStorage.
 */

import { SUITE_DASHBOARD_PREFS_KEY } from './suiteDashboardPreferences.js'

const SENTINEL = 'rolypoly:migratedFromSwipe:v1'
const LEGACY_GAME_PREFIX = 'swipe:'
const NEW_GAME_PREFIX = 'rolypoly:'
const LEGACY_HUB_SLOT_PREFIX = 'hubDailySlot:swipe:'
const NEW_HUB_SLOT_PREFIX = 'hubDailySlot:rolypoly:'
const TUTORIAL_RESUME_LEGACY = 'puzzle:tutorialResume:swipe'
const TUTORIAL_RESUME_NEW = 'puzzle:tutorialResume:rolypoly'

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

function migrateSuiteDashboardPreferences() {
  const raw = lsGet(SUITE_DASHBOARD_PREFS_KEY)
  if (!raw) return
  let p
  try {
    p = JSON.parse(raw)
  } catch {
    return
  }
  if (!p || typeof p !== 'object') return
  let changed = false

  if (p.puzzleOn && typeof p.puzzleOn === 'object' && 'swipe' in p.puzzleOn) {
    if (typeof p.puzzleOn.rolypoly !== 'boolean') {
      p.puzzleOn.rolypoly = p.puzzleOn.swipe
    }
    delete p.puzzleOn.swipe
    changed = true
  }

  if (p.tierOn && typeof p.tierOn === 'object' && 'swipe' in p.tierOn) {
    const leg = p.tierOn.swipe
    if (Array.isArray(leg) && leg.length === 3) {
      const cur = p.tierOn.rolypoly
      if (!Array.isArray(cur) || cur.length !== 3) {
        p.tierOn.rolypoly = [...leg]
      }
    }
    delete p.tierOn.swipe
    changed = true
  }

  if (changed) {
    try {
      localStorage.setItem(SUITE_DASHBOARD_PREFS_KEY, JSON.stringify(p))
    } catch {
      // ignore
    }
  }
}

/**
 * Copy legacy `swipe` storage to `rolypoly` once. Safe to call from hub and game entry.
 */
export function migrateSwipeToRolyPoly() {
  if (typeof window === 'undefined') return
  try {
    if (lsGet(SENTINEL) === '1') return
  } catch {
    return
  }

  try {
    const seen = new Set()
    const toCopy = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || seen.has(k)) continue
      if (k === SENTINEL) continue
      if (k.startsWith(LEGACY_GAME_PREFIX) || k.startsWith(LEGACY_HUB_SLOT_PREFIX)) {
        seen.add(k)
        toCopy.push(k)
      }
    }
    for (const oldKey of toCopy) {
      const newKey = oldKey.startsWith(LEGACY_HUB_SLOT_PREFIX)
        ? NEW_HUB_SLOT_PREFIX + oldKey.slice(LEGACY_HUB_SLOT_PREFIX.length)
        : NEW_GAME_PREFIX + oldKey.slice(LEGACY_GAME_PREFIX.length)
      if (lsGet(newKey) != null) continue
      const v = lsGet(oldKey)
      if (v != null) lsSet(newKey, v)
    }

    migrateSuiteDashboardPreferences()

    if (typeof sessionStorage !== 'undefined') {
      try {
        if (sessionStorage.getItem(TUTORIAL_RESUME_NEW) == null) {
          const leg = sessionStorage.getItem(TUTORIAL_RESUME_LEGACY)
          if (leg != null) sessionStorage.setItem(TUTORIAL_RESUME_NEW, leg)
        }
      } catch {
        // ignore
      }
    }

    lsSet(SENTINEL, '1')
  } catch {
    try {
      lsSet(SENTINEL, '1')
    } catch {
      // ignore
    }
  }
}
