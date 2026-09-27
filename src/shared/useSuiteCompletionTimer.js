import { useEffect, useState } from 'react'
import {
  addToSuiteTimerBank,
  ensureSuiteGameTimerStart,
} from '@shared-contracts/suiteCompletionTimer.js'

const TICK_MS = 1000
/** Caps each banked delta so sleep, frozen tabs, or missed blur events can’t add large gaps. */
const MAX_TICK_DELTA_MS = 2000

function isPageAttended() {
  if (typeof document === 'undefined') return false
  return document.visibilityState === 'visible' && document.hasFocus()
}

/**
 * Persisted suite timer: counts only while an unsolved daily puzzle is on screen and the
 * window is visible and focused.
 * @param {string} gameKey
 * @param {string} dateKey
 * @param {{ countingUnsolvedPuzzle: boolean }} opts — true when today’s current daily tier is
 *   neither recorded complete nor in a solved board state (and not curate / yesterday practice).
 */
export default function useSuiteCompletionTimer(gameKey, dateKey, opts) {
  const { countingUnsolvedPuzzle } = opts
  const [attended, setAttended] = useState(isPageAttended)

  useEffect(() => {
    const update = () => setAttended(isPageAttended())
    window.addEventListener('focus', update)
    window.addEventListener('blur', update)
    window.addEventListener('pageshow', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', update)
      window.removeEventListener('pageshow', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  const counting = !!countingUnsolvedPuzzle && attended

  useEffect(() => {
    if (!counting) return
    ensureSuiteGameTimerStart(gameKey, dateKey)
    let last = Date.now()
    const bankSinceLast = () => {
      const now = Date.now()
      const delta = Math.min(Math.max(0, now - last), MAX_TICK_DELTA_MS)
      last = now
      addToSuiteTimerBank(gameKey, dateKey, delta)
    }
    const id = window.setInterval(() => {
      if (isPageAttended()) bankSinceLast()
      else last = Date.now()
    }, TICK_MS)
    return () => {
      window.clearInterval(id)
      bankSinceLast()
    }
  }, [counting, gameKey, dateKey])
}
