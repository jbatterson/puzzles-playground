import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  addToBonusTimerBank,
  ensureBonusGameTimerStart,
  finalizeBonusGameTimer,
  readBonusGameElapsedMs,
  bonusElapsedKey,
  bonusTimerActiveModelKey,
  bonusTimerBankMsKey,
} from '../bonusCompletionTimer.js'

const GAME = 'rolypoly'
const DATE = '2026-09-27'

describe('bonus completion timer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-27T16:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('banks active time and finalizes once when bonus completes', () => {
    ensureBonusGameTimerStart(GAME, DATE)
    expect(localStorage.getItem(bonusTimerActiveModelKey(GAME, DATE))).toBe('1')
    addToBonusTimerBank(GAME, DATE, 5000)
    expect(localStorage.getItem(bonusTimerBankMsKey(GAME, DATE))).toBe('5000')

    finalizeBonusGameTimer(GAME, DATE)
    expect(localStorage.getItem(bonusElapsedKey(GAME, DATE))).toBeNull()

    localStorage.setItem(`${GAME}:${DATE}:3`, '1')
    finalizeBonusGameTimer(GAME, DATE)
    expect(localStorage.getItem(bonusElapsedKey(GAME, DATE))).toBe('5000')
    expect(readBonusGameElapsedMs(GAME, DATE)).toBe(5000)

    addToBonusTimerBank(GAME, DATE, 9000)
    finalizeBonusGameTimer(GAME, DATE)
    expect(localStorage.getItem(bonusElapsedKey(GAME, DATE))).toBe('5000')
  })
})
