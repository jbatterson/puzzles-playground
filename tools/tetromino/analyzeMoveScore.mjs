/**
 * Weighted move score for Dung Beetle solutions.
 *
 * Count only glyphs up to and including the last block push (UDLR).
 *   walk udlr = 1, ball NSWE = 3, block UDLR = 5
 *
 *   node tools/tetromino/analyzeMoveScore.mjs
 *   node tools/tetromino/analyzeMoveScore.mjs --out=tools/reports/dung-move-score.csv
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

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
  args.get('out') || 'tools/reports/dung-move-score.csv'
)

const TIERS = ['tutorial', 'easy', 'medium', 'hard']

const data = (
  await import(pathToFileURL(path.join(repoRoot, 'puzzlegames/dungbeetle/puzzles.js')).href)
).default

const HEADER = [
  'tier',
  'index0',
  'curateTier',
  'pushes',
  'ballPushes',
  'blocksMoved',
  'solns',
  'glyphs',
  'scoredGlyphs',
  'ignoredAfterLastBlock',
  'walks',
  'blockPushes',
  'ballPushesScored',
  'score',
  'note',
]

function glyphKind(ch) {
  if ('udlr'.includes(ch)) return 'walk'
  if ('UDLR'.includes(ch)) return 'block'
  if ('NSWE'.includes(ch) || 'wsae'.includes(ch)) return 'ball'
  return null
}

/** Score through the last UDLR inclusive. */
export function scoreSolution(solution) {
  const sol = typeof solution === 'string' ? solution : ''
  let lastBlock = -1
  for (let i = 0; i < sol.length; i++) {
    if ('UDLR'.includes(sol[i])) lastBlock = i
  }
  const prefix = lastBlock < 0 ? '' : sol.slice(0, lastBlock + 1)
  let walks = 0
  let blockPushes = 0
  let ballPushesScored = 0
  let unknown = 0
  for (const ch of prefix) {
    const kind = glyphKind(ch)
    if (kind === 'walk') walks++
    else if (kind === 'block') blockPushes++
    else if (kind === 'ball') ballPushesScored++
    else unknown++
  }
  return {
    glyphs: sol.length,
    scoredGlyphs: prefix.length,
    ignoredAfterLastBlock: lastBlock < 0 ? sol.length : sol.length - lastBlock - 1,
    walks,
    blockPushes,
    ballPushesScored,
    unknown,
    score: walks * 1 + blockPushes * 5 + ballPushesScored * 3,
  }
}

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const rows = []
let unknownTotal = 0

for (const tier of TIERS) {
  for (const [i, raw] of (data[tier] || []).entries()) {
    const s = scoreSolution(raw.solution)
    unknownTotal += s.unknown
    rows.push({
      tier,
      index0: i,
      curateTier: i + 1,
      pushes: raw.pushes ?? '',
      ballPushes: raw.ballPushes ?? '',
      blocksMoved: raw.blocksMoved ?? '',
      solns: raw.solns ?? '',
      glyphs: s.glyphs,
      scoredGlyphs: s.scoredGlyphs,
      ignoredAfterLastBlock: s.ignoredAfterLastBlock,
      walks: s.walks,
      blockPushes: s.blockPushes,
      ballPushesScored: s.ballPushesScored,
      score: s.score,
      note: raw.note ?? '',
    })
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(
  outPath,
  [HEADER.join(','), ...rows.map((r) => HEADER.map((h) => csvEscape(r[h])).join(','))].join('\n') +
    '\n',
  'utf8'
)

console.log(`wrote ${outPath}  (${rows.length} rows, unknown glyphs=${unknownTotal})`)
for (const tier of TIERS) {
  const t = rows.filter((r) => r.tier === tier)
  const scores = t.map((r) => r.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const mean = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  console.log(`  ${tier.padEnd(8)} n=${String(t.length).padStart(3)}  score ${min}–${max}  mean=${mean}`)
}
