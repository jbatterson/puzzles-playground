import { describe, expect, it } from 'vitest'
import { analyzeCanonicalSolution } from './rolyPolyBfsSolver.mjs'
import { computeDifFromSolution } from './computeRolyPolyDif.mjs'

/** Former easy #30-style layout: multiple par-5 lines; canonical picks lower inner sum than "URDLU". */
const multiOptimalLowDifFixture = {
  size: 5,
  balls: [
    [3, 2],
    [4, 2],
  ],
  targets: [
    [1, 1],
    [3, 0],
  ],
  blocks: [
    [2, 4],
    [1, 2],
  ],
}

describe('analyzeCanonicalSolution', () => {
  it('picks minimum inner-sum among shortest paths (lex tie-break)', () => {
    const a = analyzeCanonicalSolution(multiOptimalLowDifFixture)
    expect(a).not.toBeNull()
    expect(a.par).toBe(5)
    expect(a.solution).toBe('LRULU')
    expect(a.innerSum).toBe(6)
    expect(a.dif).toBe(30)
    expect(a.solns).toBe(2)
    expect(computeDifFromSolution({ ...multiOptimalLowDifFixture, solution: a.solution })).toBe(30)
    const legacy = computeDifFromSolution({ ...multiOptimalLowDifFixture, solution: 'URDLU' })
    expect(legacy).toBe(50)
  })

  it('is deterministic across calls', () => {
    const a1 = analyzeCanonicalSolution(multiOptimalLowDifFixture)
    const a2 = analyzeCanonicalSolution(multiOptimalLowDifFixture)
    expect(a1).toEqual(a2)
  })
})
