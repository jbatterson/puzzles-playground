import fs from 'node:fs/promises'
import path from 'node:path'
import puzzles from '../../puzzlegames/productiles/puzzles.js'

function parseArgs(argv) {
  const args = {
    maxNodes: 300_000,
    maxDepth: Number.POSITIVE_INFINITY,
    outPath: 'tools/reports/productiles-hard-alt-solutions.json',
    deck: 'hard',
    indices: null,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--max-nodes') args.maxNodes = Number(argv[++i])
    else if (a === '--max-depth') args.maxDepth = Number(argv[++i])
    else if (a === '--out') args.outPath = argv[++i]
    else if (a === '--deck') {
      const d = String(argv[++i] || '').toLowerCase()
      if (d === 'easy' || d === 'medium' || d === 'hard') args.deck = d
    } else if (a === '--indices') {
      args.indices = String(argv[++i])
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
    }
  }
  return args
}

function allowedAxes(tile) {
  const sq = tile.w === tile.h
  return { h: sq || tile.w > tile.h, v: sq || tile.h > tile.w }
}

function stateKey(pos) {
  return pos.map((p) => `${p.r},${p.c}`).join('|')
}

function computeProductsFromState(fixed, pos) {
  const curR = new Array(fixed.size).fill(1)
  const curC = new Array(fixed.size).fill(1)
  for (let i = 0; i < fixed.tiles.length; i++) {
    const t = fixed.tiles[i]
    const base = pos[i]
    for (let rr = 0; rr < t.h; rr++) {
      for (let cc = 0; cc < t.w; cc++) {
        const v = t.vals[rr * t.w + cc]
        if (!v) continue
        curR[base.r + rr] *= v
        curC[base.c + cc] *= v
      }
    }
  }
  return { curR, curC }
}

function isSolvedState(fixed, pos) {
  const { curR, curC } = computeProductsFromState(fixed, pos)
  for (let i = 0; i < fixed.size; i++) {
    if (curR[i] !== fixed.targets.rows[i]) return false
    if (curC[i] !== fixed.targets.cols[i]) return false
  }
  return true
}

function numberArrangementSignature(fixed, pos) {
  const grid = Array.from({ length: fixed.size }, () => new Array(fixed.size).fill(0))
  for (let i = 0; i < fixed.tiles.length; i++) {
    const t = fixed.tiles[i]
    const base = pos[i]
    for (let rr = 0; rr < t.h; rr++) {
      for (let cc = 0; cc < t.w; cc++) {
        const v = t.vals[rr * t.w + cc] || 0
        if (v) grid[base.r + rr][base.c + cc] = v
      }
    }
  }
  return grid.map((row) => row.join(',')).join('|')
}

function buildOccupancy(fixed, pos) {
  const occ = Array.from({ length: fixed.size }, () => new Array(fixed.size).fill(-1))
  for (let i = 0; i < fixed.tiles.length; i++) {
    const t = fixed.tiles[i]
    const base = pos[i]
    for (let rr = 0; rr < t.h; rr++) {
      for (let cc = 0; cc < t.w; cc++) occ[base.r + rr][base.c + cc] = i
    }
  }
  return occ
}

function leadingEdgeCells(tile, base, axis, dir) {
  const cells = []
  if (axis === 'h') {
    const col = base.c + (dir > 0 ? tile.w : -1)
    for (let rr = 0; rr < tile.h; rr++) cells.push([base.r + rr, col])
  } else {
    const row = base.r + (dir > 0 ? tile.h : -1)
    for (let cc = 0; cc < tile.w; cc++) cells.push([row, base.c + cc])
  }
  return cells
}

function canPush(fixed, pos, occ, idx, axis, dir, visiting) {
  if (visiting.has(idx)) return true
  visiting.add(idx)
  const tile = fixed.tiles[idx]
  const base = pos[idx]
  const ax = allowedAxes(tile)
  if (axis === 'h' && !ax.h) return false
  if (axis === 'v' && !ax.v) return false
  const nr = base.r + (axis === 'v' ? dir : 0)
  const nc = base.c + (axis === 'h' ? dir : 0)
  if (nr < 0 || nc < 0 || nr + tile.h > fixed.size || nc + tile.w > fixed.size) return false
  const edge = leadingEdgeCells(tile, base, axis, dir)
  for (const [r, c] of edge) {
    const b = occ[r]?.[c]
    if (b === -1 || b === idx) continue
    if (!canPush(fixed, pos, occ, b, axis, dir, visiting)) return false
  }
  return true
}

function applyMoveGrid(fixed, pos, idx, axis, dir) {
  const occ = buildOccupancy(fixed, pos)
  if (!canPush(fixed, pos, occ, idx, axis, dir, new Set())) return null
  const newPos = pos.map((p) => ({ r: p.r, c: p.c }))
  const moved = new Set()
  function push(i) {
    if (moved.has(i)) return
    moved.add(i)
    const tile = fixed.tiles[i]
    const base = newPos[i]
    const occ2 = buildOccupancy(fixed, newPos)
    const edge = leadingEdgeCells(tile, base, axis, dir)
    for (const [r, c] of edge) {
      const b = occ2[r]?.[c]
      if (b === -1 || b === i) continue
      push(b)
    }
    if (axis === 'h') newPos[i].c += dir
    else newPos[i].r += dir
  }
  push(idx)
  return newPos
}

function entryToFixed(entry) {
  const size = entry.s
  return {
    size,
    targets: entry.t,
    tiles: entry.b.map((raw, idx) => {
      const [r, c, w, h, ...rest] = raw
      const need = w * h
      const vals = rest.slice(0, need)
      while (vals.length < need) vals.push(0)
      return { id: idx + 1, r0: r, c0: c, w, h, vals }
    }),
  }
}

function analyzeSolvedDepths(entry, opts) {
  const fixed = entryToFixed(entry)
  const start = fixed.tiles.map((t) => ({ r: t.r0, c: t.c0 }))
  const startKey = stateKey(start)
  const queue = [start]
  const depthByKey = new Map([[startKey, 0]])
  const solvedDepths = []
  const solvedArrangementMinDepth = new Map()
  let head = 0
  let explored = 0
  let reason = 'complete'

  if (isSolvedState(fixed, start)) {
    solvedDepths.push(0)
    solvedArrangementMinDepth.set(numberArrangementSignature(fixed, start), 0)
  }

  while (head < queue.length) {
    const cur = queue[head++]
    const curKey = stateKey(cur)
    const curDepth = depthByKey.get(curKey) ?? 0
    explored++
    if (explored > opts.maxNodes) {
      reason = 'node cap'
      break
    }
    if (curDepth >= opts.maxDepth) continue

    for (let i = 0; i < fixed.tiles.length; i++) {
      const tile = fixed.tiles[i]
      const ax = allowedAxes(tile)
      const axes = []
      if (ax.h) axes.push('h')
      if (ax.v) axes.push('v')
      for (const axis of axes) {
        for (const dir of [-1, 1]) {
          let pos = cur
          for (;;) {
            const nxt = applyMoveGrid(fixed, pos, i, axis, dir)
            if (!nxt) break
            const k = stateKey(nxt)
            const nd = curDepth + 1
            if (!depthByKey.has(k)) {
              depthByKey.set(k, nd)
              if (isSolvedState(fixed, nxt)) {
                solvedDepths.push(nd)
                const sig = numberArrangementSignature(fixed, nxt)
                const prev = solvedArrangementMinDepth.get(sig)
                if (prev == null || nd < prev) solvedArrangementMinDepth.set(sig, nd)
              }
              queue.push(nxt)
              if (depthByKey.size > opts.maxNodes) {
                reason = 'node cap'
                head = queue.length
                break
              }
            }
            pos = nxt
          }
          if (reason !== 'complete') break
        }
        if (reason !== 'complete') break
      }
      if (reason !== 'complete') break
    }
  }

  if (reason === 'complete' && Number.isFinite(opts.maxDepth)) reason = 'depth cap'

  const minSolved = solvedDepths.length ? Math.min(...solvedDepths) : null
  const arrangementDepths = [...solvedArrangementMinDepth.values()]
  const nonMinDepths = minSolved == null ? [] : arrangementDepths.filter((d) => d > minSolved)
  const nonMinRawDepths = minSolved == null ? [] : solvedDepths.filter((d) => d > minSolved)
  const nearestNonMinDelta =
    minSolved == null || nonMinDepths.length === 0 ? null : Math.min(...nonMinDepths) - minSolved
  const maxSolvedDepth = solvedDepths.length ? Math.max(...solvedDepths) : null

  return {
    minMoves: minSolved,
    solvedStateCountRaw: solvedDepths.length,
    solvedArrangementCount: solvedArrangementMinDepth.size,
    hasNonMinSolved: nonMinDepths.length > 0,
    nearestNonMinDelta,
    nonMinSolvedCount: nonMinDepths.length,
    nonMinSolvedStateCountRaw: nonMinRawDepths.length,
    maxSolvedDepth,
    explored,
    uniqueStates: depthByKey.size,
    completed: reason === 'complete',
    stopReason: reason,
  }
}

function rankRisks(results) {
  return [...results]
    .filter((r) => r.hasNonMinSolved)
    .sort((a, b) => {
      if (b.nonMinSolvedCount !== a.nonMinSolvedCount)
        return b.nonMinSolvedCount - a.nonMinSolvedCount
      const da = a.nearestNonMinDelta ?? Number.POSITIVE_INFINITY
      const db = b.nearestNonMinDelta ?? Number.POSITIVE_INFINITY
      if (da !== db) return da - db
      return a.puzzleIndex - b.puzzleIndex
    })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const deckList = puzzles[args.deck] ?? puzzles.hard ?? []
  const selected =
    Array.isArray(args.indices) && args.indices.length
      ? args.indices
          .filter((idx) => idx >= 1 && idx <= deckList.length)
          .map((idx) => ({ idx, entry: deckList[idx - 1] }))
      : deckList.map((entry, i) => ({ idx: i + 1, entry }))

  const results = []
  for (let i = 0; i < selected.length; i++) {
    const { idx, entry } = selected[i]
    const t0 = Date.now()
    const metrics = analyzeSolvedDepths(entry, args)
    const row = {
      puzzleIndex: idx,
      declaredMinMoves: Number.isFinite(entry.minMoves) ? entry.minMoves : null,
      ...metrics,
    }
    results.push(row)
    const ms = Date.now() - t0
    const tag = row.completed ? 'ok' : `capped:${row.stopReason}`
    console.log(
      `Puzzle ${i + 1}/${selected.length} (#${row.puzzleIndex}) ${tag} min=${row.minMoves} nonMinArr=${row.nonMinSolvedCount} states=${row.uniqueStates} (${ms}ms)`
    )
  }

  const risky = rankRisks(results)
  const unresolved = results.filter((r) => !r.completed)
  const multiArr = results.filter((r) => r.completed && r.solvedArrangementCount > 1)
  const summary = {
    deck: args.deck,
    analyzedCount: results.length,
    multiArrangementCount: multiArr.length,
    multiArrangementIndices: multiArr.map((r) => r.puzzleIndex),
    hasNonMinSolvedCount: risky.length,
    unresolvedCount: unresolved.length,
    analyzedIndices: results.map((r) => r.puzzleIndex),
    maxNodes: args.maxNodes,
    maxDepth: Number.isFinite(args.maxDepth) ? args.maxDepth : null,
    topRisky: risky.slice(0, 15),
  }

  const report = { summary, results }
  const outAbs = path.resolve(args.outPath)
  await fs.mkdir(path.dirname(outAbs), { recursive: true })
  await fs.writeFile(outAbs, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`Analyzed ${summary.analyzedCount} ${args.deck} puzzles`)
  console.log(`Completed with solvedArrangementCount > 1: ${summary.multiArrangementCount}`)
  if (summary.multiArrangementIndices.length)
    console.log(
      `  indices (1-based in ${args.deck}): ${summary.multiArrangementIndices.join(', ')}`
    )
  console.log(`Has reachable non-min solved states: ${summary.hasNonMinSolvedCount}`)
  console.log(`Unresolved (cap hit): ${summary.unresolvedCount}`)
  console.log(`Report written: ${outAbs}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
