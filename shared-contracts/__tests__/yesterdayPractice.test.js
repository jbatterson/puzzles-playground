import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  toPracticeStorageDateKey,
  getYesterdayCalendarKey,
  getShortMonthDayLabel,
  getYesterdayNavDateLabel,
} from '../yesterdayPractice.js'

describe('yesterdayPractice', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('prefixes calendar keys for practice storage', () => {
    expect(toPracticeStorageDateKey('2026-09-24')).toBe('practice:2026-09-24')
  })

  it('formats short month/day with SEPT', () => {
    expect(getShortMonthDayLabel('2026-09-23')).toBe('SEPT 23')
    expect(getShortMonthDayLabel('2026-01-05')).toBe('JAN 5')
  })

  it('builds yesterday nav label', () => {
    expect(getYesterdayNavDateLabel('2026-09-23')).toBe('SEPT 23 (YESTERDAY)')
  })

  it('getYesterdayCalendarKey uses Pacific yesterday', () => {
    // 2026-09-25 20:00 UTC = 13:00 PDT → Sep 25 in LA → yesterday Sep 24
    vi.setSystemTime(new Date('2026-09-25T20:00:00Z'))
    expect(getYesterdayCalendarKey()).toBe('2026-09-24')
  })
})
