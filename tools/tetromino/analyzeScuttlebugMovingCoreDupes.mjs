/**
 * Flag Scuttlebug puzzles that share the same *moving* mechanism under D4.
 *
 * Modes (--mode=):
 *   cells   (default) — moved pieces by type + start/end cell sets (scenery ignored)
 *   trail   — full per-mover cell-set trails (start + after each push), exact match
 *   overlap — trail containment / suffix (A's trails ⊆ B's under some D4 + type match)
 *
 *   node tools/tetromino/analyzeScuttlebugMovingCoreDupes.mjs
 *   node tools/tetromino/analyzeScuttlebugMovingCoreDupes.mjs --mode=trail
 *   node tools/tetromino/analyzeScuttlebugMovingCoreDupes.mjs --mode=overlap
 *   node tools/tetromino/analyzeScuttlebugMovingCoreDupes.mjs --mode=overlap --min-shared-pushes=2
 *   node tools/tetromino/analyzeScuttlebugMovingCoreDupes.mjs --out=tools/reports/scuttle-moving-core-dupes.csv
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { dirFromSolutionChar } from './pushEngine.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const args = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const eq = a.indexOf('=')
      return eq === -1 ? [a.slice(2), 'true'] : [a.slice(2, eq), a.slice(eq + 1)]
    })
)

const mode = args.get('mode') || 'cells'
if (!['cells', 'trail', 'overlap'].includes(mode)) {
  console.error(`Unknown --mode=${mode} (use cells|trail|overlap)`)
  process.exit(2)
}

const defaultOut =
  mode === 'cells'
    ? 'tools/reports/scuttle-moving-core-dupes.csv'
    : mode === 'trail'
      ? 'tools/reports/scuttle-trail-dupes.csv'
      : 'tools/reports/scuttle-trail-overlap.csv'

const outPath = path.resolve(repoRoot, args.get('out') || defaultOut)
const minCluster = args.has('min-cluster') ? Number(args.get('min-cluster')) : 2
const sceneryOnly = args.has('scenery-only')
/** Min total push steps on the shorter side for an overlap pair to count. */
const minSharedPushes = args.has('min-shared-pushes')
  ? Number(args.get('min-shared-pushes'))
  : 2
/** Min overlap ratio = sharedPushes / max(pushesA, pushesB) for soft Jaccard pairs. */
const minOverlapRatio = args.has('min-overlap-ratio')
  ? Number(args.get('min-overlap-ratio'))
  : 0.75

const TIERS = ['tutorial', 'easy', 'medium', 'hard']

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/scuttlebug/engine.js')).href
)
const { normalizePuzzleInput, initPlayState, tryMove, checkWon, pieceAtIn } = engine

const data = (
  await import(
    pathToFileURL(path.join(repoRoot, 'puzzlegames/scuttlebug/puzzles.js')).href +
      `?t=${Date.now()}`
  )
).default

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
  return JSON.stringify({
    s: size,
    h: [hole.r, hole.c],
    m: pieceKeys,
  })
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

function encodeTrailCore(size, hole, movers) {
  const pieceKeys = movers
    .map((p) => `${p.type}:${p.trail.join('>')}`)
    .sort()
  return JSON.stringify({
    s: size,
    h: [hole.r, hole.c],
    m: pieceKeys,
  })
}

/** D4-min trail fingerprint (absolute cell sets after mapping). */
function canonicalTrailKey(size, hole, movers) {
  let best = null
  for (let orient = 0; orient < 8; orient++) {
    const h = mapCell(hole.r, hole.c, size, orient)
    const mapped = movers.map((p) => ({
      type: p.type || '?',
      trail: p.trailCells.map((snap) => cellsKey(mapCells(snap, size, orient))),
    }))
    const key = encodeTrailCore(size, { r: h[0], c: h[1] }, mapped)
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

/**
 * Contiguous sub-trail: short's snapshots appear in order as a window of long.
 * trail entries are cellsKey strings.
 */
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

/** Shared push count for a subtrail match (snapshots − 1). */
function subtrailSharedPushes(shortTrail) {
  return Math.max(0, shortTrail.length - 1)
}

/**
 * Can every mover in `short` be matched to a distinct same-type mover in `long`
 * whose trail contains short's trail as a contiguous window?
 * Returns { ok, sharedPushes } where sharedPushes sums shorter-side pushes.
 */
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
    sharedPushes += subtrailSharedPushes(s.trail)
  }
  return { ok: true, sharedPushes }
}

function mapMoversTrail(movers, size, orient) {
  return movers.map((p) => ({
    type: p.type || '?',
    trail: p.trailCells.map((snap) => cellsKey(mapCells(snap, size, orient))),
  }))
}

/**
 * Replay solution; return movers with start/end/trails or { ok:false, why }.
 */
function extractCore(raw) {
  if (typeof raw.solution !== 'string' || !raw.solution) {
    return { ok: false, why: 'missing-solution' }
  }
  let puzzle
  try {
    puzzle = normalizePuzzleInput(raw, false)
  } catch (e) {
    return { ok: false, why: `normalize:${e.message || e}` }
  }

  const startState = initPlayState(puzzle)
  const startPieces = snapshotPieces(startState)
  const hole = { r: startState.target.r, c: startState.target.c }

  /** @type {Array<Array<{r:number,c:number}>>} */
  const trails = startPieces.map((p) => [p.cells.map((c) => ({ r: c.r, c: c.c }))])

  let state = startState
  const movedIdx = new Set()

  for (const ch of raw.solution) {
    if (checkWon(state)) break
    const dir = dirFromSolutionChar(ch)
    if (!dir) return { ok: false, why: `bad-char:${ch}` }
    const hit = pieceAtIn(state.pieces, state.player.r + dir.dr, state.player.c + dir.dc)
    const move = tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return { ok: false, why: `illegal:${ch}` }
    if (move.pushedTetromino && hit >= 0) {
      movedIdx.add(hit)
      const snap = move.state.pieces[hit].cells.map((c) => ({ r: c.r, c: c.c }))
      trails[hit].push(snap)
    }
    state = move.state
  }
  if (!checkWon(state)) return { ok: false, why: 'not-won' }

  const endPieces = snapshotPieces(state)
  const movedList = [...movedIdx].sort((a, b) => a - b)

  const allTypes = startPieces
    .map((p) => p.type)
    .sort()
    .join('')
  const movedTypes = movedList
    .map((i) => startPieces[i].type)
    .sort()
    .join('')
  const sceneryTypes = startPieces
    .filter((_, i) => !movedIdx.has(i))
    .map((p) => p.type)
    .sort()
    .join('')

  const moved = movedList.map((i) => ({
    type: startPieces[i].type,
    start: startPieces[i].cells,
    end: endPieces[i].cells,
    trailCells: trails[i],
  }))

  const cellsKeyCanon = canonicalMovingCoreKey(puzzle.size, hole, moved)
  const trailKeyCanon = canonicalTrailKey(puzzle.size, hole, moved)
  const pushCount = moved.reduce((n, p) => n + Math.max(0, p.trailCells.length - 1), 0)

  return {
    ok: true,
    size: puzzle.size,
    hole,
    moved,
    cellsKey: cellsKeyCanon,
    trailKey: trailKeyCanon,
    coreKey: mode === 'trail' || mode === 'overlap' ? trailKeyCanon : cellsKeyCanon,
    movedCount: movedList.length,
    pieceCount: startPieces.length,
    hasScenery: startPieces.length > movedList.length,
    allTypes,
    movedTypes,
    sceneryTypes,
    pushCount,
  }
}

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function peerLabel(row) {
  return `${row.tier}#${row.curateTier}`
}

const HEADER_CLUSTER = [
  'clusterId',
  'clusterSize',
  'tier',
  'index0',
  'curateTier',
  'size',
  'pushes',
  'blocksMoved',
  'solns',
  'glyphs',
  'pieceCount',
  'movedCount',
  'pushCount',
  'hasScenery',
  'allTypes',
  'movedTypes',
  'sceneryTypes',
  'coreKey',
  'status',
  'note',
  'peers',
  'peerShapes',
]

const HEADER_OVERLAP = [
  'pairId',
  'relation',
  'sharedPushes',
  'overlapRatio',
  'tierA',
  'index0A',
  'curateTierA',
  'tierB',
  'index0B',
  'curateTierB',
  'size',
  'pushesA',
  'pushesB',
  'movedTypesA',
  'movedTypesB',
  'allTypesA',
  'allTypesB',
  'glyphsA',
  'glyphsB',
  'hasSceneryA',
  'hasSceneryB',
  'noteA',
  'noteB',
]

const rows = []
const failRows = []

for (const tier of TIERS) {
  for (const [i, raw] of (data[tier] || []).entries()) {
    const core = extractCore(raw)
    const base = {
      tier,
      index0: i,
      curateTier: i + 1,
      size: raw.size ?? '',
      pushes: raw.pushes ?? '',
      blocksMoved: raw.blocksMoved ?? '',
      solns: raw.solns ?? '',
      glyphs: typeof raw.solution === 'string' ? raw.solution.length : 0,
      note: raw.note ?? '',
      raw,
    }
    if (!core.ok) {
      failRows.push({
        ...base,
        status: core.why,
        coreKey: '',
        pieceCount: '',
        movedCount: '',
        pushCount: '',
        hasScenery: '',
        allTypes: '',
        movedTypes: '',
        sceneryTypes: '',
      })
      continue
    }
    rows.push({
      ...base,
      status: 'ok',
      coreKey: core.coreKey,
      cellsKey: core.cellsKey,
      trailKey: core.trailKey,
      hole: core.hole,
      moved: core.moved,
      pieceCount: core.pieceCount,
      movedCount: core.movedCount,
      pushCount: core.pushCount,
      hasScenery: core.hasScenery ? 1 : 0,
      allTypes: core.allTypes,
      movedTypes: core.movedTypes,
      sceneryTypes: core.sceneryTypes,
      size: core.size,
    })
  }
}

function writeClusterReport(byKey, clusters, clusterIdByKey) {
  const outRows = []
  for (const row of rows) {
    const members = byKey.get(row.coreKey) || [row]
    const inReportCluster = clusterIdByKey.has(row.coreKey)
    const clusterSize = members.length
    const clusterId = inReportCluster ? clusterIdByKey.get(row.coreKey) : ''
    const peers =
      inReportCluster && clusterSize > 1
        ? members
            .filter((m) => !(m.tier === row.tier && m.index0 === row.index0))
            .map(peerLabel)
            .join(';')
        : ''
    const peerShapes =
      inReportCluster && clusterSize > 1
        ? members.map((m) => `${peerLabel(m)}:${m.allTypes}`).join(';')
        : ''
    outRows.push({
      ...row,
      clusterId,
      clusterSize: inReportCluster ? clusterSize : 1,
      peers,
      peerShapes,
    })
  }
  for (const row of failRows) {
    outRows.push({
      ...row,
      clusterId: '',
      clusterSize: 1,
      peers: '',
      peerShapes: '',
    })
  }

  outRows.sort((a, b) => {
    const as = a.clusterSize || 1
    const bs = b.clusterSize || 1
    if (bs !== as) return bs - as
    const ai = a.clusterId || 0
    const bi = b.clusterId || 0
    if (ai !== bi) return ai - bi
    const ti = TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier)
    if (ti !== 0) return ti
    return a.index0 - b.index0
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(
    outPath,
    [
      HEADER_CLUSTER.join(','),
      ...outRows.map((r) => HEADER_CLUSTER.map((h) => csvEscape(r[h])).join(',')),
    ].join('\n') + '\n',
    'utf8'
  )

  const multi = outRows.filter((r) => r.clusterSize > 1)
  const sceneryClusters = clusters.filter((c) => {
    const shapes = new Set(c.members.map((m) => m.allTypes))
    return shapes.size > 1 || c.members.some((m) => m.hasScenery === 1)
  })

  console.log(
    `mode=${mode}\n` +
      `wrote ${outPath}\n` +
      `  puzzles ok=${rows.length} failed=${failRows.length}\n` +
      `  unique keys=${byKey.size}\n` +
      `  clusters with ≥${minCluster}=${clusters.length} (${multi.length} puzzles in those clusters)\n` +
      `  scenery / mixed-shape clusters=${sceneryClusters.length}`
  )

  if (failRows.length) {
    console.log('  replay failures:')
    for (const f of failRows.slice(0, 20)) {
      console.log(`    ${f.tier}#${f.curateTier} ${f.status}`)
    }
  }

  const highlight = [
    ...sceneryClusters,
    ...clusters.filter((c) => !sceneryClusters.includes(c)),
  ].slice(0, 50)

  console.log('\nTop clusters (scenery / mixed shapes first):')
  for (const c of highlight) {
    const id = clusterIdByKey.get(c.coreKey)
    const labels = c.members
      .map(
        (m) =>
          `${peerLabel(m)}[${m.allTypes} move=${m.movedTypes || '-'} scen=${m.sceneryTypes || '-'} p=${m.pushes} g=${m.glyphs}]`
      )
      .join(', ')
    const tags = []
    if (new Set(c.members.map((m) => m.allTypes)).size > 1) tags.push('MIXED-SHAPES')
    if (c.members.some((m) => m.hasScenery === 1) && c.members.some((m) => m.hasScenery === 0)) {
      tags.push('SCENERY-DIFF')
    }
    console.log(
      `  #${id} n=${c.members.length} moved=${c.members[0].movedTypes}` +
        (tags.length ? ` ${tags.join(' ')}` : '') +
        `\n    ${labels}`
    )
  }
  if (clusters.length > highlight.length) {
    console.log(`  … ${clusters.length - highlight.length} more clusters in CSV`)
  }
}

if (mode === 'cells' || mode === 'trail') {
  /** @type {Map<string, typeof rows>} */
  const byKey = new Map()
  for (const row of rows) {
    if (!byKey.has(row.coreKey)) byKey.set(row.coreKey, [])
    byKey.get(row.coreKey).push(row)
  }

  let clusters = [...byKey.entries()]
    .map(([coreKey, members]) => ({ coreKey, members }))
    .filter((c) => c.members.length >= minCluster)

  if (sceneryOnly) {
    clusters = clusters.filter((c) => c.members.some((m) => m.hasScenery === 1))
  }

  clusters.sort(
    (a, b) =>
      b.members.length - a.members.length ||
      (a.members[0].pushes ?? 0) - (b.members[0].pushes ?? 0) ||
      a.coreKey.localeCompare(b.coreKey)
  )

  const clusterIdByKey = new Map()
  clusters.forEach((c, i) => clusterIdByKey.set(c.coreKey, i + 1))
  writeClusterReport(byKey, clusters, clusterIdByKey)
} else {
  // overlap: pairwise trail containment under D4
  const pairs = []
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const A = rows[i]
      const B = rows[j]
      if (A.size !== B.size) continue
      // Quick type filter: moved type multisets must be compatible (one ⊆ other as multiset)
      const aTypes = A.movedTypes
      const bTypes = B.movedTypes
      if (!typeMultisetCompatible(aTypes, bTypes)) continue

      let best = null
      const consider = (cand) => {
        if (cand.sharedPushes < minSharedPushes) return
        // Equal / proper containment always kept; soft high-ratio only needed if we add looser matchers later
        if (
          !best ||
          cand.sharedPushes > best.sharedPushes ||
          (cand.sharedPushes === best.sharedPushes && cand.overlapRatio > best.overlapRatio)
        ) {
          best = cand
        }
      }

      for (let orient = 0; orient < 8; orient++) {
        const aMovers = mapMoversTrail(A.moved, A.size, 0)
        const bMovers = mapMoversTrail(B.moved, B.size, orient)
        const maxP = Math.max(A.pushCount, B.pushCount) || 1

        const ab = moversContained(aMovers, bMovers)
        if (ab.ok) {
          consider({
            relation: A.trailKey === B.trailKey ? 'equal-trail' : 'A-subset-of-B',
            sharedPushes: ab.sharedPushes,
            overlapRatio: ab.sharedPushes / maxP,
            orient,
          })
        }

        const ba = moversContained(bMovers, aMovers)
        if (ba.ok) {
          consider({
            relation: A.trailKey === B.trailKey ? 'equal-trail' : 'B-subset-of-A',
            sharedPushes: ba.sharedPushes,
            overlapRatio: ba.sharedPushes / maxP,
            orient,
          })
        }
      }

      if (!best) continue
      pairs.push({
        ...best,
        A,
        B,
      })
    }
  }

  // Prefer proper containment / high shared; drop pure equal if desired — keep all
  pairs.sort(
    (a, b) =>
      Number(a.relation === 'equal-trail') - Number(b.relation === 'equal-trail') ||
      b.sharedPushes - a.sharedPushes ||
      b.overlapRatio - a.overlapRatio ||
      TIERS.indexOf(a.A.tier) - TIERS.indexOf(b.A.tier)
  )

  const proper = pairs.filter((p) => p.relation !== 'equal-trail')
  const equal = pairs.filter((p) => p.relation === 'equal-trail')

  const outRows = pairs.map((p, idx) => ({
    pairId: idx + 1,
    relation: p.relation,
    sharedPushes: p.sharedPushes,
    overlapRatio: p.overlapRatio.toFixed(3),
    tierA: p.A.tier,
    index0A: p.A.index0,
    curateTierA: p.A.curateTier,
    tierB: p.B.tier,
    index0B: p.B.index0,
    curateTierB: p.B.curateTier,
    size: p.A.size,
    pushesA: p.A.pushes,
    pushesB: p.B.pushes,
    movedTypesA: p.A.movedTypes,
    movedTypesB: p.B.movedTypes,
    allTypesA: p.A.allTypes,
    allTypesB: p.B.allTypes,
    glyphsA: p.A.glyphs,
    glyphsB: p.B.glyphs,
    hasSceneryA: p.A.hasScenery,
    hasSceneryB: p.B.hasScenery,
    noteA: p.A.note,
    noteB: p.B.note,
  }))

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(
    outPath,
    [
      HEADER_OVERLAP.join(','),
      ...outRows.map((r) => HEADER_OVERLAP.map((h) => csvEscape(r[h])).join(',')),
    ].join('\n') + '\n',
    'utf8'
  )

  console.log(
    `mode=overlap minSharedPushes=${minSharedPushes} minOverlapRatio=${minOverlapRatio}\n` +
      `wrote ${outPath}\n` +
      `  puzzles ok=${rows.length} failed=${failRows.length}\n` +
      `  pairs=${pairs.length} (equal-trail=${equal.length}, proper-containment=${proper.length})`
  )

  if (failRows.length) {
    console.log('  replay failures:')
    for (const f of failRows.slice(0, 20)) {
      console.log(`    ${f.tier}#${f.curateTier} ${f.status}`)
    }
  }

  console.log('\nProper containment / suffix pairs (pre-shifted starts):')
  for (const p of proper.slice(0, 60)) {
    const a = `${peerLabel(p.A)}[${p.A.allTypes} move=${p.A.movedTypes} p=${p.A.pushes} g=${p.A.glyphs}]`
    const b = `${peerLabel(p.B)}[${p.B.allTypes} move=${p.B.movedTypes} p=${p.B.pushes} g=${p.B.glyphs}]`
    console.log(
      `  ${p.relation} sharedPushes=${p.sharedPushes} ratio=${p.overlapRatio.toFixed(2)}\n    ${a}\n    ${b}`
    )
  }
  if (proper.length > 60) console.log(`  … ${proper.length - 60} more proper pairs in CSV`)

  console.log(`\nEqual-trail pairs: ${equal.length} (see CSV; also covered by --mode=trail)`)
}

/** Multiset of chars in a sorted type string — one must be submultiset of the other. */
function typeMultisetCompatible(a, b) {
  if (a === b) return true
  const count = (s) => {
    const m = new Map()
    for (const ch of s) m.set(ch, (m.get(ch) || 0) + 1)
    return m
  }
  const A = count(a)
  const B = count(b)
  const aSubB = [...A].every(([k, v]) => (B.get(k) || 0) >= v)
  const bSubA = [...B].every(([k, v]) => (A.get(k) || 0) >= v)
  return aSubB || bSubA
}
