import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  addToSuiteTimerBank,
  ensureSuiteGameTimerStart,
  finalizeSuiteGameTimerFromModal,
  readSuiteGameElapsedMs,
  suiteElapsedKey,
  suiteTimerActiveModelKey,
  suiteTimerBankMsKey,
  suiteTimerStartKey,
} from '../suiteCompletionTimer.js'

const GAME = 'dungbeetle'
const DATE = '2026-09-27'
const resumeAtKey = `${GAME}:${DATE}:suiteTimerResumeAt`

function completeSlot(i) {
  localStorage.setItem(`${GAME}:${DATE}:${i}`, '1')
}

describe('suite completion timer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-27T16:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ensureSuiteGameTimerStart enables the active model and records start once', () => {
    ensureSuiteGameTimerStart(GAME, DATE)
    const first = localStorage.getItem(suiteTimerStartKey(GAME, DATE))
    expect(localStorage.getItem(suiteTimerActiveModelKey(GAME, DATE))).toBe('1')
    vi.advanceTimersByTime(60_000)
    ensureSuiteGameTimerStart(GAME, DATE)
    expect(localStorage.getItem(suiteTimerStartKey(GAME, DATE))).toBe(first)
  })

  it('ensureSuiteGameTimerStart discards a stale open segment from the old model', () => {
    localStorage.setItem(resumeAtKey, String(Date.now() - 4 * 3600_000))
    ensureSuiteGameTimerStart(GAME, DATE)
    expect(localStorage.getItem(resumeAtKey)).toBeNull()
    expect(readSuiteGameElapsedMs(GAME, DATE)).toBe(0)
  })

  it('addToSuiteTimerBank is a no-op before the active model is enabled', () => {
    addToSuiteTimerBank(GAME, DATE, 1000)
    expect(localStorage.getItem(suiteTimerBankMsKey(GAME, DATE))).toBeNull()
  })

  it('addToSuiteTimerBank ignores non-positive and non-finite deltas', () => {
    ensureSuiteGameTimerStart(GAME, DATE)
    addToSuiteTimerBank(GAME, DATE, 0)
    addToSuiteTimerBank(GAME, DATE, -500)
    addToSuiteTimerBank(GAME, DATE, NaN)
    expect(readSuiteGameElapsedMs(GAME, DATE)).toBe(0)
  })

  it('reads committed + banked time, ignoring wall-clock gaps', () => {
    ensureSuiteGameTimerStart(GAME, DATE)
    addToSuiteTimerBank(GAME, DATE, 1000)
    addToSuiteTimerBank(GAME, DATE, 1500)
    vi.advanceTimersByTime(3 * 3600_000)
    expect(readSuiteGameElapsedMs(GAME, DATE)).toBe(2500)
  })

  it('ignores a leftover resumeAt when reading elapsed', () => {
    ensureSuiteGameTimerStart(GAME, DATE)
    addToSuiteTimerBank(GAME, DATE, 2000)
    localStorage.setItem(resumeAtKey, String(Date.now() - 3600_000))
    expect(readSuiteGameElapsedMs(GAME, DATE)).toBe(2000)
  })

  it('finalize commits the bank on a newly completed slot and resets the bank', () => {
    ensureSuiteGameTimerStart(GAME, DATE)
    addToSuiteTimerBank(GAME, DATE, 21_000)
    vi.advanceTimersByTime(5 * 3600_000)
    completeSlot(0)
    finalizeSuiteGameTimerFromModal(GAME, DATE)
    expect(localStorage.getItem(suiteElapsedKey(GAME, DATE))).toBe('21000')
    expect(localStorage.getItem(suiteTimerBankMsKey(GAME, DATE))).toBe('0')
    expect(readSuiteGameElapsedMs(GAME, DATE)).toBe(21_000)
  })

  it('finalize accumulates across multiple completions', () => {
    ensureSuiteGameTimerStart(GAME, DATE)
    addToSuiteTimerBank(GAME, DATE, 10_000)
    completeSlot(0)
    finalizeSuiteGameTimerFromModal(GAME, DATE)
    addToSuiteTimerBank(GAME, DATE, 5_000)
    completeSlot(1)
    finalizeSuiteGameTimerFromModal(GAME, DATE)
    expect(readSuiteGameElapsedMs(GAME, DATE)).toBe(15_000)
  })

  it('finalize does nothing when no new slot was completed', () => {
    ensureSuiteGameTimerStart(GAME, DATE)
    addToSuiteTimerBank(GAME, DATE, 10_000)
    completeSlot(0)
    finalizeSuiteGameTimerFromModal(GAME, DATE)
    addToSuiteTimerBank(GAME, DATE, 3_000)
    finalizeSuiteGameTimerFromModal(GAME, DATE)
    expect(localStorage.getItem(suiteElapsedKey(GAME, DATE))).toBe('10000')
    expect(readSuiteGameElapsedMs(GAME, DATE)).toBe(13_000)
  })

  it('legacy days without the active model still read end − start', () => {
    localStorage.setItem(suiteTimerStartKey(GAME, DATE), '1000')
    localStorage.setItem(`${GAME}:${DATE}:suiteTimerEndMs`, '61000')
    expect(readSuiteGameElapsedMs(GAME, DATE)).toBe(60_000)
  })
})
