/**
 * Flag Dung Beetle puzzles whose solved end states match under rotation/reflection.
 *
 * Replay each official solution, then fingerprint (size + hole + typed pieces)
 * under the 8 dihedral orientations. Same canonical key ⇒ potentially similar.
 * Beetle / start ball are ignored. Ball ends on the hole, so it is omitted.
 *
 *   node tools/tetromino/analyzeEndStateDupes.mjs
 *   node tools/tetromino/analyzeEndStateDupes.mjs --out=tools/reports/dung-end-dupes.csv
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

const outPath = path.resolve(
  repoRoot,
  args.get('out') || 'tools/reports/dung-end-dupes.csv'
)

const TIERS = ['tutorial', 'easy', 'medium', 'hard']

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/dungbeetle/engine.js')).href
)
const { normalizePuzzleInput, initPlayState, tryMove, checkWon } = engine

const data = (
  await import(pathToFileURL(path.join(repoRoot, 'puzzlegames/dungbeetle/puzzles.js')).href)
).default

/** (r,c) under orientation k = 0..3 rotation then optional reflect. */
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

function encodeEndState(size, hole, pieces) {
  const pieceKeys = pieces
    .map((p) => {
      const cells = p.cells
        .map((c) => `${c.r},${c.c}`)
        .sort()
        .join('|')
      return `${p.type}:${cells}`
    })
    .sort()
  return JSON.stringify({
    s: size,
    h: [hole.r, hole.c],
    p: pieceKeys,
  })
}

/** Lex-min encoding over the 8 board orientations. */
export function canonicalEndKey(size, hole, pieces) {
  let best = null
  for (let orient = 0; orient < 8; orient++) {
    const h = mapCell(hole.r, hole.c, size, orient)
    const mapped = pieces.map((piece) => ({
      type: piece.type || '?',
      cells: piece.cells.map((c) => {
        const [r, c2] = mapCell(c.r, c.c, size, orient)
        return { r, c: c2 }
      }),
    }))
    const key = encodeEndState(size, { r: h[0], c: h[1] }, mapped)
    if (best == null || key < best) best = key
  }
  return best
}

function replayToEnd(puzzle, solution) {
  if (typeof solution !== 'string' || !solution) {
    return { ok: false, why: 'missing-solution' }
  }
  let state = initPlayState(puzzle)
  for (const ch of solution) {
    const dir = dirFromSolutionChar(ch)
    if (!dir) return { ok: false, why: `bad-char:${ch}` }
    const move = tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return { ok: false, why: `illegal:${ch}` }
    state = move.state
  }
  if (!checkWon(state)) return { ok: false, why: 'not-won' }
  return {
    ok: true,
    size: state.size,
    hole: { r: state.target.r, c: state.target.c },
    pieces: state.pieces.map((p) => ({
      type: p.type || '?',
      cells: p.cells.map((c) => ({ r: c.r, c: c.c })),
    })),
  }
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
  'solns',
  'glyphs',
  'clusterGlyphs',
  'endKey',
  'status',
  'note',
  'peers',
]

const rows = []
const failRows = []

for (const tier of TIERS) {
  for (const [i, raw] of (data[tier] || []).entries()) {
    const puzzle = normalizePuzzleInput(raw, true)
    const end = replayToEnd(puzzle, raw.solution)
    const base = {
      tier,
      index0: i,
      curateTier: i + 1,
      size: puzzle.size,
      pushes: raw.pushes ?? '',
      ballPushes: raw.ballPushes ?? '',
      blocksMoved: raw.blocksMoved ?? '',
      solns: raw.solns ?? '',
      glyphs: typeof raw.solution === 'string' ? raw.solution.length : 0,
      note: raw.note ?? '',
    }
    if (!end.ok) {
      failRows.push({
        ...base,
        status: end.why,
        endKey: '',
        clusterId: '',
        clusterSize: 1,
        peers: '',
        clusterGlyphs: String(base.glyphs),
      })
      continue
    }
    const endKey = canonicalEndKey(end.size, end.hole, end.pieces)
    rows.push({ ...base, status: 'ok', endKey })
  }
}

/** @type {Map<string, typeof rows>} */
const byKey = new Map()
for (const row of rows) {
  if (!byKey.has(row.endKey)) byKey.set(row.endKey, [])
  byKey.get(row.endKey).push(row)
}

const clusters = [...byKey.entries()]
  .map(([endKey, members]) => ({ endKey, members }))
  .filter((c) => c.members.length > 1)
  .sort((a, b) => b.members.length - a.members.length || a.endKey.localeCompare(b.endKey))

const clusterIdByKey = new Map()
clusters.forEach((c, i) => clusterIdByKey.set(c.endKey, i + 1))

function peerLabel(row) {
  return `${row.tier}#${row.curateTier}(${row.glyphs})`
}

const outRows = []
for (const row of rows) {
  const members = byKey.get(row.endKey) || [row]
  const clusterSize = members.length
  const clusterId = clusterSize > 1 ? clusterIdByKey.get(row.endKey) : ''
  const peers =
    clusterSize > 1
      ? members
          .filter((m) => !(m.tier === row.tier && m.index0 === row.index0))
          .map(peerLabel)
          .join(';')
      : ''
  const clusterGlyphs =
    clusterSize > 1 ? members.map((m) => m.glyphs).join(';') : String(row.glyphs)
  outRows.push({ ...row, clusterId, clusterSize, peers, clusterGlyphs })
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
const uniqueKeys = byKey.size
console.log(
  `wrote ${outPath}\n` +
    `  puzzles ok=${rows.length} failed=${failRows.length}\n` +
    `  unique end keys=${uniqueKeys}\n` +
    `  clusters with 2+=${clusters.length} (${multi.length} puzzles in those clusters)`
)

if (failRows.length) {
  console.log('  replay failures:')
  for (const f of failRows.slice(0, 20)) {
    console.log(`    ${f.tier}#${f.curateTier} ${f.status}`)
  }
}

for (const c of clusters.slice(0, 25)) {
  const id = clusterIdByKey.get(c.endKey)
  const labels = c.members.map(peerLabel).join(', ')
  console.log(`  cluster ${id} n=${c.members.length}: ${labels}`)
}
if (clusters.length > 25) console.log(`  … ${clusters.length - 25} more clusters`)
