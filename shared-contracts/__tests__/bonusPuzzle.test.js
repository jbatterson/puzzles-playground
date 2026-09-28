import { describe, it, expect, beforeEach } from 'vitest'
import {
  BONUS_SLOT,
  hasBonusPuzzleSupport,
  isBonusUnlocked,
  isBonusComplete,
} from '../bonusPuzzle.js'

const DATE = '2026-09-27'

describe('bonusPuzzle', () => {
  beforeEach(() => localStorage.clear())

  it('supports rolypoly and dungbeetle only', () => {
    expect(hasBonusPuzzleSupport('rolypoly')).toBe(true)
    expect(hasBonusPuzzleSupport('dungbeetle')).toBe(true)
    expect(hasBonusPuzzleSupport('scuttlebug')).toBe(false)
    expect(hasBonusPuzzleSupport('sumtiles')).toBe(false)
  })

  it('unlocks only when Easy, Med, and Hard are all starred (ignores prefs)', () => {
    expect(isBonusUnlocked('rolypoly', DATE)).toBe(false)
    localStorage.setItem(`rolypoly:${DATE}:0`, '2')
    localStorage.setItem(`rolypoly:${DATE}:1`, '2')
    expect(isBonusUnlocked('rolypoly', DATE)).toBe(false)
    localStorage.setItem(`rolypoly:${DATE}:2`, '1')
    expect(isBonusUnlocked('rolypoly', DATE)).toBe(false)
    localStorage.setItem(`rolypoly:${DATE}:2`, '2')
    expect(isBonusUnlocked('rolypoly', DATE)).toBe(true)
  })

  it('tracks bonus completion on slot 3', () => {
    expect(isBonusComplete('dungbeetle', DATE)).toBe(false)
    localStorage.setItem(`dungbeetle:${DATE}:${BONUS_SLOT}`, '1')
    expect(isBonusComplete('dungbeetle', DATE)).toBe(true)
  })
})
