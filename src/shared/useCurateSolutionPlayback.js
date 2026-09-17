import { useCallback, useEffect, useRef, useState } from 'react'
import { SOLUTION_PLAYBACK_MS, dirFromSolutionChar } from './tetrominoSolutionDirs.js'

/**
 * Curate-mode Play / Pause for a stored solution string.
 *
 * - Play enabled at initial board, or while paused mid-solution.
 * - While playing, the control shows Pause.
 * - Manual interaction (move / undo) calls `noteManualInteraction` → gray Play until reset to initial.
 *
 * @param {object} opts
 * @param {boolean} opts.active — curate mode on
 * @param {string} [opts.solution]
 * @param {string|number} opts.resetKey — puzzle identity; clears playback on change
 * @param {boolean} opts.isInitial — history empty / pristine board
 * @param {(dr: number, dc: number) => { ok: boolean, done?: boolean }} opts.onStep
 *   Apply one solution step using refs so sequential ticks see fresh state.
 * @param {number} [opts.intervalMs] — step cadence (default SOLUTION_PLAYBACK_MS)
 */
export function useCurateSolutionPlayback({
  active,
  solution,
  resetKey,
  isInitial,
  onStep,
  intervalMs = SOLUTION_PLAYBACK_MS,
}) {
  const [status, setStatus] = useState('off') // 'off' | 'playing' | 'paused'
  const statusRef = useRef(status)
  statusRef.current = status

  const stepRef = useRef(0)
  const timerRef = useRef(null)
  const onStepRef = useRef(onStep)
  onStepRef.current = onStep
  const solutionRef = useRef(solution || '')
  solutionRef.current = typeof solution === 'string' ? solution : ''
  const intervalRef = useRef(intervalMs)
  intervalRef.current = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : SOLUTION_PLAYBACK_MS

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopSession = useCallback(() => {
    clearTimer()
    setStatus('off')
    stepRef.current = 0
  }, [clearTimer])

  /** Manual board interaction ends the playback session (Play goes inactive until initial). */
  const noteManualInteraction = useCallback(() => {
    if (statusRef.current === 'off') return
    clearTimer()
    setStatus('off')
    stepRef.current = 0
  }, [clearTimer])

  const tick = useCallback(() => {
    const sol = solutionRef.current
    const i = stepRef.current
    if (!sol || i >= sol.length) {
      clearTimer()
      setStatus('off')
      stepRef.current = 0
      return
    }
    const pair = dirFromSolutionChar(sol[i])
    if (!pair) {
      clearTimer()
      setStatus('off')
      stepRef.current = 0
      return
    }
    const [dr, dc] = pair
    const result = onStepRef.current(dr, dc)
    if (!result?.ok) {
      clearTimer()
      setStatus('off')
      stepRef.current = 0
      return
    }
    stepRef.current = i + 1
    if (result.done || stepRef.current >= sol.length) {
      clearTimer()
      setStatus('off')
      stepRef.current = 0
    }
  }, [clearTimer])

  const startTimer = useCallback(() => {
    clearTimer()
    timerRef.current = window.setInterval(tick, intervalRef.current)
  }, [clearTimer, tick])

  const togglePlayback = useCallback(() => {
    if (!active || !solutionRef.current) return

    if (statusRef.current === 'playing') {
      clearTimer()
      setStatus('paused')
      return
    }

    if (statusRef.current === 'paused') {
      setStatus('playing')
      startTimer()
      return
    }

    // off → play only from initial
    if (!isInitial) return
    stepRef.current = 0
    setStatus('playing')
    // First step after a short beat so Play click feels intentional
    startTimer()
  }, [active, isInitial, clearTimer, startTimer])

  useEffect(() => {
    stopSession()
  }, [resetKey, stopSession])

  useEffect(() => {
    if (!active) stopSession()
  }, [active, stopSession])

  useEffect(() => () => clearTimer(), [clearTimer])

  // Returning to initial (Reset) while off keeps Play available; clear any stale step.
  useEffect(() => {
    if (isInitial && status === 'off') stepRef.current = 0
  }, [isInitial, status])

  const hasSolution = solutionRef.current.length > 0
  const playbackButtonEnabled =
    active &&
    hasSolution &&
    (status === 'playing' || status === 'paused' || (status === 'off' && isInitial))

  const playbackButtonLabel = status === 'playing' ? 'Pause' : 'Play'

  return {
    playbackStatus: status,
    playbackButtonLabel,
    playbackButtonEnabled,
    togglePlayback,
    noteManualInteraction,
    stopPlayback: stopSession,
  }
}
