import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildAllHubSharePlaintext,
  buildHubSharePlaintext,
  hasAnyShareableHubProgress,
} from '../hubSharePlaintext.js'
import { suiteElapsedKey } from '../suiteCompletionTimer.js'
import { bonusElapsedKey } from '../bonusCompletionTimer.js'

const BASE = '/'
const DATE = '2025-04-09'

describe('buildHubSharePlaintext', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty string for an unknown game key', () => {
    expect(buildHubSharePlaintext('notreal', DATE, BASE)).toBe('')
  })

  describe('sumtiles (tile game)', () => {
    it('shows move count in parentheses when recorded', () => {
      localStorage.setItem(`sumtiles:${DATE}:0`, '1')
      localStorage.setItem(`sumtiles:${DATE}:0:moves`, '12')
      const text = buildHubSharePlaintext('sumtiles', DATE, BASE)
      expect(text).toContain('SUM TILES')
      expect(text).toContain('(12 moves')
    })

    it('does not show first-try star line like non-tile games', () => {
      localStorage.setItem(`sumtiles:${DATE}:0`, '2')
      const text = buildHubSharePlaintext('sumtiles', DATE, BASE)
      expect(text).not.toContain('First try!')
    })

    it('includes a play URL containing the game path', () => {
      const text = buildHubSharePlaintext('sumtiles', DATE, BASE)
      expect(text).toContain('/puzzlegames/sumtiles/')
    })

    it('respects baseHref when building the play URL', () => {
      const text = buildHubSharePlaintext('sumtiles', DATE, '/MyApp/')
      expect(text).toContain('/MyApp/puzzlegames/sumtiles/')
    })
  })

  describe('productiles', () => {
    it('partial completion — easy done, med and hard empty', () => {
      localStorage.setItem(`productiles:${DATE}:0`, '1')
      const text = buildHubSharePlaintext('productiles', DATE, BASE)
      expect(text).toContain('PRODUCTILES')
      expect(text).toContain('Easy   🟩')
      expect(text).toContain('Med   ⬜')
      expect(text).toContain('Hard   ⬜')
    })
  })

  describe('rolypoly', () => {
    it('shows move count in parentheses when recorded', () => {
      localStorage.setItem(`rolypoly:${DATE}:0`, '1')
      localStorage.setItem(`rolypoly:${DATE}:0:moves`, '8')
      const text = buildHubSharePlaintext('rolypoly', DATE, BASE)
      expect(text).toContain('ROLY POLY')
      expect(text).toContain('(8 moves)')
    })

    it('shows star suffix when solved at minimum moves', () => {
      localStorage.setItem(`rolypoly:${DATE}:1`, '2')
      localStorage.setItem(`rolypoly:${DATE}:1:moves`, '5')
      const text = buildHubSharePlaintext('rolypoly', DATE, BASE)
      expect(text).toContain('(5 moves ⭐)')
      expect(text).not.toContain('First try!')
    })

    it('omits Bonus until Easy/Med/Hard are all starred', () => {
      localStorage.setItem(`rolypoly:${DATE}:0`, '2')
      localStorage.setItem(`rolypoly:${DATE}:1`, '2')
      localStorage.setItem(`rolypoly:${DATE}:2`, '1')
      const text = buildHubSharePlaintext('rolypoly', DATE, BASE)
      expect(text).not.toContain('Bonus')
    })

    it('includes Bonus line with moves, star, and long timer after unlock', () => {
      localStorage.setItem(`rolypoly:${DATE}:0`, '2')
      localStorage.setItem(`rolypoly:${DATE}:0:moves`, '7')
      localStorage.setItem(`rolypoly:${DATE}:1`, '2')
      localStorage.setItem(`rolypoly:${DATE}:1:moves`, '11')
      localStorage.setItem(`rolypoly:${DATE}:2`, '2')
      localStorage.setItem(`rolypoly:${DATE}:2:moves`, '16')
      localStorage.setItem(suiteElapsedKey('rolypoly', DATE), String(88000))
      localStorage.setItem(`rolypoly:${DATE}:3`, '2')
      localStorage.setItem(`rolypoly:${DATE}:3:moves`, '26')
      localStorage.setItem(bonusElapsedKey('rolypoly', DATE), String(296000))
      localStorage.setItem(`rolypoly:${DATE}:bonusTimerActiveModel`, '1')
      localStorage.setItem(`rolypoly:${DATE}:bonusElapsedFinalized`, '1')

      const text = buildHubSharePlaintext('rolypoly', DATE, BASE)
      expect(text).toContain('Easy   🟩 (7 moves ⭐)')
      expect(text).toContain('Med   🟩 (11 moves ⭐)')
      expect(text).toContain('Hard   🟩 (16 moves ⭐)')
      expect(text).toContain('00:01:28')
      expect(text).toContain('Bonus   🟩 (26 moves ⭐ 00:04:56)')
    })
  })
})

describe('buildAllHubSharePlaintext', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty string when nothing is shareable', () => {
    expect(buildAllHubSharePlaintext(DATE, BASE)).toBe('')
    expect(hasAnyShareableHubProgress(DATE)).toBe(false)
  })

  it('concatenates shareable games in hub order with a single hub URL', () => {
    localStorage.setItem(`rolypoly:${DATE}:0`, '1')
    localStorage.setItem(`rolypoly:${DATE}:0:moves`, '7')
    localStorage.setItem(`rolypoly:${DATE}:1`, '1')
    localStorage.setItem(`rolypoly:${DATE}:1:moves`, '11')
    localStorage.setItem(`rolypoly:${DATE}:2`, '1')
    localStorage.setItem(`rolypoly:${DATE}:2:moves`, '17')
    localStorage.setItem(suiteElapsedKey('rolypoly', DATE), String(88000))

    localStorage.setItem(`dungbeetle:${DATE}:0`, '1')
    localStorage.setItem(`dungbeetle:${DATE}:0:moves`, '6')
    localStorage.setItem(suiteElapsedKey('dungbeetle', DATE), String(21000))

    // Sum Tiles has no progress — omitted even though it appears earlier on the hub
    const text = buildAllHubSharePlaintext(DATE, BASE)
    const hubUrl = new URL(BASE, window.location.origin).href

    expect(hasAnyShareableHubProgress(DATE)).toBe(true)
    expect(text).toBe(
      [
        'ROLY POLY',
        'Easy   🟩 (7 moves)',
        'Med   🟩 (11 moves)',
        'Hard   🟩 (17 moves)',
        '00:01:28',
        '',
        'DUNG BEETLE',
        'Easy   🟩 (6 moves)',
        'Med   ⬜',
        'Hard   ⬜',
        '00:00:21',
        '',
        hubUrl,
      ].join('\n')
    )
    expect(text).not.toContain('/puzzlegames/')
  })

  it('respects baseHref for the hub URL only', () => {
    localStorage.setItem(`productiles:${DATE}:0`, '1')
    const text = buildAllHubSharePlaintext(DATE, '/MyApp/')
    expect(text).toContain(new URL('/MyApp/', window.location.origin).href)
    expect(text).not.toContain('puzzlegames')
  })
})
