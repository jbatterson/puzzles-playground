import { useEffect, useState } from 'react'
import {
  addToBonusTimerBank,
  ensureBonusGameTimerStart,
} from '@shared-contracts/bonusCompletionTimer.js'

const TICK_MS = 1000
const MAX_TICK_DELTA_MS = 2000

function isPageAttended() {
  if (typeof document === 'undefined') return false
  return document.visibilityState === 'visible' && document.hasFocus()
}

/**
 * Active-time bonus timer while an unsolved bonus puzzle is on screen.
 * @param {string} gameKey
 * @param {string} dateKey — official daily key (not practice)
 * @param {{ countingUnsolvedBonus: boolean }} opts
 */
export default function useBonusCompletionTimer(gameKey, dateKey, opts) {
  const { countingUnsolvedBonus } = opts
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

  const counting = !!countingUnsolvedBonus && attended

  useEffect(() => {
    if (!counting) return
    ensureBonusGameTimerStart(gameKey, dateKey)
    let last = Date.now()
    const bankSinceLast = () => {
      const now = Date.now()
      const delta = Math.min(Math.max(0, now - last), MAX_TICK_DELTA_MS)
      last = now
      addToBonusTimerBank(gameKey, dateKey, delta)
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
