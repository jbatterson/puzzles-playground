/**
 * Parse annotated tetromino solution glyphs to (dr, dc).
 * UDLR / udlr / NSWE (and legacy wase) — same alphabet as tools/tetromino/pushEngine.mjs.
 */
const DIR_BY_CHAR = {
  U: [-1, 0],
  u: [-1, 0],
  N: [-1, 0],
  w: [-1, 0],
  D: [1, 0],
  d: [1, 0],
  S: [1, 0],
  s: [1, 0],
  L: [0, -1],
  l: [0, -1],
  W: [0, -1],
  a: [0, -1],
  R: [0, 1],
  r: [0, 1],
  E: [0, 1],
  e: [0, 1],
}

/** @returns {[number, number] | null} */
export function dirFromSolutionChar(ch) {
  return DIR_BY_CHAR[ch] ?? null
}

export const SOLUTION_PLAYBACK_MS = 300
