import { describe, it, expect } from 'vitest'
import { GAME_KEYS } from '../gameChrome.js'
import {
  getSuiteCompletionHeadline,
  weekdayIndexSun0,
  SUITE_COMPLETION_HEADLINES,
} from '../suiteCompletionHeadlines.js'

describe('weekdayIndexSun0', () => {
  it('maps known dates (UTC noon)', () => {
    // 2026-09-27 = Sunday
    expect(weekdayIndexSun0('2026-09-27')).toBe(0)
    // 2026-09-28 = Monday
    expect(weekdayIndexSun0('2026-09-28')).toBe(1)
    // 2026-10-03 = Saturday
    expect(weekdayIndexSun0('2026-10-03')).toBe(6)
  })
})

describe('getSuiteCompletionHeadline', () => {
  it('rotates dung beetle by weekday', () => {
    const list = SUITE_COMPLETION_HEADLINES[GAME_KEYS.DUNGBEETLE]
    expect(getSuiteCompletionHeadline(GAME_KEYS.DUNGBEETLE, '2026-09-27')).toBe(list[0])
    expect(getSuiteCompletionHeadline(GAME_KEYS.DUNGBEETLE, '2026-09-28')).toBe(list[1])
    expect(getSuiteCompletionHeadline(GAME_KEYS.DUNGBEETLE, '2026-10-03')).toBe(list[6])
  })

  it('rotates roly poly by weekday', () => {
    const list = SUITE_COMPLETION_HEADLINES[GAME_KEYS.ROLYPOLY]
    expect(getSuiteCompletionHeadline(GAME_KEYS.ROLYPOLY, '2026-09-27')).toBe('On a Roll!')
    expect(getSuiteCompletionHeadline(GAME_KEYS.ROLYPOLY, '2026-09-28')).toBe(list[1])
  })

  it('keeps fixed headlines for tile games', () => {
    expect(getSuiteCompletionHeadline(GAME_KEYS.SUMTILES, '2026-09-27')).toBe('AWE-SUM!')
    expect(getSuiteCompletionHeadline(GAME_KEYS.PRODUCTILES, '2026-09-28')).toBe('PRODUCTIVE!')
  })

  it('falls back to game title for scuttlebug', () => {
    expect(getSuiteCompletionHeadline(GAME_KEYS.SCUTTLEBUG, '2026-09-27')).toBe('SCUTTLEBUG!')
  })
})
