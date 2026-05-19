/**
 * Grid size for slide physics vs dif tier multiplier (5x5 -> 3, 6x6 -> 4, 7x7 -> 5).
 */

export function gridSizeOf(p) {
  const s = p?.size
  if (Number.isFinite(s) && s >= 3 && s <= 16) return Math.trunc(s)
  return 7
}

/** @param {number} size grid side length (5, 6, 7, …) */
export function difMultiplierForSize(size) {
  const sz = Number.isFinite(size) ? Math.trunc(size) : 7
  if (sz <= 5) return 3
  if (sz === 6) return 4
  return 5
}

/** @param {number} innerSum sum of unlocked balls before each move along the solution */
/** @param {number} size grid side length */
export function difFromInnerSum(innerSum, size) {
  return innerSum * difMultiplierForSize(size)
}
