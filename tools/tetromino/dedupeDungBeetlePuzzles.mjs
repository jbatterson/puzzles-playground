/**
 * One-shot: dedupe dungbeetle/puzzles.js by normalized layout fingerprint.
 * Keeps the first occurrence across tutorial → easy → medium → hard.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..', '..')
const abs = path.join(root, 'puzzlegames/dungbeetle/puzzles.js')
const { default: data } = await import(pathToFileURL(abs).href + `?t=${Date.now()}`)
const { normalizePuzzleInput } = await import(
  pathToFileURL(path.join(root, 'puzzlegames/dungbeetle/engine.js')).href
)

function fingerprint(raw) {
  const p = normalizePuzzleInput(raw, true)
  return JSON.stringify({
    s: p.size,
    pieces: p.pieces
      .map((piece) =>
        piece.cells
          .map((c) => `${c.r},${c.c}`)
          .sort()
          .join('|')
      )
      .sort(),
    player: [p.player.r, p.player.c],
    ball: [p.ball.r, p.ball.c],
    target: [p.target.r, p.target.c],
  })
}

function cellPair(v) {
  if (Array.isArray(v)) return `[${v[0]},${v[1]}]`
  return `[${v.r},${v.c}]`
}

function formatPuzzle(raw) {
  const p = normalizePuzzleInput(raw, true)

  if (Array.isArray(raw.pieces) && (raw.target != null || raw.minPushes != null) && raw.hole == null) {
    const piecesPart = JSON.stringify(
      p.pieces.map((piece) => ({
        cells: piece.cells.map((c) => ({ r: c.r, c: c.c })),
      }))
    )
    const min = p.minPushes ?? p.pushes
    let line = `    {"pieces":${piecesPart},"player":{"r":${p.player.r},"c":${p.player.c}},"ball":{"r":${p.ball.r},"c":${p.ball.c}},"target":{"r":${p.target.r},"c":${p.target.c}}`
    if (Number.isFinite(min)) line += `,"minPushes":${min}`
    if (typeof raw.solution === 'string' && raw.solution) {
      line += `,"solution":${JSON.stringify(raw.solution)}`
    }
    return `${line}},`
  }

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
    `ball: ${cellPair(raw.ball ?? p.ball)}, ` +
    `hole: ${cellPair(raw.hole ?? raw.target ?? p.target)}, ` +
    `pushes: ${pushes}` +
    (Number.isFinite(raw.ballPushes) ? `, ballPushes: ${raw.ballPushes}` : '') +
    (Number.isFinite(raw.blocksMoved) ? `, blocksMoved: ${raw.blocksMoved}` : '') +
    (Number.isFinite(raw.solns) ? `, solns: ${raw.solns}` : '') +
    ','
  const sol =
    typeof raw.solution === 'string' && raw.solution
      ? `\n  solution: ${JSON.stringify(raw.solution)} },`
      : ' },'
  return head + sol
}

const TIERS = ['tutorial', 'easy', 'medium', 'hard']
const seen = new Map()
const next = {}
const removed = []

for (const tier of TIERS) {
  const list = data[tier] || []
  const keep = []
  list.forEach((raw, i) => {
    const fp = fingerprint(raw)
    if (seen.has(fp)) {
      removed.push({ tier, i, of: seen.get(fp) })
    } else {
      seen.set(fp, { tier, i })
      keep.push(raw)
    }
  })
  next[tier] = keep
}

const header = `/**
 * Dung Beetle daily tiers + tutorial.
 *
 * Difficulty bands (approximate): easy lower pushes, medium mid, hard higher.
 * Layouts deduped across tiers.
 */
export default {
`

const body = TIERS.map((tier) => {
  const lines = next[tier].map(formatPuzzle).join('\n')
  return `  ${tier}: [\n${lines}\n  ],`
}).join('\n\n')

fs.writeFileSync(abs, `${header}${body}\n}\n`, 'utf8')

console.log(`Removed ${removed.length} duplicate(s):`)
for (const r of removed) {
  console.log(`  ${r.tier}[${r.i}] duplicate of ${r.of.tier}[${r.of.i}]`)
}
console.log(
  `Kept: tutorial ${next.tutorial.length}, easy ${next.easy.length}, medium ${next.medium.length}, hard ${next.hard.length} (total ${TIERS.reduce((s, t) => s + next[t].length, 0)})`
)
