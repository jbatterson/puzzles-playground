/** Pure Scuttlebug game logic (no React / DOM). No dung ball — player reaches the hole. */

export const DEFAULT_SIZE = 7

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
    pieces = p.pieces.map((piece) => ({
      type: piece.type ?? null,
      cells: piece.cells.map((cell) =>
        Array.isArray(cell) ? { r: cell[0], c: cell[1] } : { r: cell.r, c: cell.c }
      ),
    }))
  } else {
    for (const [type, instances] of Object.entries(p.pieces || {})) {
      for (const cells of instances) {
        pieces.push({
          type,
          cells: cells.map(([r, c]) => ({ r, c })),
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
