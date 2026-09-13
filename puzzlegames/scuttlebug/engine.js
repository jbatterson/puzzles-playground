/** Pure Scuttlebug game logic (no React / DOM). No dung ball — player reaches the hole. */

export const DEFAULT_SIZE = 7

/** Stable colors by tetromino letter (CSS class suffix). */
export const TETROMINO_TYPES = Object.freeze(['I', 'L', 'O', 'S', 'T'])

const BASE_SHAPES = Object.freeze({
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
})

function normalizeShapeCells(cells) {
  const mr = Math.min(...cells.map(([r]) => r))
  const mc = Math.min(...cells.map(([, c]) => c))
  return cells
    .map(([r, c]) => [r - mr, c - mc])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

function rotateShapeCells(cells) {
  return normalizeShapeCells(cells.map(([r, c]) => [c, -r]))
}

function shapeKey(cells) {
  return cells.map(([r, c]) => `${r},${c}`).join('|')
}

const SHAPE_TYPE_LOOKUP = (() => {
  const map = new Map()
  for (const [type, base] of Object.entries(BASE_SHAPES)) {
    let cur = normalizeShapeCells(base)
    for (let i = 0; i < 4; i++) {
      map.set(shapeKey(cur), type)
      cur = rotateShapeCells(cur)
    }
  }
  return map
})()

/** Infer I/L/O/S/T from cell geometry (any orientation). */
export function inferTetrominoType(cells) {
  if (!Array.isArray(cells) || cells.length !== 4) return null
  const pairs = cells.map((cell) =>
    Array.isArray(cell) ? [cell[0], cell[1]] : [cell.r, cell.c]
  )
  return SHAPE_TYPE_LOOKUP.get(shapeKey(normalizeShapeCells(pairs))) ?? null
}

/** CSS class for a piece: piece-I … piece-T, or piece-unknown. */
export function pieceTypeClass(piece) {
  const type = piece?.type || inferTetrominoType(piece?.cells) || 'unknown'
  return `piece-${type}`
}

export function clone(x) {
  return JSON.parse(JSON.stringify(x))
}

/**
 * Normalize finder / curated puzzle shapes into playable form.
 * @param {unknown} raw
 * @param {boolean} expectBall — kept for API parity; scuttlebug always calls with false
 */
export function normalizePuzzleInput(raw, expectBall) {
  const p = clone(raw)

  let pieces = []
  if (Array.isArray(p.pieces)) {
    pieces = p.pieces.map((piece) => {
      const cells = piece.cells.map((cell) =>
        Array.isArray(cell) ? { r: cell[0], c: cell[1] } : { r: cell.r, c: cell.c }
      )
      return {
        type: piece.type ?? inferTetrominoType(cells),
        cells,
      }
    })
  } else {
    for (const [type, instances] of Object.entries(p.pieces || {})) {
      for (const cells of instances) {
        const mapped = cells.map(([r, c]) => ({ r, c }))
        pieces.push({
          type: TETROMINO_TYPES.includes(type) ? type : inferTetrominoType(mapped),
          cells: mapped,
        })
      }
    }
  }

  const toCell = (value) =>
    Array.isArray(value)
      ? { r: value[0], c: value[1] }
      : value
        ? { r: value.r, c: value.c }
        : null

  let maxCoord = -1
  pieces.forEach((piece) =>
    piece.cells.forEach((cell) => {
      maxCoord = Math.max(maxCoord, cell.r, cell.c)
    })
  )
  for (const value of [p.player, p.ball, p.hole, p.target]) {
    if (value) {
      const cell = toCell(value)
      maxCoord = Math.max(maxCoord, cell.r, cell.c)
    }
  }

  const normalized = {
    size: p.size ?? Math.max(DEFAULT_SIZE, maxCoord + 1),
    pieces,
    player: toCell(p.player),
    target: toCell(p.hole ?? p.target),
    minPushes: p.pushes ?? p.minPushes ?? null,
    pushes: p.pushes ?? p.minPushes ?? null,
    blocksMoved: p.blocksMoved ?? null,
    solns: p.solns ?? null,
    solution: p.solution ?? '',
  }

  if (expectBall) {
    normalized.ball = toCell(p.ball)
    normalized.ballPushes = p.ballPushes ?? null
  }
  return normalized
}

export function getParPushes(p) {
  if (!p || typeof p !== 'object') return null
  return p.minPushes ?? p.pushes ?? null
}

export function pieceAtIn(pieces, r, c) {
  for (let i = 0; i < pieces.length; i++) {
    if (pieces[i].cells.some((p) => p.r === r && p.c === c)) return i
  }
  return -1
}

export function inBounds(r, c, size) {
  return r >= 0 && r < size && c >= 0 && c < size
}

export function canMovePieceIn(pieces, pi, dr, dc, size) {
  for (const cell of pieces[pi].cells) {
    const nr = cell.r + dr
    const nc = cell.c + dc
    if (!inBounds(nr, nc, size)) return false
    const other = pieceAtIn(pieces, nr, nc)
    if (other !== -1 && other !== pi) return false
  }
  return true
}

/**
 * Attempt one orthogonal step. Does not mutate `state`.
 * Walk into empty or push a tetromino. Tetromino push sets `pushedTetromino: true`.
 * @returns {{ ok: true, state: object, pushedTetromino: boolean } | { ok: false }}
 */
export function tryMove(state, dr, dc) {
  if (!state) return { ok: false }

  const next = clone(state)
  const size = next.size ?? DEFAULT_SIZE
  const nr = next.player.r + dr
  const nc = next.player.c + dc
  if (!inBounds(nr, nc, size)) return { ok: false }

  const hit = pieceAtIn(next.pieces, nr, nc)
  let pushedTetromino = false

  if (hit === -1) {
    next.player = { r: nr, c: nc }
  } else {
    if (!canMovePieceIn(next.pieces, hit, dr, dc, size)) return { ok: false }

    next.pieces[hit].cells.forEach((cell) => {
      cell.r += dr
      cell.c += dc
    })
    next.player = { r: nr, c: nc }
    pushedTetromino = true
  }

  return { ok: true, state: next, pushedTetromino }
}

/** Win when the player stands on the hole/target. */
export function checkWon(state) {
  if (!state?.player || !state?.target) return false
  return state.player.r === state.target.r && state.player.c === state.target.c
}

/** Stable fingerprint for mid-solve persistence invalidation. */
export function puzzleFingerprint(data) {
  if (!data) return ''
  return JSON.stringify({
    pieces: data.pieces,
    player: data.player,
    target: data.target,
    size: data.size ?? DEFAULT_SIZE,
  })
}

/** Playable runtime state cloned from a normalized puzzle. */
export function initPlayState(normalizedPuzzle) {
  const p = clone(normalizedPuzzle)
  return {
    pieces: p.pieces,
    player: p.player,
    target: p.target,
    size: p.size ?? DEFAULT_SIZE,
  }
}
