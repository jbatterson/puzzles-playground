/**
 * Pure geometry helpers for the Honeycombs grid.
 *
 * All sizing uses a fixed canonical radius (HEX_R = 40px). CSS scales the SVG
 * to fit the viewport — no DOM measurement, no imperative resize handling.
 *
 * Coordinate convention:
 *   buildCells() returns RAW coordinates (origin at top-left of the grid extents).
 *   computeViewBox() returns the offset needed to place cells into a padded SVG
 *   viewBox. Add offX/offY to each cell's cx/cy to get final SVG coordinates.
 */

export const GRID_DEFS = {
  small: { rows: [3, 4, 3], rowOffsets: [0.5, 0, 0.5] },
  medium: { rows: [3, 4, 4, 3], rowOffsets: [0.5, 0, 0.5, 1.0] },
  large: { rows: [3, 4, 5, 4, 3], rowOffsets: [1.0, 0.5, 0, 0.5, 1.0] },
}

/** Cell count for a size (a solved path visits 1…n on a full honeycomb). */
export function honeycombCellCount(size) {
  const rows = GRID_DEFS[size]?.rows
  if (!rows) return 19
  return rows.reduce((sum, r) => sum + r, 0)
}

/** Gap between hex edges in pixels. */
export const HEX_GAP = 3

/** Fixed canonical circumradius (viewBox units). All grids are drawn at this size. */
export const HEX_R = 40

/**
 * Maximum hex circumradius on screen (CSS pixels).
 *
 * Same idea as Sumtiles `gs = Math.min(72, …)` — when the window is roomy, the
 * grid does not keep growing; cells stay at this visual size. Easy/medium use
 * the same cap as hard so tiers look consistent when switching puzzles.
 *
 * Increase for larger hexes, decrease for smaller (tweak here only).
 *
 * If changing `.game-container.honeycombs { --max-stage-size: … }` in style.css
 * seems to do nothing, this cap is probably binding first: board `max-height` is
 * `min(var(--max-stage-size), (this/HEX_R)*viewBoxHeight)`. Raise this constant
 * until `--max-stage-size` starts to matter on your target viewport.
 */
export const HONEYCOMBS_MAX_HEX_SCREEN_CR_PX = 42

const VB_PAD = 10

function hexWForR(r) {
  return r * Math.sqrt(3) + HEX_GAP
}
function hexVerForR(r) {
  return r * 1.5 + HEX_GAP * 0.577
}

/** Pointy-top hex polygon points string for SVG. */
export function hexPoints(cx, cy, r) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  return pts.map((p) => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ')
}

/**
 * Build the raw cell center positions for a given puzzle size at HEX_R.
 * Returns [{row, col, cx, cy}] with coordinates relative to the grid's own origin.
 * Add offX/offY from computeViewBox() to get final SVG viewBox coordinates.
 */
export function buildCells(size) {
  const { rows, rowOffsets } = GRID_DEFS[size]
  const w = hexWForR(HEX_R)
  const v = hexVerForR(HEX_R)
  const cells = []
  for (let row = 0; row < rows.length; row++) {
    const xBase = rowOffsets[row] * w
    for (let col = 0; col < rows[row]; col++) {
      const cx = xBase + col * w + w / 2
      const cy = row * v + HEX_R
      cells.push({ row, col, cx, cy })
    }
  }
  return cells
}

/**
 * Compute the SVG viewBox dimensions and the (offX, offY) translation needed
 * to centre the grid inside a padded viewBox.
 *
 * Usage:
 *   const { w, h, offX, offY } = computeViewBox(puzzle.size)
 *   viewBox={`0 0 ${w} ${h}`}
 *   // Cell SVG position: cell.cx + offX, cell.cy + offY
 */
export function computeViewBox(size) {
  const cells = buildCells(size)
  const r = HEX_R
  const minCx = Math.min(...cells.map((c) => c.cx))
  const maxCx = Math.max(...cells.map((c) => c.cx))
  const minCy = Math.min(...cells.map((c) => c.cy))
  const maxCy = Math.max(...cells.map((c) => c.cy))
  const w = Math.ceil(maxCx - minCx + r * 2 + VB_PAD * 2)
  const h = Math.ceil(maxCy - minCy + r * 2 + VB_PAD * 2)
  const offX = -minCx + r + VB_PAD
  const offY = -minCy + r + VB_PAD
  return { w, h, offX, offY }
}

/**
 * Returns true if the two cells (identified by row/col) share an edge.
 * Rebuilds fresh geometry internally — does not rely on cell cx/cy from state.
 */
export function areAdjacent(size, r1, c1, r2, c2) {
  const cells = buildCells(size)
  const a = cells.find((c) => c.row === r1 && c.col === c1)
  const b = cells.find((c) => c.row === r2 && c.col === c2)
  if (!a || !b) return false
  const dx = a.cx - b.cx
  const dy = a.cy - b.cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  return dist < hexWForR(HEX_R) * 1.05
}

/**
 * Build the consecutive path trace for the current cell values.
 *
 * Returns:
 *   { complete: true,  cells: [cell, …] }          — valid complete path
 *   { complete: false, cells: [cell, …] }          — broken path (cells up to first break)
 *   { complete: false, cells: [], bad: 'duplicate' | 'missing' } — unresolvable
 */
export function buildPathTrace(cells, size) {
  const n = cells.length
  const byValue = {}
  for (const cell of cells) {
    if (cell.value === null) continue
    if (byValue[cell.value]) return { complete: false, cells: [], bad: 'duplicate' }
    byValue[cell.value] = cell
  }
  for (let v = 1; v <= n; v++) {
    if (!byValue[v]) return { complete: false, cells: [], bad: 'missing' }
  }
  const chain = [byValue[1]]
  for (let v = 2; v <= n; v++) {
    const prev = chain[chain.length - 1]
    const cur = byValue[v]
    if (!areAdjacent(size, prev.row, prev.col, cur.row, cur.col)) {
      return { complete: false, cells: chain }
    }
    chain.push(cur)
  }
  return { complete: true, cells: chain }
}
