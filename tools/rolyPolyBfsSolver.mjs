/**
 * Optimal BFS solver for Roly Poly — matches puzzlegames/rolypoly/rolypoly.jsx slide + solved check.
 */
import { computeDifFromSolution } from './computeRolyPolyDif.mjs'

function gridSizeOf(p) {
  const s = p.size
  if (Number.isFinite(s) && s >= 3 && s <= 16) return Math.trunc(s)
  return 7
}

function initFromPuzzle(p) {
  const balls = p.balls.map(([r, c], i) => ({ id: i, row: r, col: c, locked: false }))
  const targets = p.targets.map(([r, c]) => ({ row: r, col: c }))
  const blocks = p.blocks.map(([r, c]) => ({ row: r, col: c }))
  return { balls, targets, blocks }
}

function isBlockAt(blocks, r, c) {
  return blocks.some((b) => b.row === r && b.col === c)
}

function slide(dir, ballsIn, targets, blocks, gridSize) {
  const next = ballsIn.map((b) => ({ ...b }))
  let sorted
  if (dir === 'left') sorted = next.slice().sort((a, b) => a.col - b.col)
  if (dir === 'right') sorted = next.slice().sort((a, b) => b.col - a.col)
  if (dir === 'up') sorted = next.slice().sort((a, b) => a.row - b.row)
  if (dir === 'down') sorted = next.slice().sort((a, b) => b.row - a.row)

  let moved = false
  sorted.forEach((ball) => {
    if (ball.locked) return
    let r = ball.row
    let c = ball.col
    while (true) {
      let nr = r
      let nc = c
      if (dir === 'left') nc--
      if (dir === 'right') nc++
      if (dir === 'up') nr--
      if (dir === 'down') nr++
      if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) break
      if (isBlockAt(blocks, nr, nc)) break
      if (next.some((o) => o.id !== ball.id && o.row === nr && o.col === nc)) break
      r = nr
      c = nc
      if (targets.some((t) => t.row === r && t.col === c)) {
        ball.locked = true
        break
      }
    }
    if (r !== ball.row || c !== ball.col) moved = true
    ball.row = r
    ball.col = c
  })

  return { moved, balls: next }
}

function checkSolved(balls, targets) {
  return targets.every((t) => balls.some((b) => b.locked && b.row === t.row && b.col === t.col))
}

function stateKey(balls) {
  return [...balls]
    .sort((a, b) => a.id - b.id)
    .map((b) => `${b.row},${b.col},${b.locked ? 1 : 0}`)
    .join('|')
}

const DIRS = [
  ['L', 'left'],
  ['R', 'right'],
  ['U', 'up'],
  ['D', 'down'],
]

/**
 * @param {object} p puzzle { size?, balls, targets, blocks }
 * @param {{ maxNodes?: number }} opts
 * @returns {{ path: string, moves: number } | null}
 */
export function bfsShortestSolution(p, opts = {}) {
  const maxNodes = opts.maxNodes ?? 2_000_000
  const gridSize = gridSizeOf(p)
  const { balls: startBalls, targets, blocks } = initFromPuzzle(p)
  if (checkSolved(startBalls, targets)) return { path: '', moves: 0 }

  const startKey = stateKey(startBalls)
  const parent = new Map()
  const moveCh = new Map()
  parent.set(startKey, null)

  const queue = [startBalls.map((b) => ({ ...b }))]
  let head = 0
  let explored = 0

  while (head < queue.length) {
    const cur = queue[head++]
    explored++
    if (explored > maxNodes) return null

    const curKey = stateKey(cur)
    if (checkSolved(cur, targets)) {
      const chars = []
      let k = curKey
      while (parent.get(k) != null) {
        chars.push(moveCh.get(k))
        k = parent.get(k)
      }
      chars.reverse()
      return { path: chars.join(''), moves: chars.length }
    }

    for (const [ch, dir] of DIRS) {
      const { moved, balls: nb } = slide(dir, cur, targets, blocks, gridSize)
      if (!moved) continue
      const nk = stateKey(nb)
      if (parent.has(nk)) continue
      parent.set(nk, curKey)
      moveCh.set(nk, ch)
      queue.push(nb.map((b) => ({ ...b })))
    }
  }

  return null
}

/** @param {object} p */
export function puzzleWithSolution(p) {
  const res = bfsShortestSolution(p)
  if (!res) return null
  const next = { ...p, solution: res.path }
  if (!Number.isFinite(next.par)) {
    next.par = res.moves
  }
  const dif = computeDifFromSolution(next)
  if (dif != null) next.dif = dif
  return next
}
