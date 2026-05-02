import { describe, it, expect, beforeEach } from 'vitest'
import { buildHubSharePlaintext } from '../hubSharePlaintext.js'

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
})
