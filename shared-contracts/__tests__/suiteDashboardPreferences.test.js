import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDefaultSuiteDashboardPreferences,
  getEnabledTierIndices,
  getTierMask,
  isSuiteCompleteForPrefs,
  hubHrefFirstUnfinishedThreeWithPrefs,
} from '../suiteDashboardPreferences.js'
import { GAME_KEYS } from '../gameChrome.js'

/** Build a full prefs object with specific tier overrides, leaving everything else at defaults. */
function makePrefs(tierOverrides = {}) {
  const base = createDefaultSuiteDashboardPreferences()
  return { ...base, tierOn: { ...base.tierOn, ...tierOverrides } }
}

const DATE = '2025-04-09'

describe('createDefaultSuiteDashboardPreferences', () => {
  it('has schema version 1', () => {
    expect(createDefaultSuiteDashboardPreferences().v).toBe(1)
  })

  it('has every known game enabled by default', () => {
    const { puzzleOn } = createDefaultSuiteDashboardPreferences()
    for (const key of Object.values(GAME_KEYS)) {
      expect(puzzleOn[key]).toBe(true)
    }
  })

  it('has all three tiers on for every three-tier game', () => {
    const { tierOn } = createDefaultSuiteDashboardPreferences()
    const threeTierKeys = [GAME_KEYS.SUMTILES, GAME_KEYS.PRODUCTILES, GAME_KEYS.ROLYPOLY]
    for (const key of threeTierKeys) {
      expect(tierOn[key]).toEqual([true, true, true])
    }
  })

  it('has timer enabled by default', () => {
    expect(createDefaultSuiteDashboardPreferences().timerOn).toBe(true)
  })
})

describe('getEnabledTierIndices', () => {
  it('returns [0, 1, 2] when all tiers on', () => {
    expect(getEnabledTierIndices(GAME_KEYS.SUMTILES, makePrefs())).toEqual([0, 1, 2])
  })

  it('returns only the single enabled tier', () => {
    const prefs = makePrefs({ [GAME_KEYS.SUMTILES]: [true, false, false] })
    expect(getEnabledTierIndices(GAME_KEYS.SUMTILES, prefs)).toEqual([0])
  })

  it('returns [1, 2] when easy is off', () => {
    const prefs = makePrefs({ [GAME_KEYS.PRODUCTILES]: [false, true, true] })
    expect(getEnabledTierIndices(GAME_KEYS.PRODUCTILES, prefs)).toEqual([1, 2])
  })

  it('returns [0, 2] for easy+hard only', () => {
    const prefs = makePrefs({ [GAME_KEYS.ROLYPOLY]: [true, false, true] })
    expect(getEnabledTierIndices(GAME_KEYS.ROLYPOLY, prefs)).toEqual([0, 2])
  })
})

describe('getTierMask', () => {
  it('returns the stored mask for a three-tier game', () => {
    const prefs = makePrefs({ [GAME_KEYS.SUMTILES]: [true, false, true] })
    expect(getTierMask(GAME_KEYS.SUMTILES, prefs)).toEqual([true, false, true])
  })

  it('falls back to [true, true, true] for non-three-tier game', () => {
    expect(getTierMask('not-a-game', makePrefs())).toEqual([true, true, true])
  })
})

describe('isSuiteCompleteForPrefs', () => {
  beforeEach(() => localStorage.clear())

  it('returns false when nothing is in storage', () => {
    expect(isSuiteCompleteForPrefs(GAME_KEYS.SUMTILES, DATE, makePrefs())).toBe(false)
  })

  it('returns false for a non-three-tier game key', () => {
    expect(isSuiteCompleteForPrefs('not-a-game', DATE, makePrefs())).toBe(false)
  })

  it('returns true when all three enabled tiers are complete', () => {
    localStorage.setItem(`sumtiles:${DATE}:0`, '1')
    localStorage.setItem(`sumtiles:${DATE}:1`, '2')
    localStorage.setItem(`sumtiles:${DATE}:2`, '1')
    expect(isSuiteCompleteForPrefs(GAME_KEYS.SUMTILES, DATE, makePrefs())).toBe(true)
  })

  it('returns false when one of three tiers is missing', () => {
    localStorage.setItem(`sumtiles:${DATE}:0`, '1')
    localStorage.setItem(`sumtiles:${DATE}:1`, '1')
    expect(isSuiteCompleteForPrefs(GAME_KEYS.SUMTILES, DATE, makePrefs())).toBe(false)
  })

  it('ignores a disabled tier — only easy enabled and complete', () => {
    localStorage.setItem(`sumtiles:${DATE}:0`, '1')
    const prefs = makePrefs({ [GAME_KEYS.SUMTILES]: [true, false, false] })
    expect(isSuiteCompleteForPrefs(GAME_KEYS.SUMTILES, DATE, prefs)).toBe(true)
  })

  it('requires every enabled tier — easy+hard on, hard missing → false', () => {
    localStorage.setItem(`sumtiles:${DATE}:0`, '1')
    const prefs = makePrefs({ [GAME_KEYS.SUMTILES]: [true, false, true] })
    expect(isSuiteCompleteForPrefs(GAME_KEYS.SUMTILES, DATE, prefs)).toBe(false)
  })

  it('easy+hard enabled, both complete → true', () => {
    localStorage.setItem(`sumtiles:${DATE}:0`, '1')
    localStorage.setItem(`sumtiles:${DATE}:2`, '1')
    const prefs = makePrefs({ [GAME_KEYS.SUMTILES]: [true, false, true] })
    expect(isSuiteCompleteForPrefs(GAME_KEYS.SUMTILES, DATE, prefs)).toBe(true)
  })
})

describe('hubHrefFirstUnfinishedThreeWithPrefs', () => {
  it('returns ?p=1 when nothing is done (all enabled, first = easy)', () => {
    const href = hubHrefFirstUnfinishedThreeWithPrefs(
      '/puzzles/puzzlegames/sumtiles/',
      [false, false, false],
      makePrefs()
    )
    expect(href).toBe('/puzzles/puzzlegames/sumtiles/?p=1')
  })

  it('skips the completed easy tier and points to medium', () => {
    const href = hubHrefFirstUnfinishedThreeWithPrefs(
      '/puzzles/puzzlegames/sumtiles/',
      [true, false, false],
      makePrefs()
    )
    expect(href).toBe('/puzzles/puzzlegames/sumtiles/?p=2')
  })

  it('when easy is disabled and medium is done, points to hard', () => {
    const prefs = makePrefs({ [GAME_KEYS.SUMTILES]: [false, true, true] })
    const href = hubHrefFirstUnfinishedThreeWithPrefs(
      '/puzzles/puzzlegames/sumtiles/',
      [false, true, false],
      prefs
    )
    expect(href).toBe('/puzzles/puzzlegames/sumtiles/?p=3')
  })

  it('when all enabled tiers are done, returns first enabled tier', () => {
    const href = hubHrefFirstUnfinishedThreeWithPrefs(
      '/puzzles/puzzlegames/sumtiles/',
      [true, true, true],
      makePrefs()
    )
    expect(href).toBe('/puzzles/puzzlegames/sumtiles/?p=1')
  })
})
