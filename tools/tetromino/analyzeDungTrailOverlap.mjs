/**
 * Dung Beetle trail / overlap near-dupes (Scuttle-style), including ball path.
 *
 * Modes (--mode=):
 *   cells   — moved pieces start→end + ball start (D4); scenery ignored
 *   trail   — full per-mover cell trails + ball cell trail (exact D4 match)
 *   overlap — trail containment under D4; ball trail must also nest
 *
 *   node tools/tetromino/analyzeDungTrailOverlap.mjs
 *   node tools/tetromino/analyzeDungTrailOverlap.mjs --mode=trail
 *   node tools/tetromino/analyzeDungTrailOverlap.mjs --mode=overlap
 *   node tools/tetromino/analyzeDungTrailOverlap.mjs --mode=overlap --min-shared-pushes=2
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

const mode = args.get('mode') || 'overlap'
if (!['cells', 'trail', 'overlap'].includes(mode)) {
  console.error(`Unknown --mode=${mode} (use cells|trail|overlap)`)
  process.exit(2)
}

const defaultOut =
  mode === 'cells'
    ? 'tools/reports/dung-moving-core-cells.csv'
    : mode === 'trail'
      ? 'tools/reports/dung-trail-dupes.csv'
      : 'tools/reports/dung-trail-overlap.csv'

const outPath = path.resolve(repoRoot, args.get('out') || defaultOut)
const minSharedPushes = args.has('min-shared-pushes')
  ? Number(args.get('min-shared-pushes'))
  : 2
const minOverlapRatio = args.has('min-overlap-ratio')
  ? Number(args.get('min-overlap-ratio'))
  : 0.85

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

function cellStr(r, c) {
  return `${r},${c}`
}

function snapshotPieces(state) {
  return state.pieces.map((p) => ({
    type: p.type || '?',
    cells: p.cells.map((c) => ({ r: c.r, c: c.c })),
  }))
}

function canonicalCellsKey(size, hole, ballStart, moved) {
  let best = null
  for (let orient = 0; orient < 8; orient++) {
    const h = mapCell(hole.r, hole.c, size, orient)
    const b = mapCell(ballStart.r, ballStart.c, size, orient)
    const pieceKeys = moved
      .map((p) => {
        const start = cellsKey(mapCells(p.start, size, orient))
        const end = cellsKey(mapCells(p.end, size, orient))
        return `${p.type}:${start}>${end}`
      })
      .sort()
    const key = JSON.stringify({ s: size, h, b, m: pieceKeys })
    if (best == null || key < best) best = key
  }
  return best
}

function canonicalTrailKey(size, hole, movers, ballTrail) {
  let best = null
  for (let orient = 0; orient < 8; orient++) {
    const h = mapCell(hole.r, hole.c, size, orient)
    const pieceKeys = movers
      .map((p) => {
        const trail = p.trailCells.map((snap) => cellsKey(mapCells(snap, size, orient)))
        return `${p.type}:${trail.join('>')}`
      })
      .sort()
    const ball = ballTrail.map((c) => {
      const [r, c2] = mapCell(c.r, c.c, size, orient)
      return cellStr(r, c2)
    })
    const key = JSON.stringify({ s: size, h, ball, m: pieceKeys })
    if (best == null || key < best) best = key
  }
  return best
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

function mapBallTrail(ballTrail, size, orient) {
  return ballTrail.map((c) => {
    const [r, c2] = mapCell(c.r, c.c, size, orient)
    return cellStr(r, c2)
  })
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
  const hole = { r: startState.target.r, c: startState.target.c }
  const ballStart = { r: startState.ball.r, c: startState.ball.c }
  const trails = startPieces.map((p) => [p.cells.map((c) => ({ r: c.r, c: c.c }))])
  /** @type {{r:number,c:number}[]} */
  const ballTrail = [{ r: ballStart.r, c: ballStart.c }]

  let state = startState
  const movedIdx = new Set()

  for (const ch of raw.solution) {
    if (checkWon(state)) break
    const dir = dirFromSolutionChar(ch)
    if (!dir) return { ok: false, why: `bad-char:${ch}` }
    const ballBefore = { r: state.ball.r, c: state.ball.c }
    const hit = pieceAtIn(state.pieces, state.player.r + dir.dr, state.player.c + dir.dc)
    const move = tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return { ok: false, why: `illegal:${ch}` }
    if (move.pushedTetromino && hit >= 0) {
      movedIdx.add(hit)
      trails[hit].push(move.state.pieces[hit].cells.map((c) => ({ r: c.r, c: c.c })))
    } else if (
      move.state.ball.r !== ballBefore.r ||
      move.state.ball.c !== ballBefore.c
    ) {
      ballTrail.push({ r: move.state.ball.r, c: move.state.ball.c })
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

  const cellsKeyCanon = canonicalCellsKey(puzzle.size, hole, ballStart, moved)
  const trailKeyCanon = canonicalTrailKey(puzzle.size, hole, moved, ballTrail)
  const pushCount = moved.reduce((n, p) => n + Math.max(0, p.trailCells.length - 1), 0)
  const ballSteps = Math.max(0, ballTrail.length - 1)

  return {
    ok: true,
    size: puzzle.size,
    hole,
    ballStart,
    ballTrail,
    moved,
    cellsKey: cellsKeyCanon,
    trailKey: trailKeyCanon,
    coreKey: mode === 'cells' ? cellsKeyCanon : trailKeyCanon,
    movedCount: movedList.length,
    pieceCount: startPieces.length,
    hasScenery: startPieces.length > movedList.length,
    allTypes,
    movedTypes,
    sceneryTypes,
    pushCount,
    ballSteps,
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
      failRows.push({ ...base, status: core.why })
      continue
    }
    rows.push({
      ...base,
      status: 'ok',
      coreKey: core.coreKey,
      cellsKey: core.cellsKey,
      trailKey: core.trailKey,
      hole: core.hole,
      ballTrail: core.ballTrail,
      moved: core.moved,
      pieceCount: core.pieceCount,
      movedCount: core.movedCount,
      pushCount: core.pushCount,
      ballSteps: core.ballSteps,
      hasScenery: core.hasScenery ? 1 : 0,
      allTypes: core.allTypes,
      movedTypes: core.movedTypes,
      sceneryTypes: core.sceneryTypes,
      size: core.size,
    })
  }
}

if (mode === 'cells' || mode === 'trail') {
  const byKey = new Map()
  for (const row of rows) {
    if (!byKey.has(row.coreKey)) byKey.set(row.coreKey, [])
    byKey.get(row.coreKey).push(row)
  }
  const clusters = [...byKey.entries()]
    .map(([coreKey, members]) => ({ coreKey, members }))
    .filter((c) => c.members.length >= 2)
    .sort(
      (a, b) =>
        b.members.length - a.members.length ||
        (a.members[0].dif ?? 0) - (b.members[0].dif ?? 0)
    )

  const HEADER = [
    'clusterId',
    'clusterSize',
    'tier',
    'curateTier',
    'size',
    'pushes',
    'ballPushes',
    'dif',
    'glyphs',
    'movedTypes',
    'allTypes',
    'hasScenery',
    'peers',
  ]
  const clusterIdByKey = new Map()
  clusters.forEach((c, i) => clusterIdByKey.set(c.coreKey, i + 1))

  const outRows = []
  for (const row of rows) {
    const members = byKey.get(row.coreKey) || [row]
    const cid = clusterIdByKey.get(row.coreKey)
    outRows.push({
      clusterId: cid || '',
      clusterSize: cid ? members.length : 1,
      tier: row.tier,
      curateTier: row.curateTier,
      size: row.size,
      pushes: row.pushes,
      ballPushes: row.ballPushes,
      dif: row.dif,
      glyphs: row.glyphs,
      movedTypes: row.movedTypes,
      allTypes: row.allTypes,
      hasScenery: row.hasScenery,
      peers: cid
        ? members
            .filter((m) => !(m.tier === row.tier && m.index0 === row.index0))
            .map(peerLabel)
            .join(';')
        : '',
    })
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(
    outPath,
    [HEADER.join(','), ...outRows.map((r) => HEADER.map((h) => csvEscape(r[h])).join(','))].join(
      '\n'
    ) + '\n',
    'utf8'
  )

  const byTier = Object.fromEntries(TIERS.map((t) => [t, { clusters: 0, puzzles: 0 }]))
  for (const c of clusters) {
    const tiers = new Set(c.members.map((m) => m.tier))
    for (const t of tiers) {
      // count cluster once under each tier that has a member? Better: attribute to primary
    }
    for (const m of c.members) {
      byTier[m.tier].puzzles++
    }
  }
  // recount clusters per tier (clusters with ≥1 member in tier)
  for (const c of clusters) {
    const seen = new Set()
    for (const m of c.members) {
      if (seen.has(m.tier)) continue
      seen.add(m.tier)
      byTier[m.tier].clusters++
    }
  }

  console.log(
    `mode=${mode}\nwrote ${outPath}\n` +
      `  ok=${rows.length} failed=${failRows.length}\n` +
      `  clusters≥2=${clusters.length} puzzles_in_clusters=${clusters.reduce((s, c) => s + c.members.length, 0)}`
  )
  for (const t of TIERS) {
    console.log(`  ${t}: clusters=${byTier[t].clusters} puzzles_in=${byTier[t].puzzles}`)
  }

  for (const tier of ['easy', 'medium', 'hard']) {
    const c = clusters.find((x) => x.members.some((m) => m.tier === tier) && x.members.length >= 2)
    if (!c) {
      console.log(`\nSpot-check ${tier}: (no cluster)`)
      continue
    }
    console.log(`\nSpot-check ${tier} cluster n=${c.members.length} moved=${c.members[0].movedTypes}:`)
    for (const m of c.members) {
      console.log(
        `  ${peerLabel(m)}[${m.allTypes}] p=${m.pushes} bp=${m.ballPushes} dif=${m.dif} g=${m.glyphs}` +
          (m.hasScenery ? ` scen=${m.sceneryTypes}` : '')
      )
    }
  }
} else {
  // overlap
  const pairs = []
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const A = rows[i]
      const B = rows[j]
      if (A.size !== B.size) continue
      if (!typeMultisetCompatible(A.movedTypes, B.movedTypes)) continue

      let best = null
      const consider = (cand) => {
        if (cand.sharedPushes < minSharedPushes) return
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
        const aBall = mapBallTrail(A.ballTrail, A.size, 0)
        const bBall = mapBallTrail(B.ballTrail, B.size, orient)
        const maxP = Math.max(A.pushCount, B.pushCount) || 1

        const ab = moversContained(aMovers, bMovers)
        if (ab.ok && isSubtrail(aBall, bBall)) {
          consider({
            relation: A.trailKey === B.trailKey ? 'equal-trail' : 'A-subset-of-B',
            sharedPushes: ab.sharedPushes,
            overlapRatio: ab.sharedPushes / maxP,
          })
        }
        const ba = moversContained(bMovers, aMovers)
        if (ba.ok && isSubtrail(bBall, aBall)) {
          consider({
            relation: A.trailKey === B.trailKey ? 'equal-trail' : 'B-subset-of-A',
            sharedPushes: ba.sharedPushes,
            overlapRatio: ba.sharedPushes / maxP,
          })
        }
      }
      if (!best) continue
      pairs.push({ ...best, A, B })
    }
  }

  pairs.sort(
    (a, b) =>
      Number(a.relation === 'equal-trail') - Number(b.relation === 'equal-trail') ||
      b.sharedPushes - a.sharedPushes ||
      b.overlapRatio - a.overlapRatio
  )

  const HEADER = [
    'pairId',
    'relation',
    'sharedPushes',
    'overlapRatio',
    'tierA',
    'curateTierA',
    'tierB',
    'curateTierB',
    'pushesA',
    'pushesB',
    'difA',
    'difB',
    'movedTypesA',
    'movedTypesB',
    'allTypesA',
    'allTypesB',
  ]
  const outRows = pairs.map((p, idx) => ({
    pairId: idx + 1,
    relation: p.relation,
    sharedPushes: p.sharedPushes,
    overlapRatio: p.overlapRatio.toFixed(3),
    tierA: p.A.tier,
    curateTierA: p.A.curateTier,
    tierB: p.B.tier,
    curateTierB: p.B.curateTier,
    pushesA: p.A.pushes,
    pushesB: p.B.pushes,
    difA: p.A.dif,
    difB: p.B.dif,
    movedTypesA: p.A.movedTypes,
    movedTypesB: p.B.movedTypes,
    allTypesA: p.A.allTypes,
    allTypesB: p.B.allTypes,
  }))
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(
    outPath,
    [HEADER.join(','), ...outRows.map((r) => HEADER.map((h) => csvEscape(r[h])).join(','))].join(
      '\n'
    ) + '\n',
    'utf8'
  )

  // same-shape connected components at high ratio
  const high = pairs.filter(
    (p) =>
      p.relation === 'equal-trail' ||
      (p.overlapRatio >= minOverlapRatio && p.sharedPushes >= Math.max(minSharedPushes, 3))
  )
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
  const meta = new Map()
  function idOf(r) {
    return `${r.tier}#${r.curateTier}`
  }
  for (const p of high) {
    uni(idOf(p.A), idOf(p.B))
    meta.set(idOf(p.A), p.A)
    meta.set(idOf(p.B), p.B)
  }
  const groups = new Map()
  for (const x of parent.keys()) {
    const r = find(x)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r).push(x)
  }
  const sameShape = [...groups.values()]
    .filter((g) => g.length >= 2)
    .map((g) => {
      const mem = g.map((id) => meta.get(id)).filter(Boolean)
      const shapes = new Set(mem.map((m) => m.allTypes))
      return { mem, shapes, n: mem.length }
    })
    .filter((c) => c.shapes.size === 1)
    .sort((a, b) => b.n - a.n)

  const proper = pairs.filter((p) => p.relation !== 'equal-trail')
  const equal = pairs.filter((p) => p.relation === 'equal-trail')

  console.log(
    `mode=overlap minShared=${minSharedPushes} minRatio=${minOverlapRatio}\n` +
      `wrote ${outPath}\n` +
      `  ok=${rows.length} failed=${failRows.length}\n` +
      `  pairs=${pairs.length} (equal-trail=${equal.length}, proper=${proper.length})\n` +
      `  same-shape clumps (ratio≥${minOverlapRatio} or equal): ${sameShape.length}`
  )

  const hist = new Map()
  for (const c of sameShape) hist.set(c.n, (hist.get(c.n) || 0) + 1)
  console.log('  size histogram:')
  for (const [n, cnt] of [...hist.entries()].sort((a, b) => b[0] - a[0])) {
    console.log(`    size ${n}: ${cnt}`)
  }

  for (const tier of ['easy', 'medium', 'hard']) {
    const c = sameShape.find((x) => x.mem.some((m) => m.tier === tier) && x.n >= 2)
    if (!c) {
      console.log(`\nSpot-check ${tier}: (no same-shape clump)`)
      continue
    }
    const mem = [...c.mem].sort((a, b) => {
      const ti = TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier)
      return ti || a.index0 - b.index0
    })
    console.log(
      `\nSpot-check ${tier} clump n=${c.n} shape=${[...c.shapes][0]} moved=${mem[0].movedTypes}:`
    )
    for (const m of mem) {
      console.log(
        `  ${peerLabel(m)}[${m.allTypes}] p=${m.pushes} bp=${m.ballPushes} dif=${m.dif} g=${m.glyphs}` +
          ` pushTrail=${m.pushCount} ballSteps=${m.ballSteps}` +
          (m.hasScenery ? ` scen=${m.sceneryTypes}` : '')
      )
    }
  }

  if (failRows.length) {
    console.log('\nReplay failures (first 10):')
    for (const f of failRows.slice(0, 10)) {
      console.log(`  ${f.tier}#${f.curateTier} ${f.status}`)
    }
  }
}
