/**
 * Search + generation core for the tetromino push games (Dung Beetle, Scuttlebug).
 *
 * Cost model matches both games: only tetromino pushes count. Walking is free and the
 * beetle's exact cell never matters, so a state stores its walk region's lowest cell index
 * instead of the beetle position. Dung Beetle ball pushes are also free, which makes the
 * search a 0-1 BFS - the first goal popped is push-optimal.
 *
 * Puzzles are built by reverse pushes from a solved board (construct-first), then verified
 * forward. Random sampling plus an optimality proof is far too slow at 7x7.
 *
 * Mirrored by tools/puzzlefinders/TetrominoPuzzleFinder.html - this file is the source of truth.
 */

/**
 * Solution alphabet: capitals = pushing something.
 *   `UDLR` = tetromino push (par), `NSWE` = ball roll (N↑ S↓ W← E→), `udlr` = walk.
 * Legacy all-caps UDLR paths and prior wase ball glyphs still parse.
 */
export const DIRS = [
  { ch: 'U', walk: 'u', ball: 'N', dr: -1, dc: 0 },
  { ch: 'D', walk: 'd', ball: 'S', dr: 1, dc: 0 },
  { ch: 'L', walk: 'l', ball: 'W', dr: 0, dc: -1 },
  { ch: 'R', walk: 'r', ball: 'E', dr: 0, dc: 1 },
]

/** Prior ball alphabet (wase); kept for reading already-annotated ledgers. */
const LEGACY_BALL_CH = ['w', 's', 'a', 'e']

const SOLUTION_CHAR_TO_DIR = new Map()
for (const dir of DIRS) {
  SOLUTION_CHAR_TO_DIR.set(dir.ch, dir)
  SOLUTION_CHAR_TO_DIR.set(dir.walk, dir)
  SOLUTION_CHAR_TO_DIR.set(dir.ball, dir)
}
DIRS.forEach((dir, i) => SOLUTION_CHAR_TO_DIR.set(LEGACY_BALL_CH[i], dir))

/** Resolve a solution glyph to a direction. Accepts UDLR / udlr / NSWE (+ legacy wase). */
export function dirFromSolutionChar(ch) {
  return SOLUTION_CHAR_TO_DIR.get(ch) ?? null
}

/**
 * Encode one beetle step for a stored solution string.
 * @param {number} dirIndex index into DIRS
 * @param {'walk' | 'push' | 'ball'} kind
 */
export function encodeSolutionStep(dirIndex, kind) {
  const dir = DIRS[dirIndex]
  if (!dir) return null
  if (kind === 'push') return dir.ch
  if (kind === 'ball') return dir.ball
  return dir.walk
}

export const PIECE_TYPES = ['I', 'L', 'O', 'S', 'T']

export const SHAPES = {
  I: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  L: [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ],
  O: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
  S: [
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
  ],
  T: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
  ],
}

function normalizeShape(shape) {
  const mr = Math.min(...shape.map(([r]) => r))
  const mc = Math.min(...shape.map(([, c]) => c))
  return shape
    .map(([r, c]) => [r - mr, c - mc])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

function rotateShape(shape) {
  return normalizeShape(shape.map(([r, c]) => [c, -r]))
}

function uniqueOrientations(shape) {
  const out = []
  let cur = normalizeShape(shape)
  for (let i = 0; i < 4; i++) {
    const key = JSON.stringify(cur)
    if (!out.some((s) => JSON.stringify(s) === key)) out.push(cur)
    cur = rotateShape(cur)
  }
  return out
}

export const ORIENTATIONS = Object.fromEntries(
  Object.entries(SHAPES).map(([k, s]) => [k, uniqueOrientations(s)])
)

/** Deterministic PRNG so runs can be reproduced with --seed. */
export function createRng(seed = Date.now()) {
  let s = seed >>> 0 || 1
  return function next() {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

function shuffle(arr, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** @returns {{ size: number, pieces: { type: string, cells: { r: number, c: number }[] }[] } | null} */
export function randomPlacement(size, counts, rng) {
  const used = new Set()
  const pieces = []
  const wanted = []
  for (const type of PIECE_TYPES) {
    for (let i = 0; i < (counts[type] || 0); i++) wanted.push(type)
  }

  for (const type of wanted) {
    const orientations = ORIENTATIONS[type]
    let placed = false
    // Sampling beats enumerating every origin: this runs on every generation attempt.
    for (let attempt = 0; attempt < 80 && !placed; attempt++) {
      const shape = orientations[Math.floor(rng() * orientations.length)]
      const h = Math.max(...shape.map(([r]) => r)) + 1
      const w = Math.max(...shape.map(([, c]) => c)) + 1
      const r0 = Math.floor(rng() * (size - h + 1))
      const c0 = Math.floor(rng() * (size - w + 1))
      const cells = shape.map(([r, c]) => ({ r: r + r0, c: c + c0 }))
      if (cells.every((p) => !used.has(p.r * size + p.c))) {
        cells.forEach((p) => used.add(p.r * size + p.c))
        pieces.push({ type, cells })
        placed = true
      }
    }
    if (!placed) return null
  }

  return { size, pieces, used }
}

/**
 * Push-optimal solver. Returns the optimal tetromino push count plus one concrete
 * beetle path, or a cutoff marker when the budget runs out.
 *
 * @param {object} puzzle `{ size, pieces:[{cells:[{r,c}]}], player:{r,c}, ball?:{r,c}, target:{r,c} }`
 * @param {{ dungMode?: boolean, maxStates?: number, timeBudgetMs?: number }} [options]
 */
export function solvePushPuzzle(puzzle, options = {}) {
  const {
    dungMode = puzzle.ball != null,
    maxStates = 200000,
    timeBudgetMs = 0,
  } = options

  const n = puzzle.size
  const cellCount = n * n
  const pieceCount = puzzle.pieces.length
  const idxOf = (cell) => cell.r * n + cell.c

  // Each piece keeps its shape and only translates, so its position is one anchor cell.
  const shapes = []
  const startRows = new Int8Array(pieceCount)
  const startCols = new Int8Array(pieceCount)
  puzzle.pieces.forEach((piece, i) => {
    let anchor = piece.cells[0]
    for (const cell of piece.cells) {
      if (idxOf(cell) < idxOf(anchor)) anchor = cell
    }
    shapes.push(piece.cells.map((cell) => ({ dr: cell.r - anchor.r, dc: cell.c - anchor.c })))
    startRows[i] = anchor.r
    startCols[i] = anchor.c
  })

  const targetIdx = idxOf(puzzle.target)
  const startPlayerIdx = idxOf(puzzle.player)
  const startBallIdx = dungMode ? idxOf(puzzle.ball) : -1

  // Stamped scratch buffers avoid per-node allocation.
  const occStamp = new Int32Array(cellCount)
  const occPiece = new Int8Array(cellCount)
  let occToken = 0
  const seenStamp = new Int32Array(cellCount)
  let seenToken = 0
  const queue = new Int32Array(cellCount)

  function loadOcc(rows, cols) {
    occToken++
    for (let i = 0; i < pieceCount; i++) {
      const shape = shapes[i]
      const r0 = rows[i]
      const c0 = cols[i]
      for (let j = 0; j < shape.length; j++) {
        const idx = (r0 + shape[j].dr) * n + (c0 + shape[j].dc)
        occStamp[idx] = occToken
        occPiece[idx] = i
      }
    }
  }

  const pieceAtIdx = (idx) => (occStamp[idx] === occToken ? occPiece[idx] : -1)

  /** Flood the beetle's walk region; returns its lowest cell index (region identity). */
  function floodRegion(startIdx, ballIdx) {
    seenToken++
    if (occStamp[startIdx] === occToken || startIdx === ballIdx) return -1
    let head = 0
    let tail = 0
    queue[tail++] = startIdx
    seenStamp[startIdx] = seenToken
    let rep = startIdx
    while (head < tail) {
      const cur = queue[head++]
      const r = (cur / n) | 0
      const c = cur - r * n
      for (let d = 0; d < 4; d++) {
        const nr = r + DIRS[d].dr
        const nc = c + DIRS[d].dc
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue
        const idx = nr * n + nc
        if (seenStamp[idx] === seenToken || occStamp[idx] === occToken || idx === ballIdx) continue
        seenStamp[idx] = seenToken
        if (idx < rep) rep = idx
        queue[tail++] = idx
      }
    }
    return rep
  }

  const inRegion = (idx) => seenStamp[idx] === seenToken

  // Numeric keys fit in a double for the piece counts these games use.
  const numericKeys = pieceCount <= 6 && cellCount <= 64
  function encode(rows, cols, ballIdx, rep) {
    if (numericKeys) {
      let k = (rep + 1) * 64 + (ballIdx + 1)
      for (let i = 0; i < pieceCount; i++) k = k * 64 + (rows[i] * n + cols[i])
      return k
    }
    let s = String.fromCharCode(rep + 1, ballIdx + 2)
    for (let i = 0; i < pieceCount; i++) s += String.fromCharCode(rows[i] * n + cols[i] + 1)
    return s
  }

  loadOcc(startRows, startCols)
  const startRep = floodRegion(startPlayerIdx, startBallIdx)
  if (startRep < 0) return { solvable: false, reason: 'player-blocked' }

  const startNode = {
    rows: startRows,
    cols: startCols,
    ballIdx: startBallIdx,
    playerIdx: startPlayerIdx,
    rep: startRep,
    cost: 0,
    parent: null,
    action: null,
  }

  const isGoal = (node) =>
    dungMode ? node.ballIdx === targetIdx : inRegion(targetIdx)

  const seen = new Set([encode(startRows, startCols, startBallIdx, startRep)])
  let current = [startNode]
  let next = []
  let head = 0
  let popped = 0
  const deadline = timeBudgetMs > 0 ? Date.now() + timeBudgetMs : Infinity

  while (true) {
    if (head >= current.length) {
      if (next.length === 0) break
      current = next
      next = []
      head = 0
    }

    const node = current[head++]
    popped++
    if (popped > maxStates) return { solvable: false, cutoff: true }
    if ((popped & 1023) === 0 && Date.now() > deadline) {
      return { solvable: false, cutoff: true, timedOut: true }
    }

    loadOcc(node.rows, node.cols)
    floodRegion(node.playerIdx, node.ballIdx)

    if (isGoal(node)) return finish(node)

    // Collect successors first: computing a successor's region clobbers the flood buffers.
    const candidates = []

    if (dungMode) {
      const br = (node.ballIdx / n) | 0
      const bc = node.ballIdx - br * n
      for (let d = 0; d < 4; d++) {
        const { dr, dc } = DIRS[d]
        const sr = br - dr
        const sc = bc - dc
        const ar = br + dr
        const ac = bc + dc
        if (sr < 0 || sr >= n || sc < 0 || sc >= n) continue
        if (ar < 0 || ar >= n || ac < 0 || ac >= n) continue
        const standIdx = sr * n + sc
        const aheadIdx = ar * n + ac
        if (!inRegion(standIdx)) continue
        if (pieceAtIdx(aheadIdx) !== -1) continue
        candidates.push({
          kind: 'ball',
          d,
          standIdx,
          landIdx: node.ballIdx,
          newBallIdx: aheadIdx,
          pieceIdx: -1,
        })
      }
    }

    for (let i = 0; i < pieceCount; i++) {
      const shape = shapes[i]
      const r0 = node.rows[i]
      const c0 = node.cols[i]
      for (let d = 0; d < 4; d++) {
        const { dr, dc } = DIRS[d]
        let movable = true
        for (let j = 0; j < shape.length; j++) {
          const nr = r0 + shape[j].dr + dr
          const nc = c0 + shape[j].dc + dc
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) {
            movable = false
            break
          }
          const idx = nr * n + nc
          if (idx === node.ballIdx) {
            movable = false
            break
          }
          const other = pieceAtIdx(idx)
          if (other !== -1 && other !== i) {
            movable = false
            break
          }
        }
        if (!movable) continue

        // Every push face is a distinct successor: different faces can leave the beetle
        // in different regions, so taking only the first would make the solver unsound.
        for (let j = 0; j < shape.length; j++) {
          const cr = r0 + shape[j].dr
          const cc = c0 + shape[j].dc
          const sr = cr - dr
          const sc = cc - dc
          if (sr < 0 || sr >= n || sc < 0 || sc >= n) continue
          const standIdx = sr * n + sc
          if (!inRegion(standIdx)) continue
          candidates.push({ kind: 'push', pieceIdx: i, d, standIdx, landIdx: cr * n + cc })
        }
      }
    }

    for (const cand of candidates) {
      let rows = node.rows
      let cols = node.cols
      let ballIdx = node.ballIdx

      if (cand.kind === 'push') {
        rows = Int8Array.from(node.rows)
        cols = Int8Array.from(node.cols)
        rows[cand.pieceIdx] += DIRS[cand.d].dr
        cols[cand.pieceIdx] += DIRS[cand.d].dc
      } else {
        ballIdx = cand.newBallIdx
      }

      loadOcc(rows, cols)
      const rep = floodRegion(cand.landIdx, ballIdx)
      if (rep < 0) continue

      const key = encode(rows, cols, ballIdx, rep)
      if (seen.has(key)) continue
      seen.add(key)

      const child = {
        rows,
        cols,
        ballIdx,
        playerIdx: cand.landIdx,
        rep,
        cost: node.cost + (cand.kind === 'push' ? 1 : 0),
        parent: node,
        action: { kind: cand.kind, pieceIdx: cand.pieceIdx, d: cand.d, standIdx: cand.standIdx },
      }

      if (cand.kind === 'push') next.push(child)
      else current.push(child)
    }
  }

  return { solvable: false }

  function finish(goalNode) {
    const chain = []
    for (let cur = goalNode; cur && cur.action; cur = cur.parent) chain.push(cur.action)
    chain.reverse()

    const moved = new Set()
    let ballPushes = 0
    for (const action of chain) {
      if (action.kind === 'push') moved.add(action.pieceIdx)
      else ballPushes++
    }

    return {
      solvable: true,
      pushes: goalNode.cost,
      ballPushes,
      blocksMoved: moved.size,
      actions: chain,
      solution: reconstruct(chain),
      statesExplored: popped,
    }
  }

  /**
   * Replay the action chain, filling in free walking with BFS.
   * Glyphs: udlr walk, UDLR tetromino push, NSWE ball roll.
   */
  function reconstruct(chain) {
    const rows = Int8Array.from(startRows)
    const cols = Int8Array.from(startCols)
    let ballIdx = startBallIdx
    let playerIdx = startPlayerIdx
    let out = ''

    for (const action of chain) {
      loadOcc(rows, cols)
      const walk = walkPath(playerIdx, action.standIdx, ballIdx)
      if (walk == null) return null
      const actionKind = action.kind === 'push' ? 'push' : 'ball'
      out += walk + encodeSolutionStep(action.d, actionKind)

      if (action.kind === 'push') {
        rows[action.pieceIdx] += DIRS[action.d].dr
        cols[action.pieceIdx] += DIRS[action.d].dc
        const sr = (action.standIdx / n) | 0
        const sc = action.standIdx - sr * n
        playerIdx = (sr + DIRS[action.d].dr) * n + (sc + DIRS[action.d].dc)
      } else {
        playerIdx = ballIdx
        ballIdx = ballIdx + DIRS[action.d].dr * n + DIRS[action.d].dc
      }
    }

    if (!dungMode) {
      loadOcc(rows, cols)
      const walk = walkPath(playerIdx, targetIdx, ballIdx)
      if (walk == null) return null
      out += walk
    }

    return out
  }

  /** Shortest free walk between two cells on the currently loaded board (lowercase udlr). */
  function walkPath(fromIdx, toIdx, ballIdx) {
    if (fromIdx === toIdx) return ''
    const prevCell = new Int32Array(cellCount).fill(-1)
    const prevDir = new Int8Array(cellCount).fill(-1)
    const visited = new Uint8Array(cellCount)
    visited[fromIdx] = 1
    let head = 0
    let tail = 0
    queue[tail++] = fromIdx

    while (head < tail) {
      const cur = queue[head++]
      if (cur === toIdx) break
      const r = (cur / n) | 0
      const c = cur - r * n
      for (let d = 0; d < 4; d++) {
        const nr = r + DIRS[d].dr
        const nc = c + DIRS[d].dc
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue
        const idx = nr * n + nc
        if (visited[idx] || occStamp[idx] === occToken || idx === ballIdx) continue
        visited[idx] = 1
        prevCell[idx] = cur
        prevDir[idx] = d
        queue[tail++] = idx
      }
    }

    if (!visited[toIdx]) return null
    const chars = []
    for (let cur = toIdx; cur !== fromIdx; cur = prevCell[cur]) {
      chars.push(encodeSolutionStep(prevDir[cur], 'walk'))
    }
    return chars.reverse().join('')
  }
}

/* ── Construct-first generation ─────────────────────────────────────────────── */

function pieceAtRC(state, r, c, skip = -1) {
  for (let i = 0; i < state.pieces.length; i++) {
    if (i === skip) continue
    if (state.pieces[i].cells.some((cell) => cell.r === r && cell.c === c)) return i
  }
  return -1
}

function withinBoard(state, r, c) {
  return r >= 0 && c >= 0 && r < state.size && c < state.size
}

/** Cells on one shortest free walk from `fromIdx` to `toIdx`, empty when already sealed off. */
function walkRouteCells(state, fromIdx, toIdx) {
  const n = state.size
  const blocked = new Uint8Array(n * n)
  state.pieces.forEach((p) => p.cells.forEach((cell) => (blocked[cell.r * n + cell.c] = 1)))
  if (state.ball) blocked[state.ball.r * n + state.ball.c] = 1

  const prev = new Int32Array(n * n).fill(-1)
  const seen = new Uint8Array(n * n)
  seen[fromIdx] = 1
  const q = [fromIdx]
  let found = false
  for (let i = 0; i < q.length && !found; i++) {
    const cur = q[i]
    const r = (cur / n) | 0
    const c = cur - r * n
    for (const { dr, dc } of DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue
      const idx = nr * n + nc
      if (seen[idx] || (blocked[idx] && idx !== toIdx)) continue
      seen[idx] = 1
      prev[idx] = cur
      if (idx === toIdx) {
        found = true
        break
      }
      q.push(idx)
    }
  }

  const route = new Set()
  if (!found) return route
  for (let cur = toIdx; cur !== fromIdx && cur !== -1; cur = prev[cur]) route.add(cur)
  return route
}

/** Walk region of `startIdx` as a 0/1 grid; 2 marks reachable so 1 stays "blocked". */
function reachableFrom(state, startIdx) {
  const n = state.size
  const flags = new Uint8Array(n * n)
  state.pieces.forEach((p) => p.cells.forEach((cell) => (flags[cell.r * n + cell.c] = 1)))
  if (state.ball) flags[state.ball.r * n + state.ball.c] = 1
  if (flags[startIdx]) return flags

  const q = [startIdx]
  flags[startIdx] = 2
  for (let i = 0; i < q.length; i++) {
    const cur = q[i]
    const r = (cur / n) | 0
    const c = cur - r * n
    for (const { dr, dc } of DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue
      const idx = nr * n + nc
      if (flags[idx]) continue
      flags[idx] = 2
      q.push(idx)
    }
  }
  return flags
}

/**
 * Propose undoing one forward tetromino push: pull piece `i` back by `-dir`, leaving the
 * beetle on a cell the piece vacates. Does not mutate - the caller checks walk-connectivity
 * against the board as it stands before applying.
 *
 * @param {(landIdx: number) => boolean} canChain accepts a landing cell that the previous
 *   forward action can walk from; checked per face so one bad face doesn't lose the pull
 * @returns {{ cells: {r,c}[], standIdx: number, landIdx: number } | null}
 */
function proposePiecePull(state, i, dir, rng, canChain) {
  const n = state.size
  const { dr, dc } = dir
  const cells = state.pieces[i].cells
  const pulled = cells.map((cell) => ({ r: cell.r - dr, c: cell.c - dc }))

  for (const cell of pulled) {
    if (!withinBoard(state, cell.r, cell.c)) return null
    if (pieceAtRC(state, cell.r, cell.c, i) !== -1) return null
    if (state.ball && state.ball.r === cell.r && state.ball.c === cell.c) return null
    // Hole stays empty in the start layout - pieces must never cover it.
    if (state.target && state.target.r === cell.r && state.target.c === cell.c) return null
  }

  const pulledKeys = new Set(pulled.map((cell) => cell.r * n + cell.c))
  const currentKeys = new Set(cells.map((cell) => cell.r * n + cell.c))

  // The beetle lands on a cell the piece vacates, having pushed from the cell behind it.
  const faces = shuffle(
    pulled.filter((cell) => !currentKeys.has(cell.r * n + cell.c)),
    rng
  )
  for (const face of faces) {
    const stand = { r: face.r - dr, c: face.c - dc }
    if (!withinBoard(state, stand.r, stand.c)) continue
    if (pulledKeys.has(stand.r * n + stand.c)) continue
    if (pieceAtRC(state, stand.r, stand.c, i) !== -1) continue
    if (state.ball && state.ball.r === stand.r && state.ball.c === stand.c) continue
    // Keep the hole free of the beetle in the start layout too.
    if (state.target && state.target.r === stand.r && state.target.c === stand.c) continue

    const landIdx = face.r * n + face.c
    if (!canChain(landIdx)) continue
    return { cells: pulled, standIdx: stand.r * n + stand.c, landIdx }
  }
  return null
}

/** Propose undoing one forward ball push (free in Dung Beetle, so it never costs par). */
function proposeBallPull(state, dir) {
  const n = state.size
  const { dr, dc } = dir
  const back = { r: state.ball.r - dr, c: state.ball.c - dc }
  const stand = { r: state.ball.r - 2 * dr, c: state.ball.c - 2 * dc }
  if (!withinBoard(state, back.r, back.c) || !withinBoard(state, stand.r, stand.c)) return null
  if (pieceAtRC(state, back.r, back.c) !== -1) return null
  if (pieceAtRC(state, stand.r, stand.c) !== -1) return null
  if (state.target && state.target.r === stand.r && state.target.c === stand.c) return null

  return { ball: back, standIdx: stand.r * n + stand.c, landIdx: back.r * n + back.c }
}

/**
 * Build a puzzle by undoing pushes from a solved board. The result is solvable in at most
 * `reversePushes` tetromino pushes; the forward solver then reports the true optimum.
 *
 * Each undo records where the beetle lands after the forward action (`landIdx`) and where it
 * must stand to perform it (`standIdx`). Consecutive actions only chain if the previous
 * landing cell can walk to the next stand cell, so that pair is checked on the board the
 * forward move happens from - before the undo is applied.
 *
 * `strictChain` makes every undo walk-valid, so the chain is a real witness and the result is
 * guaranteed solvable. It is off by default because it also rules out the boards that make these
 * games hard - a win sealed inside a pocket - and the forward verify is cheap enough to be the
 * authority. Left loose, this is structured sampling with bounded verification; some candidates
 * come back unsolvable and get dropped.
 *
 * @param {{ size: number, counts: Record<string, number>, dungMode: boolean, reversePushes: number, minMoved: number, ballPulls?: number, strictChain?: boolean, rng: () => number }} config
 */
export function generateByReversePushes(config) {
  const {
    size,
    counts,
    dungMode,
    reversePushes,
    minMoved,
    ballPulls = 0,
    strictChain = false,
    rng,
  } = config

  const placement = randomPlacement(size, counts, rng)
  if (!placement) return null

  const empty = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!placement.used.has(r * size + c)) empty.push({ r, c })
    }
  }
  if (empty.length < (dungMode ? 2 : 1)) return null

  const state = {
    size,
    pieces: placement.pieces.map((p) => ({ type: p.type, cells: p.cells.map((c) => ({ ...c })) })),
    ball: null,
    target: null,
  }

  const movedPieces = new Set()
  const trail = new Set()
  let nextStand = null
  let pushesApplied = 0
  let ballPullsApplied = 0

  // Every proposal in a step is judged against the same board, so flood the beetle's region
  // once per step instead of once per proposal.
  let regionFlags = null
  const chains = (landIdx) => {
    if (!strictChain || nextStand == null) return true
    if (!regionFlags) regionFlags = reachableFrom(state, nextStand)
    return regionFlags[landIdx] === 2
  }

  const tryBallPull = () => {
    for (const dir of shuffle(DIRS, rng)) {
      const step = proposeBallPull(state, dir)
      if (!step || !chains(step.landIdx)) continue
      trail.add(state.ball.r * size + state.ball.c)
      state.ball = step.ball
      trail.add(step.ball.r * size + step.ball.c)
      nextStand = step.standIdx
      ballPullsApplied++
      regionFlags = null
      return true
    }
    return false
  }

  /**
   * Cells that must stay clear for the win to happen for free: the ball's route back to the
   * hole, or in Scuttlebug the beetle's own walk to it. Covering one of these is what makes a
   * forward push necessary.
   */
  const plugTargets = () => {
    if (dungMode) {
      const ballIdx = state.ball.r * size + state.ball.c
      return new Set([...trail].filter((idx) => idx !== ballIdx))
    }
    if (nextStand == null) return new Set()
    return walkRouteCells(state, nextStand, state.target.r * size + state.target.c)
  }

  const tryPiecePull = () => {
    const proposals = []
    for (const i of state.pieces.keys()) {
      for (const dir of DIRS) {
        const step = proposePiecePull(state, i, dir, rng, chains)
        if (step) proposals.push({ i, step })
      }
    }
    if (!proposals.length) return false

    const targets = plugTargets()
    const scored = proposals.map((p) => {
      const plugged = p.step.cells.filter((cell) => targets.has(cell.r * size + cell.c)).length
      const owesMover = movedPieces.size < minMoved && !movedPieces.has(p.i)
      return { ...p, score: plugged * 4 + (owesMover ? 2 : 0) + rng() }
    })
    scored.sort((a, b) => b.score - a.score)

    const best = scored[0]
    state.pieces[best.i].cells = best.step.cells
    nextStand = best.step.standIdx
    movedPieces.add(best.i)
    pushesApplied++
    regionFlags = null
    return true
  }

  // An enclosed hole is what forces pushes: on an open board the ball just rolls there for
  // free. Prefer holes with few free neighbours, with jitter so runs still vary.
  const freeNeighbours = (cell) => {
    let free = 0
    for (const { dr, dc } of DIRS) {
      const r = cell.r + dr
      const c = cell.c + dc
      if (r >= 0 && r < size && c >= 0 && c < size && !placement.used.has(r * size + c)) free++
    }
    return free
  }

  // Dung Beetle's last forward move should drop the ball in the hole, so undo that first -
  // otherwise the ball never leaves the target and the puzzle starts solved. Try holes until
  // one has room behind it rather than throwing the whole placement away.
  const holes = shuffle(empty, rng)
    .map((cell) => ({ cell, rank: freeNeighbours(cell) + rng() }))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.cell)
  if (dungMode) {
    let opened = false
    for (const hole of holes) {
      state.target = hole
      state.ball = { r: hole.r, c: hole.c }
      trail.clear()
      if (tryBallPull()) {
        opened = true
        break
      }
    }
    if (!opened) return null
  } else {
    // Scuttlebug wins by walking onto the hole, so the last forward push must leave the beetle
    // able to reach it - seed the chain constraint with the hole itself. A hole with no free
    // neighbour can never be reached, so skip those however enclosed they look.
    let opened = false
    for (const hole of holes) {
      if (strictChain && freeNeighbours(hole) === 0) continue
      state.target = hole
      nextStand = strictChain ? hole.r * size + hole.c : null
      regionFlags = null
      if (tryPiecePull()) {
        opened = true
        break
      }
    }
    if (!opened) return null
  }

  // Alternate "let the win retreat" with "plug the route it just used". Each plug is what a
  // forward solve has to spend pushes undoing, so plugs - not chain length - set the par.
  for (let phase = 0; phase < reversePushes * 3 && pushesApplied < reversePushes; phase++) {
    if (dungMode) {
      const retreat = 1 + Math.floor(rng() * 3)
      for (let i = 0; i < retreat && ballPullsApplied < ballPulls; i++) {
        if (!tryBallPull()) break
      }
    }
    if (!tryPiecePull()) break
  }

  if (pushesApplied === 0 || movedPieces.size < minMoved || nextStand == null) return null

  const playerR = (nextStand / size) | 0
  const player = { r: playerR, c: nextStand - playerR * size }
  const { target, ball } = state

  // Start layout must keep bug, tetrominoes, hole, and ball all visible (non-overlapping).
  // Pieces may still be pushed onto the hole during play.
  if (player.r === target.r && player.c === target.c) return null
  if (pieceAtRC(state, target.r, target.c) !== -1) return null
  if (pieceAtRC(state, player.r, player.c) !== -1) return null
  if (dungMode) {
    if (ball.r === target.r && ball.c === target.c) return null
    if (ball.r === player.r && ball.c === player.c) return null
    if (pieceAtRC(state, ball.r, ball.c) !== -1) return null
  }

  return {
    size,
    pieces: state.pieces,
    player,
    ball,
    target,
    reversePushes: pushesApplied,
  }
}

/** Ledger line matching the shapes already used in each game's puzzles.js. */
export function formatLedgerLine(puzzle, result, dungMode) {
  const grouped = {}
  for (const piece of puzzle.pieces) {
    if (!grouped[piece.type]) grouped[piece.type] = []
    grouped[piece.type].push(piece.cells.map((cell) => [cell.r, cell.c]))
  }
  const head =
    `{ size: ${puzzle.size}, pieces: ${JSON.stringify(grouped)}, ` +
    `player: [${puzzle.player.r},${puzzle.player.c}], ` +
    (dungMode ? `ball: [${puzzle.ball.r},${puzzle.ball.c}], ` : '') +
    `hole: [${puzzle.target.r},${puzzle.target.c}], pushes: ${result.pushes}, ` +
    (dungMode ? `ballPushes: ${result.ballPushes}, ` : '') +
    `blocksMoved: ${result.blocksMoved},`
  return `${head}\n  solution: "${result.solution}" },`
}
