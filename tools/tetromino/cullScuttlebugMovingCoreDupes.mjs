/**
 * One-shot: cull Scuttlebug puzzles that share a D4 moving-core cells key,
 * keeping the last in ledger order (tutorial→easy→medium→hard, then index).
 *
 *   node tools/tetromino/cullScuttlebugMovingCoreDupes.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { dirFromSolutionChar } from './pushEngine.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const abs = path.join(repoRoot, 'puzzlegames/scuttlebug/puzzles.js')

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/scuttlebug/engine.js')).href
)
const { normalizePuzzleInput, initPlayState, tryMove, checkWon, pieceAtIn } = engine

const data = (
  await import(pathToFileURL(abs).href + `?t=${Date.now()}`)
).default

const TIERS = ['tutorial', 'easy', 'medium', 'hard']

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

function snapshotPieces(state) {
  return state.pieces.map((p) => ({
    type: p.type || '?',
    cells: p.cells.map((c) => ({ r: c.r, c: c.c })),
  }))
}

function cellsCoreKey(raw) {
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
  let state = startState
  const movedIdx = new Set()
  for (const ch of raw.solution) {
    if (checkWon(state)) break
    const dir = dirFromSolutionChar(ch)
    if (!dir) return null
    const hit = pieceAtIn(state.pieces, state.player.r + dir.dr, state.player.c + dir.dc)
    const move = tryMove(state, dir.dr, dir.dc)
    if (!move.ok) return null
    if (move.pushedTetromino && hit >= 0) movedIdx.add(hit)
    state = move.state
  }
  if (!checkWon(state)) return null
  const endPieces = snapshotPieces(state)
  const moved = [...movedIdx]
    .sort((a, b) => a - b)
    .map((i) => ({
      type: startPieces[i].type,
      start: startPieces[i].cells,
      end: endPieces[i].cells,
    }))
  return canonicalMovingCoreKey(puzzle.size, hole, moved)
}

function cellPair(v) {
  if (Array.isArray(v)) return `[${v[0]},${v[1]}]`
  return `[${v.r},${v.c}]`
}

function formatPuzzle(raw) {
  const p = normalizePuzzleInput(raw, false)
  let piecesPart
  if (raw.pieces && !Array.isArray(raw.pieces)) {
    piecesPart = JSON.stringify(raw.pieces)
  } else {
    const grouped = {}
    for (const piece of p.pieces) {
      const type = piece.type || '?'
      if (!grouped[type]) grouped[type] = []
      grouped[type].push(piece.cells.map((c) => [c.r, c.c]))
    }
    piecesPart = JSON.stringify(grouped)
  }
  const pushes = raw.pushes ?? raw.minPushes
  const head =
    `    { size: ${p.size}, pieces: ${piecesPart}, ` +
    `player: ${cellPair(raw.player ?? p.player)}, ` +
    `hole: ${cellPair(raw.hole ?? raw.target ?? p.target)}, ` +
    `pushes: ${pushes}` +
    (Number.isFinite(raw.blocksMoved) ? `, blocksMoved: ${raw.blocksMoved}` : '') +
    (Number.isFinite(raw.solns) ? `, solns: ${raw.solns}` : '') +
    (typeof raw.note === 'string' && raw.note ? `, note: ${JSON.stringify(raw.note)}` : '') +
    ','
  const sol =
    typeof raw.solution === 'string' && raw.solution
      ? `\n  solution: ${JSON.stringify(raw.solution)} },`
      : ' },'
  return head + sol
}

/** @type {Map<string, {tier:string,index0:number,raw:object}[]>} */
const byKey = new Map()
const entries = []
for (const tier of TIERS) {
  for (const [index0, raw] of (data[tier] || []).entries()) {
    const key = cellsCoreKey(raw)
    const rec = { tier, index0, raw, key }
    entries.push(rec)
    if (!key) continue
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(rec)
  }
}

const drop = new Set()
const removed = []
for (const members of byKey.values()) {
  if (members.length < 2) continue
  // already in ledger order within each key (we inserted tutorial→hard)
  for (let i = 0; i < members.length - 1; i++) {
    const m = members[i]
    drop.add(`${m.tier}|${m.index0}`)
    removed.push(`${m.tier}#${m.index0 + 1}`)
  }
}

const next = {}
for (const tier of TIERS) {
  next[tier] = (data[tier] || []).filter((_, i) => !drop.has(`${tier}|${i}`))
}

const src = fs.readFileSync(abs, 'utf8')
const headerMatch = src.match(/^[\s\S]*?export default \{\r?\n/)
if (!headerMatch) throw new Error('header not found')
const header = headerMatch[0].replace(/\r\n/g, '\n')
const body = TIERS.map((tier) => {
  const lines = next[tier].map(formatPuzzle).join('\n')
  return `  ${tier}: [\n${lines}\n  ],`
}).join('\n\n')
const out = `${header}${body}\n}\n`
fs.writeFileSync(abs, src.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out, 'utf8')

const before = TIERS.reduce((s, t) => s + (data[t] || []).length, 0)
const after = TIERS.reduce((s, t) => s + next[t].length, 0)
console.log(`Removed ${removed.length} moving-core cells duplicates (kept last in ledger order).`)
console.log(
  `Before ${before} → after ${after}: tutorial ${next.tutorial.length}, easy ${next.easy.length}, medium ${next.medium.length}, hard ${next.hard.length}`
)
