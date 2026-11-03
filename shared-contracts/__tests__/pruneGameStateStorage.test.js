import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isStaleGameStateKey, pruneStaleGameStateStorage } from '../pruneGameStateStorage.js'

const TODAY = '2026-11-02'
const YESTERDAY = '2026-11-01'

describe('pruneGameStateStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-02T20:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps today gameState and drops older dated ones', () => {
    expect(isStaleGameStateKey(`rolypoly:${TODAY}:0:gameState`, TODAY)).toBe(false)
    expect(isStaleGameStateKey(`rolypoly:${YESTERDAY}:1:gameState`, TODAY)).toBe(true)
    expect(isStaleGameStateKey(`dungbeetle:${YESTERDAY}:2:gameState`, TODAY)).toBe(true)
  })

  it('drops yesterday practice gameState but keeps practice for keepDateKey', () => {
    expect(isStaleGameStateKey(`scuttlebug:practice:${YESTERDAY}:0:gameState`, TODAY)).toBe(true)
    expect(isStaleGameStateKey(`scuttlebug:practice:${TODAY}:0:gameState`, TODAY)).toBe(false)
  })

  it('keeps curate and never touches progress / timer keys', () => {
    expect(isStaleGameStateKey('sumtiles:curate:3:gameState', TODAY)).toBe(false)
    expect(isStaleGameStateKey(`rolypoly:${YESTERDAY}:0`, TODAY)).toBe(false)
    expect(isStaleGameStateKey(`rolypoly:${YESTERDAY}:0:moves`, TODAY)).toBe(false)
    expect(isStaleGameStateKey(`rolypoly:${YESTERDAY}:suiteElapsedMs`, TODAY)).toBe(false)
  })

  it('pruneStaleGameStateStorage removes only stale gameState keys', () => {
    localStorage.setItem(`rolypoly:${TODAY}:0:gameState`, '{"v":1}')
    localStorage.setItem(`rolypoly:${YESTERDAY}:0:gameState`, '{"v":1}')
    localStorage.setItem(`dungbeetle:practice:${YESTERDAY}:1:gameState`, '{"v":1}')
    localStorage.setItem('productiles:curate:0:gameState', '{"v":1}')
    localStorage.setItem(`rolypoly:${YESTERDAY}:0`, '2')
    localStorage.setItem(`rolypoly:${YESTERDAY}:0:moves`, '8')
    localStorage.setItem(`rolypoly:${YESTERDAY}:suiteElapsedMs`, '12000')

    const removed = pruneStaleGameStateStorage({ keepDateKey: TODAY })
    expect(removed).toBe(2)
    expect(localStorage.getItem(`rolypoly:${TODAY}:0:gameState`)).toBe('{"v":1}')
    expect(localStorage.getItem(`rolypoly:${YESTERDAY}:0:gameState`)).toBeNull()
    expect(localStorage.getItem(`dungbeetle:practice:${YESTERDAY}:1:gameState`)).toBeNull()
    expect(localStorage.getItem('productiles:curate:0:gameState')).toBe('{"v":1}')
    expect(localStorage.getItem(`rolypoly:${YESTERDAY}:0`)).toBe('2')
    expect(localStorage.getItem(`rolypoly:${YESTERDAY}:0:moves`)).toBe('8')
    expect(localStorage.getItem(`rolypoly:${YESTERDAY}:suiteElapsedMs`)).toBe('12000')
  })
})
