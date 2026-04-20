import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getDailyKey,
  getDateKey,
  getDateLabel,
  getDayIndex,
  computeStreak,
} from '../dailyPuzzleDate.js'

// ── getDailyKey / getDateKey ──────────────────────────────────────────────────

describe('getDailyKey / getDateKey', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns YYYY-MM-DD format', () => {
    vi.setSystemTime(new Date('2025-04-09T20:00:00Z'))
    expect(getDailyKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('PST winter — 12:30 AM PST is still the same calendar day', () => {
    // 2025-01-15T08:30:00Z = 00:30 PST (UTC-8) → Jan 15 in LA
    vi.setSystemTime(new Date('2025-01-15T08:30:00Z'))
    expect(getDailyKey()).toBe('2025-01-15')
  })

  it('PDT summer — 12:30 AM PDT is still the same calendar day (DST regression)', () => {
    // 2025-07-01T07:30:00Z = 00:30 PDT (UTC-7) → Jul 1 in LA.
    // A hardcoded UTC-8 offset computes 11:30 PM Jun 30 → '2025-06-30' (wrong).
    vi.setSystemTime(new Date('2025-07-01T07:30:00Z'))
    expect(getDailyKey()).toBe('2025-07-01')
  })

  it('spring-forward boundary (2025-03-09): one minute before and after are the same date', () => {
    // 01:59 AM PST, just before clocks skip to 03:00 AM PDT
    vi.setSystemTime(new Date('2025-03-09T09:59:00Z'))
    expect(getDailyKey()).toBe('2025-03-09')

    // 03:01 AM PDT, just after the gap
    vi.setSystemTime(new Date('2025-03-09T10:01:00Z'))
    expect(getDailyKey()).toBe('2025-03-09')
  })

  it('fall-back boundary (2025-11-02): midnight PDT, repeated hour, and prior night are all correct', () => {
    // 11:59 PM PDT on Nov 1 = 06:59 UTC Nov 2 — still Nov 1 in LA
    vi.setSystemTime(new Date('2025-11-02T06:59:00Z'))
    expect(getDailyKey()).toBe('2025-11-01')

    // 12:01 AM PDT on Nov 2 = 07:01 UTC
    vi.setSystemTime(new Date('2025-11-02T07:01:00Z'))
    expect(getDailyKey()).toBe('2025-11-02')

    // 01:01 AM PST after fall-back = 09:01 UTC — still Nov 2 in LA
    vi.setSystemTime(new Date('2025-11-02T09:01:00Z'))
    expect(getDailyKey()).toBe('2025-11-02')
  })

  it('getDateKey(0) matches getDailyKey()', () => {
    vi.setSystemTime(new Date('2025-04-09T20:00:00Z'))
    expect(getDateKey(0)).toBe(getDailyKey())
  })

  it('getDateKey(1) is yesterday', () => {
    vi.setSystemTime(new Date('2025-04-09T20:00:00Z'))
    expect(getDateKey(1)).toBe('2025-04-08')
  })

  it('getDateKey(7) is one week ago', () => {
    vi.setSystemTime(new Date('2025-04-09T20:00:00Z'))
    expect(getDateKey(7)).toBe('2025-04-02')
  })

  it('getDateKey crosses a month boundary correctly', () => {
    // Apr 3 PDT; 3 days ago → Mar 31
    vi.setSystemTime(new Date('2025-04-03T20:00:00Z'))
    expect(getDateKey(3)).toBe('2025-03-31')
  })
})

// ── getDateLabel ──────────────────────────────────────────────────────────────

describe('getDateLabel', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not throw for curate placeholder keys (Clueless curate mode)', () => {
    vi.setSystemTime(new Date('2025-04-09T20:00:00Z'))
    expect(() => getDateLabel('curate')).not.toThrow()
    expect(getDateLabel('curate')).toBe(getDateLabel())
  })

  it('formats a valid YYYY-MM-DD key', () => {
    vi.setSystemTime(new Date('2025-04-09T20:00:00Z'))
    const label = getDateLabel('2025-01-15')
    expect(label).toMatch(/January/)
    expect(label).toMatch(/15/)
  })
})

// ── getDayIndex ───────────────────────────────────────────────────────────────

describe('getDayIndex', () => {
  it('returns 0 for the epoch date', () => {
    expect(getDayIndex('2020-01-01')).toBe(0)
  })

  it('returns 1 for the day after epoch', () => {
    expect(getDayIndex('2020-01-02')).toBe(1)
  })

  it('consecutive calendar days differ by exactly 1', () => {
    expect(getDayIndex('2025-03-31') + 1).toBe(getDayIndex('2025-04-01'))
  })

  it('consecutive days across a year boundary differ by 1', () => {
    expect(getDayIndex('2024-12-31') + 1).toBe(getDayIndex('2025-01-01'))
  })
})

// ── computeStreak ─────────────────────────────────────────────────────────────

describe('computeStreak', () => {
  // Use noon UTC in April (PDT = UTC-7), so noon UTC = 5 AM PDT — safely same calendar day.
  const NOW = '2025-04-09T12:00:00Z' // today = '2025-04-09' in PT

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns 0 when nothing has been played', () => {
    vi.setSystemTime(new Date(NOW))
    expect(computeStreak(() => false)).toBe(0)
  })

  it('returns 1 when only today is played', () => {
    vi.setSystemTime(new Date(NOW))
    const played = new Set(['2025-04-09'])
    expect(computeStreak((dk) => played.has(dk))).toBe(1)
  })

  it('returns 1 when only yesterday is played (today skipped)', () => {
    vi.setSystemTime(new Date(NOW))
    const played = new Set(['2025-04-08'])
    expect(computeStreak((dk) => played.has(dk))).toBe(1)
  })

  it('counts a multi-day run including today', () => {
    vi.setSystemTime(new Date(NOW))
    const played = new Set(['2025-04-09', '2025-04-08', '2025-04-07'])
    expect(computeStreak((dk) => played.has(dk))).toBe(3)
  })

  it('counts a multi-day run not including today', () => {
    vi.setSystemTime(new Date(NOW))
    const played = new Set(['2025-04-08', '2025-04-07', '2025-04-06'])
    expect(computeStreak((dk) => played.has(dk))).toBe(3)
  })

  it('stops at a gap — today played, yesterday skipped', () => {
    vi.setSystemTime(new Date(NOW))
    // today ✓, Apr 8 ✗ (gap), Apr 7 ✓ — gap breaks the streak
    const played = new Set(['2025-04-09', '2025-04-07'])
    expect(computeStreak((dk) => played.has(dk))).toBe(1)
  })

  it('stops at a gap — today not played, gap one day back', () => {
    vi.setSystemTime(new Date(NOW))
    // today ✗, Apr 8 ✓, Apr 7 ✗ — only Apr 8 counts
    const played = new Set(['2025-04-08', '2025-04-06'])
    expect(computeStreak((dk) => played.has(dk))).toBe(1)
  })

  it('today not played does not break a prior continuous streak', () => {
    vi.setSystemTime(new Date(NOW))
    // today ✗ — startOffset skips to yesterday; yesterday+before continuous
    const played = new Set(['2025-04-08', '2025-04-07', '2025-04-06'])
    expect(computeStreak((dk) => played.has(dk))).toBe(3)
  })
})
