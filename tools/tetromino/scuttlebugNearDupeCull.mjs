/**
 * Shared Scuttlebug near-dupe cull + pushes≥10 rebucket.
 *
 * Keep rule for clusters/clumps: order by ledger (tutorial→hard, index),
 * keep floor(n/2) (middle; higher of two middles / pairs).
 *
 *   import { polishScuttlebugDaily } from './scuttlebugNearDupeCull.mjs'
 */
import { dirFromSolutionChar } from './pushEngine.mjs'

export const TIERS = ['tutorial', 'easy', 'medium', 'hard']
export const DEFAULT_OVERLAP = { minSharedPushes: 3, minOverlapRatio: 0.85 }

function mapCell(r, c, n, orient) {
  const rot = orient % 4
  const reflect = orient >= 4
  let rr = r
  let cc = c
  for (let i = 0; i < rot; i++) {
    const nr = cc
    const nc = n - 1 - rr
    rr = nr
    cc = nc
  }
  if (reflect) cc = n - 1 - cc
  return [rr, cc]
}

function cellsKey(cells) {
  return cells
    .map((c) => `${c.r},${c.c}`)
    .sort()
    .join('|')
}

function mapCells(cells, size, orient) {
  return cells.map((c) => {
    const [r, c2] = mapCell(c.r, c.c, size, orient)
    return { r, c: c2 }
  })
}

function encodeCellCore(size, hole, moved) {
  const pieceKeys = moved
    .map((p) => `${p.type}:${cellsKey(p.start)}>${cellsKey(p.end)}`)
    .sort()
  return JSON.stringify({ s: size, h: [hole.r, hole.c], m: pieceKeys })
}

function canonicalMovingCoreKey(size, hole, moved) {
  let best = null
  for (let orient = 0; orient < 8; orient++) {
    const h = mapCell(hole.r, hole.c, size, orient)
    const mapped = moved.map((p) => ({
      type: p.type || '?',
      start: mapCells(p.start, size, orient),
      end: mapCells(p.end, size, orient),
    }))
    const key = encodeCellCore(size, { r: h[0], c: h[1] }, mapped)
    if (best == null || key < best) best = key
  }
  return best
}

function snapshotPieces(state) {
  return state.pieces.map((p) => ({
    type: p.type || '?',
    cells: p.cells.map((c) => ({ r: c.r, c: c.c })),
  }))
}

function isSubtrail(shortTrail, longTrail) {
  if (shortTrail.length === 0 || shortTrail.length > longTrail.length) return false
  const span = shortTrail.length
  for (let i = 0; i <= longTrail.length - span; i++) {
    let ok = true
    for (let j = 0; j < span; j++) {
      if (shortTrail[j] !== longTrail[i + j]) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

function moversContained(shortMovers, longMovers) {
  const used = new Set()
  let sharedPushes = 0
  for (const s of shortMovers) {
    let found = -1
    for (let i = 0; i < longMovers.length; i++) {
      if (used.has(i)) continue
      const L = longMovers[i]
      if (L.type !== s.type) continue
      if (isSubtrail(s.trail, L.trail)) {
        found = i
        break
      }
    }
    if (found < 0) return { ok: false, sharedPushes: 0 }
    used.add(found)
    sharedPushes += Math.max(0, s.trail.length - 1)
  }
  return { ok: true, sharedPushes }
}

function mapMoversTrail(movers, size, orient) {
  return movers.map((p) => ({
    type: p.type || '?',
    trail: p.trailCells.map((snap) => cellsKey(mapCells(snap, size, orient))),
  }))
}

function typeMultisetCompatible(a, b) {
  if (a === b) return true
  const count = (s) => {
    const m = new Map()
    for (const ch of s) m.set(ch, (m.get(ch) || 0) + 1)
    return m
  }
  const A = count(a)
  const B = count(b)
  return (
    [...A].every(([k, v]) => (B.get(k) || 0) >= v) ||
    [...B].every(([k, v]) => (A.get(k) || 0) >= v)
  )
}

/**
 * Replay official solution; return mover analysis or null.
 */
export function extractMoverAnalysis(raw, engine) {
  const { normalizePuzzleInput, initPlayState, tryMove, checkWon, pieceAtIn } = engine
  if (typeof raw.solution !== 'string' || !raw.solution) return null
  let puzzle
  try {
    puzzle = normalizePuzzleInput(raw, false)
  } catch {
    return null
  }
  const startState = initPlayState(puzzle)
  const startPieces = snapshotPieces(startState)
  const hole = { r: startState.target.r, c: startState.target.c }
  const trails = startPieces.map((p) => [p.cells.map((c) => ({ r: c.r, c: c.c }))])
  let state = startState
  const movedIdx = new Set()
  for (const ch of raw.solution) {
    if (checkWon(state)) break
    const dir = dirFromSolutionChar(ch)
    if (!dir) return null
    const hit = pieceAtIn(state.pieces, state.player.r + dir.dr, state.player.c + dir.dc)
    const move = tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return null
    if (move.pushedTetromino && hit >= 0) {
      movedIdx.add(hit)
      trails[hit].push(move.state.pieces[hit].cells.map((c) => ({ r: c.r, c: c.c })))
    }
    state = move.state
  }
  if (!checkWon(state)) return null
  const endPieces = snapshotPieces(state)
  const movedList = [...movedIdx].sort((a, b) => a - b)
  const moved = movedList.map((i) => ({
    type: startPieces[i].type,
    start: startPieces[i].cells,
    end: endPieces[i].cells,
    trailCells: trails[i],
  }))
  const allTypes = startPieces
    .map((p) => p.type)
    .sort()
    .join('')
  const movedTypes = movedList
    .map((i) => startPieces[i].type)
    .sort()
    .join('')
  const pushCount = moved.reduce((n, p) => n + Math.max(0, p.trailCells.length - 1), 0)
  return {
    size: puzzle.size,
    hole,
    moved,
    cellsKey: canonicalMovingCoreKey(puzzle.size, hole, moved),
    allTypes,
    movedTypes,
    pushCount,
  }
}

function glyphs(p) {
  return typeof p.solution === 'string' ? p.solution.length : 0
}

export function sortByPushesThenGlyphs(a, b) {
  return (
    (a.pushes ?? 0) - (b.pushes ?? 0) ||
    glyphs(a) - glyphs(b) ||
    String(a.solution || '').localeCompare(String(b.solution || ''))
  )
}

/** pushes≥10 → hard; else 5×5 → easy, 6×6 → medium. Tutorial untouched. */
export function rebucketByPushes(easy, medium, hard) {
  const pool = [...easy, ...medium, ...hard]
  const out = { easy: [], medium: [], hard: [] }
  for (const raw of pool) {
    const pushes = raw.pushes ?? raw.minPushes ?? 0
    const size = raw.size ?? 5
    if (pushes >= 10) out.hard.push(raw)
    else if (size === 5) out.easy.push(raw)
    else out.medium.push(raw)
  }
  out.easy.sort(sortByPushesThenGlyphs)
  out.medium.sort(sortByPushesThenGlyphs)
  out.hard.sort(sortByPushesThenGlyphs)
  return out
}

function filterDrop(data, drop) {
  const next = { tutorial: data.tutorial || [] }
  for (const tier of ['easy', 'medium', 'hard']) {
    next[tier] = (data[tier] || []).filter((_, i) => !drop.has(`${tier}|${i}`))
  }
  return next
}

/**
 * Exact cluster cull by key (e.g. cellsKey). Same-shape not required.
 * Keep floor(n/2) in ledger order.
 */
export function cullExactClusters(data, engine, keyFn) {
  const rows = []
  for (const tier of ['easy', 'medium', 'hard']) {
    for (const [index0, raw] of (data[tier] || []).entries()) {
      const analysis = extractMoverAnalysis(raw, engine)
      if (!analysis) continue
      const key = keyFn(analysis, raw)
      if (!key) continue
      rows.push({ tier, index0, key, analysis })
    }
  }
  const byKey = new Map()
  for (const r of rows) {
    if (!byKey.has(r.key)) byKey.set(r.key, [])
    byKey.get(r.key).push(r)
  }
  const drop = new Set()
  let clusters = 0
  for (const members of byKey.values()) {
    if (members.length < 2) continue
    clusters++
    // already in ledger insertion order within each key
    const keepIdx = Math.floor(members.length / 2)
    for (let i = 0; i < members.length; i++) {
      if (i === keepIdx) continue
      drop.add(`${members[i].tier}|${members[i].index0}`)
    }
  }
  return { data: filterDrop(data, drop), removed: drop.size, clusters }
}

/**
 * Same-shape trail-overlap connected components; keep floor(n/2).
 */
export function cullSameShapeOverlapClumps(data, engine, opts = {}) {
  const minSharedPushes = opts.minSharedPushes ?? DEFAULT_OVERLAP.minSharedPushes
  const minOverlapRatio = opts.minOverlapRatio ?? DEFAULT_OVERLAP.minOverlapRatio

  const rows = []
  for (const tier of ['easy', 'medium', 'hard']) {
    for (const [index0, raw] of (data[tier] || []).entries()) {
      const analysis = extractMoverAnalysis(raw, engine)
      if (!analysis) continue
      rows.push({
        tier,
        index0,
        id: `${tier}|${index0}`,
        raw,
        ...analysis,
      })
    }
  }

  const pairs = []
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const A = rows[i]
      const B = rows[j]
      if (A.size !== B.size) continue
      if (!typeMultisetCompatible(A.movedTypes, B.movedTypes)) continue
      let bestShared = 0
      let bestRatio = 0
      for (let orient = 0; orient < 8; orient++) {
        const aMovers = mapMoversTrail(A.moved, A.size, 0)
        const bMovers = mapMoversTrail(B.moved, B.size, orient)
        const maxP = Math.max(A.pushCount, B.pushCount) || 1
        for (const [short, long] of [
          [aMovers, bMovers],
          [bMovers, aMovers],
        ]) {
          const hit = moversContained(short, long)
          if (!hit.ok || hit.sharedPushes < minSharedPushes) continue
          const ratio = hit.sharedPushes / maxP
          if (hit.sharedPushes > bestShared || ratio > bestRatio) {
            bestShared = hit.sharedPushes
            bestRatio = ratio
          }
        }
      }
      if (bestShared >= minSharedPushes && bestRatio >= minOverlapRatio) {
        pairs.push({ A, B })
      }
    }
  }

  const parent = new Map()
  function find(x) {
    if (!parent.has(x)) parent.set(x, x)
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)))
    return parent.get(x)
  }
  function uni(a, b) {
    a = find(a)
    b = find(b)
    if (a !== b) parent.set(a, b)
  }
  for (const p of pairs) uni(p.A.id, p.B.id)

  const groups = new Map()
  for (const id of parent.keys()) {
    const r = find(id)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r).push(id)
  }

  const byId = new Map(rows.map((r) => [r.id, r]))
  const drop = new Set()
  let clumps = 0
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const shapes = new Set(members.map((id) => byId.get(id).allTypes))
    if (shapes.size !== 1) continue
    clumps++
    const ordered = [...members].sort((a, b) => {
      const A = byId.get(a)
      const B = byId.get(b)
      const ti = TIERS.indexOf(A.tier) - TIERS.indexOf(B.tier)
      return ti || A.index0 - B.index0
    })
    const keepIdx = Math.floor(ordered.length / 2)
    for (let i = 0; i < ordered.length; i++) {
      if (i === keepIdx) continue
      const r = byId.get(ordered[i])
      drop.add(`${r.tier}|${r.index0}`)
    }
  }

  return { data: filterDrop(data, drop), removed: drop.size, clumps }
}

/**
 * Full post-merge polish on daily tiers (tutorial preserved):
 *   exact cells cull → same-shape overlap cull → pushes≥10 rebucket + sort
 */
export function polishScuttlebugDaily(data, engine, opts = {}) {
  const tutorial = data.tutorial || []
  let cur = {
    tutorial,
    easy: [...(data.easy || [])],
    medium: [...(data.medium || [])],
    hard: [...(data.hard || [])],
  }

  const cells = cullExactClusters(cur, engine, (a) => a.cellsKey)
  cur = { tutorial, ...cells.data }
  // re-attach tutorial (filterDrop already keeps it)
  cur.tutorial = tutorial

  const overlap = cullSameShapeOverlapClumps(cur, engine, opts)
  cur = { tutorial, easy: overlap.data.easy, medium: overlap.data.medium, hard: overlap.data.hard }

  const bucketed = rebucketByPushes(cur.easy, cur.medium, cur.hard)
  return {
    tutorial,
    ...bucketed,
    stats: {
      cellsRemoved: cells.removed,
      cellsClusters: cells.clusters,
      overlapRemoved: overlap.removed,
      overlapClumps: overlap.clumps,
      easy: bucketed.easy.length,
      medium: bucketed.medium.length,
      hard: bucketed.hard.length,
    },
  }
}
