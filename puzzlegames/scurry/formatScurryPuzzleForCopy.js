/**
 * Single-line source form for a Scurry puzzle (matches puzzles.js style).
 * @param {{ targets: number[], maxBugs: number, prePlaced: number[] }} puzzle
 * @returns {string}
 */
export function formatScurryPuzzleSourceLine(puzzle) {
  const targets = puzzle.targets.join(', ')
  const pre = puzzle.prePlaced.join(', ')
  return `{ targets: [${targets}], maxBugs: ${puzzle.maxBugs}, prePlaced: [${pre}] }`
}
