/**
 * Flag Dung Beetle puzzles that share the same *moving* mechanism under D4.
 *
 * Modes (--mode=):
 *   cells   (default) — moved pieces by type + start/end cell sets (scenery ignored)
 *   st-swap — push choreography (anchor rel. hole + push dirs); S and T aliased as X
 *   anon    — same choreography fingerprint with all mover types anonymous
 *
 *   node tools/tetromino/analyzeMovingCoreDupes.mjs
 *   node tools/tetromino/analyzeMovingCoreDupes.mjs --mode=st-swap
 *   node tools/tetromino/analyzeMovingCoreDupes.mjs --mode=st-swap --st-diff-only
 *   node tools/tetromino/analyzeMovingCoreDupes.mjs --out=tools/reports/dung-moving-core-dupes.csv
 *   node tools/tetromino/analyzeMovingCoreDupes.mjs --min-cluster=2 --scenery-only
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
if (!['cells', 'st-swap', 'anon'].includes(mode)) {
  console.error(`Unknown --mode=${mode} (use cells|st-swap|anon)`)
  process.exit(2)
}

const defaultOut =
  mode === 'cells'
    ? 'tools/reports/dung-moving-core-dupes.csv'
    : mode === 'st-swap'
      ? 'tools/reports/dung-st-swap-dupes.csv'
      : 'tools/reports/dung-anon-choreo-dupes.csv'

const outPath = path.resolve(repoRoot, args.get('out') || defaultOut)
const minCluster = args.has('min-cluster') ? Number(args.get('min-cluster')) : 2
const sceneryOnly = args.has('scenery-only')
/** Only keep clusters whose members are not identical after S/T→X (true S↔T role swaps). */
const stDiffOnly = args.has('st-diff-only')

const TIERS = ['tutorial', 'easy', 'medium', 'hard']

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/dungbeetle/engine.js')).href
)
const { normalizePuzzleInput, initPlayState, tryMove, checkWon, pieceAtIn } = engine

const data = (
  await import(
    pathToFileURL(path.join(repoRoot, 'puzzlegames/dungbeetle/puzzles.js')).href +
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

function mapDir(dr, dc, orient) {
  const rot = orient % 4
  const reflect = orient >= 4
  let rr = dr
  let cc = dc
  for (let i = 0; i < rot; i++) {
    const nr = cc
    const nc = -rr
    rr = nr
    cc = nc
  }
  if (reflect) cc = -cc
  return [rr, cc]
}

function cellsKey(cells) {
  return cells
    .map((c) => `${c.r},${c.c}`)
    .sort()
    .join('|')
}

function encodeCellCore(size, hole, ball, moved) {
  const pieceKeys = moved
    .map((p) => `${p.type}:${cellsKey(p.start)}>${cellsKey(p.end)}`)
    .sort()
  return JSON.stringify({
    s: size,
    h: [hole.r, hole.c],
    b: [ball.r, ball.c],
    m: pieceKeys,
  })
}

export function canonicalMovingCoreKey(size, hole, ball, moved) {
  let best = null
  for (let orient = 0; orient < 8; orient++) {
    const h = mapCell(hole.r, hole.c, size, orient)
    const b = mapCell(ball.r, ball.c, size, orient)
    const mapped = moved.map((p) => ({
      type: p.type || '?',
      start: p.start.map((c) => {
        const [r, c2] = mapCell(c.r, c.c, size, orient)
        return { r, c: c2 }
      }),
      end: p.end.map((c) => {
        const [r, c2] = mapCell(c.r, c.c, size, orient)
        return { r, c: c2 }
      }),
    }))
    const key = encodeCellCore(size, { r: h[0], c: h[1] }, { r: b[0], c: b[1] }, mapped)
    if (best == null || key < best) best = key
  }
  return best
}

function typeNorm(t) {
  if (mode === 'anon') return '?'
  if (mode === 'st-swap') return t === 'S' || t === 'T' ? 'X' : t
  return t
}

function aliasTypes(s) {
  return String(s || '')
    .replace(/S/g, 'X')
    .replace(/T/g, 'X')
}

function lexAnchor(cells) {
  return cells.slice().sort((a, b) => a.r - b.r || a.c - b.c)[0]
}

function snapshotPieces(state) {
  return state.pieces.map((p) => ({
    type: p.type || '?',
    cells: p.cells.map((c) => ({ r: c.r, c: c.c })),
  }))
}

function canonicalChoreoKey(size, hole, ball, movers) {
  let best = null
  for (let orient = 0; orient < 8; orient++) {
    const h = mapCell(hole.r, hole.c, size, orient)
    const b = mapCell(ball.r, ball.c, size, orient)
    const br = [b[0] - h[0], b[1] - h[1]]
    const m = movers.map((p) => {
      const a = mapCell(p.anchor.r, p.anchor.c, size, orient)
      const dirs = p.dirs
        .map(([dr, dc]) => {
          const [x, y] = mapDir(dr, dc, orient)
          return `${x},${y}`
        })
        .join(';')
      return {
        type: p.type,
        rel: `${a[0] - h[0]},${a[1] - h[1]}`,
        dirs,
      }
    })
    m.sort(
      (A, B) =>
        A.type.localeCompare(B.type) ||
        A.rel.localeCompare(B.rel) ||
        A.dirs.localeCompare(B.dirs)
    )
    const key = JSON.stringify({
      s: size,
      br,
      m: m.map((x) => `${x.type}@${x.rel}#${x.dirs}`),
    })
    if (best == null || key < best) best = key
  }
  return best
}

/**
 * Replay solution; return fingerprint fields or { ok:false, why }.
 */
function extractCore(raw) {
  if (typeof raw.solution !== 'string' || !raw.solution) {
    return { ok: false, why: 'missing-solution' }
  }
  let puzzle
  try {
    puzzle = normalizePuzzleInput(raw, true)
  } catch (e) {
    return { ok: false, why: `normalize:${e.message || e}` }
  }

  const startState = initPlayState(puzzle)
  const startPieces = snapshotPieces(startState)
  const ballStart = { r: startState.ball.r, c: startState.ball.c }
  const hole = { r: startState.target.r, c: startState.target.c }

  let state = startState
  const movedIdx = new Set()
  const pushDirs = startPieces.map(() => [])

  for (const ch of raw.solution) {
    if (checkWon(state)) break
    const dir = dirFromSolutionChar(ch)
    if (!dir) return { ok: false, why: `bad-char:${ch}` }
    const hit = pieceAtIn(state.pieces, state.player.r + dir.dr, state.player.c + dir.dc)
    const move = tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return { ok: false, why: `illegal:${ch}` }
    if (move.pushedTetromino && hit >= 0) {
      movedIdx.add(hit)
      pushDirs[hit].push([dir.dr, dir.dc])
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

  let coreKey
  if (mode === 'cells') {
    const moved = movedList.map((i) => ({
      type: startPieces[i].type,
      start: startPieces[i].cells,
      end: endPieces[i].cells,
    }))
    coreKey = canonicalMovingCoreKey(puzzle.size, hole, ballStart, moved)
  } else {
    const movers = movedList.map((i) => ({
      type: typeNorm(startPieces[i].type),
      anchor: lexAnchor(startPieces[i].cells),
      dirs: pushDirs[i],
    }))
    coreKey = canonicalChoreoKey(puzzle.size, hole, ballStart, movers)
  }

  return {
    ok: true,
    size: puzzle.size,
    coreKey,
    movedCount: movedList.length,
    pieceCount: startPieces.length,
    hasScenery: startPieces.length > movedList.length,
    allTypes,
    movedTypes,
    sceneryTypes,
  }
}

/** True if cluster members differ only by S↔T after aliasing. */
function isStRoleSwapCluster(members) {
  const raws = new Set(members.map((m) => m.allTypes))
  const aliased = new Set(members.map((m) => aliasTypes(m.allTypes)))
  if (raws.size < 2) return false
  if (aliased.size !== 1) return false
  const hasS = [...raws].some((s) => s.includes('S'))
  const hasT = [...raws].some((s) => s.includes('T'))
  return hasS && hasT
}

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const HEADER = [
  'clusterId',
  'clusterSize',
  'tier',
  'index0',
  'curateTier',
  'size',
  'pushes',
  'ballPushes',
  'blocksMoved',
  'dif',
  'solns',
  'glyphs',
  'pieceCount',
  'movedCount',
  'hasScenery',
  'allTypes',
  'movedTypes',
  'sceneryTypes',
  'stRoleSwap',
  'coreKey',
  'status',
  'note',
  'peers',
  'peerShapes',
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
      ballPushes: raw.ballPushes ?? '',
      blocksMoved: raw.blocksMoved ?? '',
      dif: raw.dif ?? '',
      solns: raw.solns ?? '',
      glyphs: typeof raw.solution === 'string' ? raw.solution.length : 0,
      note: raw.note ?? '',
    }
    if (!core.ok) {
      failRows.push({
        ...base,
        status: core.why,
        coreKey: '',
        pieceCount: '',
        movedCount: '',
        hasScenery: '',
        allTypes: '',
        movedTypes: '',
        sceneryTypes: '',
        stRoleSwap: '',
        clusterId: '',
        clusterSize: 1,
        peers: '',
        peerShapes: '',
      })
      continue
    }
    rows.push({
      ...base,
      status: 'ok',
      coreKey: core.coreKey,
      pieceCount: core.pieceCount,
      movedCount: core.movedCount,
      hasScenery: core.hasScenery ? 1 : 0,
      allTypes: core.allTypes,
      movedTypes: core.movedTypes,
      sceneryTypes: core.sceneryTypes,
    })
  }
}

/** @type {Map<string, typeof rows>} */
const byKey = new Map()
for (const row of rows) {
  if (!byKey.has(row.coreKey)) byKey.set(row.coreKey, [])
  byKey.get(row.coreKey).push(row)
}

let clusters = [...byKey.entries()]
  .map(([coreKey, members]) => ({
    coreKey,
    members,
    stRoleSwap: isStRoleSwapCluster(members),
  }))
  .filter((c) => c.members.length >= minCluster)

if (sceneryOnly) {
  clusters = clusters.filter((c) => c.members.some((m) => m.hasScenery === 1))
}
if (stDiffOnly) {
  clusters = clusters.filter((c) => c.stRoleSwap)
}

clusters.sort(
  (a, b) =>
    Number(b.stRoleSwap) - Number(a.stRoleSwap) ||
    b.members.length - a.members.length ||
    (a.members[0].pushes ?? 0) - (b.members[0].pushes ?? 0) ||
    a.coreKey.localeCompare(b.coreKey)
)

const clusterIdByKey = new Map()
clusters.forEach((c, i) => clusterIdByKey.set(c.coreKey, i + 1))

function peerLabel(row) {
  return `${row.tier}#${row.curateTier}`
}

const outRows = []
for (const row of rows) {
  const members = byKey.get(row.coreKey) || [row]
  const inReportCluster = clusterIdByKey.has(row.coreKey)
  const clusterSize = members.length
  const clusterId = inReportCluster ? clusterIdByKey.get(row.coreKey) : ''
  const stRoleSwap = inReportCluster
    ? isStRoleSwapCluster(members)
      ? 1
      : 0
    : ''
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
    stRoleSwap,
    peers,
    peerShapes,
  })
}
for (const row of failRows) outRows.push(row)

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
  [HEADER.join(','), ...outRows.map((r) => HEADER.map((h) => csvEscape(r[h])).join(','))].join(
    '\n'
  ) + '\n',
  'utf8'
)

const multi = outRows.filter((r) => r.clusterSize > 1)
const stClusters = clusters.filter((c) => c.stRoleSwap)
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
    `  S↔T role-swap clusters=${stClusters.length}\n` +
    `  scenery / mixed-shape clusters=${sceneryClusters.length}`
)

if (failRows.length) {
  console.log('  replay failures:')
  for (const f of failRows.slice(0, 20)) {
    console.log(`    ${f.tier}#${f.curateTier} ${f.status}`)
  }
}

const highlight =
  mode === 'st-swap' || mode === 'anon'
    ? [...stClusters, ...clusters.filter((c) => !c.stRoleSwap)].slice(0, 50)
    : [...sceneryClusters, ...clusters.filter((c) => !sceneryClusters.includes(c))].slice(0, 40)

console.log(
  mode === 'st-swap' || mode === 'anon'
    ? '\nClusters (S↔T role-swaps first):'
    : '\nTop clusters (scenery / mixed shapes first):'
)

for (const c of highlight) {
  const id = clusterIdByKey.get(c.coreKey)
  const labels = c.members
    .map(
      (m) =>
        `${peerLabel(m)}[${m.allTypes} move=${m.movedTypes || '-'} scen=${m.sceneryTypes || '-'}]`
    )
    .join(', ')
  const tags = []
  if (c.stRoleSwap) tags.push('S↔T')
  if (new Set(c.members.map((m) => m.allTypes)).size > 1) tags.push('MIXED-SHAPES')
  console.log(
    `  #${id} n=${c.members.length} pushes=${c.members[0].pushes} moved=${c.members[0].movedTypes}` +
      (tags.length ? ` ${tags.join(' ')}` : '') +
      `\n    ${labels}`
  )
}
if (clusters.length > highlight.length) {
  console.log(`  … ${clusters.length - highlight.length} more clusters in CSV`)
}
