/**
 * Compute Scuttlebug `dif` for every puzzle and write into puzzles.js.
 * Does not re-sort tiers.
 *
 *   node tools/tetromino/writeScuttlebugDif.mjs
 *   node tools/tetromino/writeScuttlebugDif.mjs --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { scoreScuttlebugDif } from './scuttlebugDifScore.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const abs = path.join(repoRoot, 'puzzlegames/scuttlebug/puzzles.js')
const dryRun = process.argv.includes('--dry-run')

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/scuttlebug/engine.js')).href
)
const { normalizePuzzleInput } = engine
const data = (await import(pathToFileURL(abs).href + `?t=${Date.now()}`)).default

const TIERS = ['tutorial', 'easy', 'medium', 'hard']

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
    (Number.isFinite(raw.dif) ? `, dif: ${raw.dif}` : '') +
    (typeof raw.note === 'string' && raw.note ? `, note: ${JSON.stringify(raw.note)}` : '') +
    ','
  const sol =
    typeof raw.solution === 'string' && raw.solution
      ? `\n  solution: ${JSON.stringify(raw.solution)} },`
      : ' },'
  return head + sol
}

const next = {}
const report = []
const fails = []

for (const tier of TIERS) {
  const list = []
  for (const [i, raw] of (data[tier] || []).entries()) {
    const s = scoreScuttlebugDif(raw, engine)
    if (!s.ok) {
      fails.push({ tier, i: i + 1, why: s.why })
      list.push({ ...raw })
      continue
    }
    const row = { ...raw, dif: s.dif }
    list.push(row)
    report.push({
      tier,
      curateTier: i + 1,
      dif: s.dif,
      bonus: s.bonus,
      base: s.base,
      chunks: s.chunks,
      holeCover: s.holeCover ? 1 : 0,
      reverseBlocks: s.reverseBlocks,
      walks: s.walks,
      blockPushes: s.blockPushes,
      pushes: raw.pushes ?? '',
      glyphs: typeof raw.solution === 'string' ? raw.solution.length : 0,
    })
  }
  next[tier] = list
}

if (fails.length) {
  console.error(`Replay failures: ${fails.length}`)
  for (const f of fails.slice(0, 20)) {
    console.error(`  ${f.tier}#${f.i} ${f.why}`)
  }
  process.exit(1)
}

if (!dryRun) {
  const src = fs.readFileSync(abs, 'utf8')
  const headerMatch = src.match(/^[\s\S]*?export default \{\r?\n/)
  if (!headerMatch) throw new Error('header not found')
  let header = headerMatch[0].replace(/\r\n/g, '\n')
  if (!/dif/.test(header)) {
    header = header.replace(
      /Solution glyphs:.*\n/,
      (m) =>
        m +
        ' * `dif` = walks×1 + block pushes×7 + chunk×3 + hole-cover×7 + reverse×7/block — see\n' +
        ' * tools/tetromino/scuttlebugDifScore.mjs / writeScuttlebugDif.mjs.\n'
    )
  }
  const body = TIERS.map((tier) => {
    const lines = next[tier].map(formatPuzzle).join('\n')
    return `  ${tier}: [\n${lines}\n  ],`
  }).join('\n\n')
  const out = `${header}${body}\n}\n`
  fs.writeFileSync(abs, src.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out, 'utf8')
  console.log(`Wrote dif for ${report.length} puzzles → ${abs}`)
} else {
  console.log(`dry-run: scored ${report.length} puzzles`)
}

for (const tier of TIERS) {
  const rows = report.filter((r) => r.tier === tier)
  if (!rows.length) continue
  const difs = rows.map((r) => r.dif)
  const bonuses = rows.map((r) => r.bonus)
  console.log(
    `\n${tier} n=${rows.length}  dif ${Math.min(...difs)}–${Math.max(...difs)}` +
      ` (mean ${(difs.reduce((a, b) => a + b, 0) / difs.length).toFixed(1)})` +
      `  bonus ${Math.min(...bonuses)}–${Math.max(...bonuses)}`
  )
  const top = [...rows].sort(
    (a, b) => b.bonus - a.bonus || b.dif - a.dif || a.curateTier - b.curateTier
  )
  const maxBonus = top[0].bonus
  const leaders = top.filter((r) => r.bonus === maxBonus)
  console.log(`  most bonus (${maxBonus}):`)
  for (const r of leaders.slice(0, 12)) {
    console.log(
      `    ${tier}#${r.curateTier}  dif=${r.dif} bonus=${r.bonus}` +
        ` (chunks=${r.chunks} hole=${r.holeCover} rev=${r.reverseBlocks}` +
        ` base=${r.base} p=${r.pushes} g=${r.glyphs})`
    )
  }
  if (leaders.length > 12) console.log(`    … +${leaders.length - 12} more at bonus=${maxBonus}`)
}
