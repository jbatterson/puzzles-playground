/**
 * Shared one-line puzzle object formatting for Roly Poly `puzzles.js` writers.
 */

/**
 * @param {Record<string, unknown>} p
 */
export function formatRolyPolyPuzzleLine(p) {
  const bits = []
  const sz = Number.isFinite(p.size) ? Math.trunc(Number(p.size)) : 7
  bits.push(`size: ${sz}`)
  bits.push(`balls: ${JSON.stringify(p.balls)}`)
  bits.push(`targets: ${JSON.stringify(p.targets)}`)
  bits.push(`blocks: ${JSON.stringify(p.blocks)}`)
  if (Number.isFinite(p.par)) bits.push(`par: ${p.par}`)
  else if (Number.isFinite(p.minMoves)) bits.push(`minMoves: ${p.minMoves}`)
  if (typeof p.solution === 'string' && p.solution.length) bits.push(`solution: ${JSON.stringify(p.solution)}`)
  if (Number.isFinite(p.dif)) bits.push(`dif: ${p.dif}`)
  if (Number.isFinite(p.solns)) bits.push(`solns: ${p.solns}`)
  return `    { ${bits.join(', ')} }`
}

/**
 * @param {string} name tier key
 * @param {Record<string, unknown>[]} puzzles
 */
export function formatRolyPolyTier(name, puzzles) {
  const lines = [`  ${name}: [`, '']
  for (const p of puzzles) {
    lines.push(formatRolyPolyPuzzleLine(p) + ',')
  }
  lines.push('', '  ],')
  return lines.join('\n')
}

export const ROLY_POLY_TIER_ORDER = ['tutorial', 'easy', 'medium', 'hard']
