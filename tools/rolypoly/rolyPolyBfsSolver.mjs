/**
 * Optimal BFS solver for Roly Poly — matches puzzlegames/rolypoly/rolypoly.jsx slide + solved check.
 *
 * `analyzeCanonicalSolution`: among all minimum-move solutions, picks the one with the lowest
 * inner `dif` weight (sum of unlocked balls before each move, same rule as tools/rolypoly/computeRolyPolyDif.mjs),
 * then lexicographically smallest LRUD string. Also counts shortest-path solutions (`solns`).
 */
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

function cloneBalls(balls) {
  return balls.map((b) => ({ ...b }))
}

/** Unlocked balls before a slide from `balls` (same weight as computeDifFromSolution). */
function stepInnerCost(balls) {
  return balls.filter((b) => !b.locked).length
}

const DIRS = [
  ['L', 'left'],
  ['R', 'right'],
  ['U', 'up'],
  ['D', 'down'],
]

const MAX_SAFE_SOLNS = Number.MAX_SAFE_INTEGER

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

/**
 * @param {object} p puzzle { size?, balls, targets, blocks }
 * @param {{ maxNodes?: number }} opts
 * @returns {{
 *   par: number,
 *   solution: string,
 *   innerSum: number,
 *   dif: number,
 *   solns: number | null,
 * } | null}
 */
export function analyzeCanonicalSolution(p, opts = {}) {
  const maxNodes = opts.maxNodes ?? 2_000_000
  const gridSize = gridSizeOf(p)
  const { balls: startBalls, targets, blocks } = initFromPuzzle(p)
  const startKey = stateKey(startBalls)

  if (checkSolved(startBalls, targets)) {
    return { par: 0, solution: '', innerSum: 0, dif: 0, solns: 1 }
  }

  const dist = new Map()
  const ways = new Map()
  const states = new Map()

  dist.set(startKey, 0)
  ways.set(startKey, 1n)
  states.set(startKey, cloneBalls(startBalls))

  const queue = [startKey]
  let head = 0
  let explored = 0

  while (head < queue.length) {
    const k = queue[head++]
    explored++
    if (explored > maxNodes) return null

    const cur = states.get(k)
    const d = dist.get(k)

    for (const [, dir] of DIRS) {
      const { moved, balls: nb } = slide(dir, cur, targets, blocks, gridSize)
      if (!moved) continue
      const nk = stateKey(nb)
      const nd = d + 1

      if (!dist.has(nk)) {
        dist.set(nk, nd)
        ways.set(nk, ways.get(k))
        states.set(nk, cloneBalls(nb))
        queue.push(nk)
      } else if (dist.get(nk) === nd) {
        ways.set(nk, ways.get(nk) + ways.get(k))
      }
    }
  }

  let par = Infinity
  for (const [k, balls] of states) {
    if (checkSolved(balls, targets)) {
      const d = dist.get(k)
      if (d < par) par = d
    }
  }
  if (!Number.isFinite(par)) return null

  /** @type {bigint} */
  let solnsBig = 0n
  for (const [k, balls] of states) {
    if (checkSolved(balls, targets) && dist.get(k) === par) {
      solnsBig += ways.get(k)
    }
  }

  let solns = null
  if (solnsBig <= BigInt(MAX_SAFE_SOLNS)) {
    solns = Number(solnsBig)
  }

  const prefixMin = new Map()
  prefixMin.set(startKey, 0)

  const byDist = Array.from({ length: par + 1 }, () => [])
  for (const k of dist.keys()) {
    const dd = dist.get(k)
    if (dd <= par) byDist[dd].push(k)
  }

  for (let d = 0; d < par; d++) {
    for (const k of byDist[d]) {
      const u = states.get(k)
      const base = prefixMin.get(k)
      if (base === undefined) continue

      for (const [, dir] of DIRS) {
        const { moved, balls: nb } = slide(dir, u, targets, blocks, gridSize)
        if (!moved) continue
        const nk = stateKey(nb)
        if (dist.get(nk) !== d + 1) continue
        const cost = stepInnerCost(u)
        const cand = base + cost
        const prev = prefixMin.get(nk)
        if (prev === undefined || cand < prev) {
          prefixMin.set(nk, cand)
        }
      }
    }
  }

  let OPT = Infinity
  for (const [k, balls] of states) {
    if (!checkSolved(balls, targets) || dist.get(k) !== par) continue
    const pm = prefixMin.get(k)
    if (pm !== undefined && pm < OPT) OPT = pm
  }
  if (!Number.isFinite(OPT)) return null

  const goodGoals = []
  for (const [k, balls] of states) {
    if (!checkSolved(balls, targets) || dist.get(k) !== par) continue
    if (prefixMin.get(k) === OPT) goodGoals.push(k)
  }
  if (goodGoals.length === 0) return null

  const suffixFrom = new Map()
  for (const g of goodGoals) {
    suffixFrom.set(g, 0)
  }

  for (let d = par - 1; d >= 0; d--) {
    for (const k of byDist[d]) {
      const u = states.get(k)
      let best = Infinity
      for (const [, dir] of DIRS) {
        const { moved, balls: nb } = slide(dir, u, targets, blocks, gridSize)
        if (!moved) continue
        const nk = stateKey(nb)
        if (dist.get(nk) !== d + 1) continue
        const sv = suffixFrom.get(nk)
        if (sv === undefined) continue
        const c = stepInnerCost(u) + sv
        if (c < best) best = c
      }
      if (best < Infinity) suffixFrom.set(k, best)
    }
  }

  if (suffixFrom.get(startKey) !== OPT) return null

  let path = ''
  let curKey = startKey
  for (let step = 0; step < par; step++) {
    const u = states.get(curKey)
    const du = dist.get(curKey)
    const pu = prefixMin.get(curKey)
    let picked = null
    let pickedKey = null

    for (const [ch, dir] of DIRS) {
      const { moved, balls: nb } = slide(dir, u, targets, blocks, gridSize)
      if (!moved) continue
      const nk = stateKey(nb)
      if (dist.get(nk) !== du + 1) continue
      const cost = stepInnerCost(u)
      const pv = prefixMin.get(nk)
      if (pv !== pu + cost) continue
      const sv = suffixFrom.get(nk)
      if (sv === undefined || pv + sv !== OPT) continue
      picked = ch
      pickedKey = nk
      break
    }

    if (picked == null) return null
    path += picked
    curKey = pickedKey
  }

  const innerSum = OPT
  const dif = innerSum * gridSize

  return { par, solution: path, innerSum, dif, solns }
}

/** @param {object} p */
export function puzzleWithSolution(p) {
  const res = analyzeCanonicalSolution(p)
  if (!res) return null
  const next = { ...p, solution: res.solution, par: res.par, dif: res.dif }
  if (res.solns != null) next.solns = res.solns
  return next
}
