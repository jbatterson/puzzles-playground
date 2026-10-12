import { describe, it, expect, beforeEach } from 'vitest'
import {
  BONUS_SLOT,
  hasBonusPuzzleSupport,
  isBonusDay,
  isBonusUnlocked,
  isBonusComplete,
} from '../bonusPuzzle.js'

/** Sunday */
const SUNDAY = '2026-09-27'
/** Monday */
const MONDAY = '2026-09-28'

describe('bonusPuzzle', () => {
  beforeEach(() => localStorage.clear())

  it('supports rolypoly and dungbeetle only', () => {
    expect(hasBonusPuzzleSupport('rolypoly')).toBe(true)
    expect(hasBonusPuzzleSupport('dungbeetle')).toBe(true)
    expect(hasBonusPuzzleSupport('scuttlebug')).toBe(false)
    expect(hasBonusPuzzleSupport('sumtiles')).toBe(false)
  })

  it('isBonusDay is true only for Sundays', () => {
    expect(isBonusDay(SUNDAY)).toBe(true)
    expect(isBonusDay(MONDAY)).toBe(false)
  })

  it('unlocks on Sundays only when Easy, Med, and Hard are all starred', () => {
    expect(isBonusUnlocked('rolypoly', SUNDAY)).toBe(false)
    localStorage.setItem(`rolypoly:${SUNDAY}:0`, '2')
    localStorage.setItem(`rolypoly:${SUNDAY}:1`, '2')
    expect(isBonusUnlocked('rolypoly', SUNDAY)).toBe(false)
    localStorage.setItem(`rolypoly:${SUNDAY}:2`, '1')
    expect(isBonusUnlocked('rolypoly', SUNDAY)).toBe(false)
    localStorage.setItem(`rolypoly:${SUNDAY}:2`, '2')
    expect(isBonusUnlocked('rolypoly', SUNDAY)).toBe(true)
  })

  it('does not unlock on non-Sundays even with three stars', () => {
    localStorage.setItem(`rolypoly:${MONDAY}:0`, '2')
    localStorage.setItem(`rolypoly:${MONDAY}:1`, '2')
    localStorage.setItem(`rolypoly:${MONDAY}:2`, '2')
    expect(isBonusUnlocked('rolypoly', MONDAY)).toBe(false)
  })

  it('tracks bonus completion on slot 3', () => {
    expect(isBonusComplete('dungbeetle', SUNDAY)).toBe(false)
    localStorage.setItem(`dungbeetle:${SUNDAY}:${BONUS_SLOT}`, '1')
    expect(isBonusComplete('dungbeetle', SUNDAY)).toBe(true)
  })
})
