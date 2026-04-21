import { useEffect, useState } from 'react'
import {
  ensureSuiteGameTimerStart,
  flushSuiteTimerOpenSegment,
  syncSuiteTimerPlayingState,
} from '@shared-contracts/suiteCompletionTimer.js'

/**
 * Persisted suite timer: counts only while the tab is visible and the player is not on
 * a post-win hub CTA (“Next Puzzle” or “All Puzzles”).
 * @param {string} gameKey
 * @param {string} dateKey
 * @param {{ track: boolean, alreadyFullyComplete: boolean, pauseForHubCompleteCta?: boolean }} opts
 */
export default function useSuiteCompletionTimer(gameKey, dateKey, opts) {
  const { track, alreadyFullyComplete, pauseForHubCompleteCta = false } = opts
  const [tabVisible, setTabVisible] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'visible'
  )

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    ensureSuiteGameTimerStart(gameKey, dateKey, { track, alreadyFullyComplete })
  }, [gameKey, dateKey, track, alreadyFullyComplete])

  const shouldCountMs = track && !alreadyFullyComplete && tabVisible && !pauseForHubCompleteCta

  useEffect(() => {
    if (!track || alreadyFullyComplete) return
    syncSuiteTimerPlayingState(gameKey, dateKey, shouldCountMs)
    return () => {
      flushSuiteTimerOpenSegment(gameKey, dateKey, Date.now())
    }
  }, [gameKey, dateKey, track, alreadyFullyComplete, shouldCountMs])
}
