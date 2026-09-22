/**
 * Enumerate 6×6 four-tetromino Dung Beetle puzzles for the hard tier.
 *
 * Keep after canonicalize:
 *   pushes ≥ 8 (= 2N), blocksMoved ≥ 3, pushes+ball ∈ [12, 24],
 *   glyphs ∈ [30, 70], dif ≥ 80
 *   dif = walk udlr×1 + ball NSWE×2 + block UDLR×5 (all glyphs).
 *
 * Search grid: every unordered distinct quad (omit one type) × bands
 *   (block≥12,ball≥0), (10,2), (8,4)
 * Per cell: keep up to 50, or stop after 500k attempts (barren if 0).
 * Every ~50 new keepers: canonicalize each, append to hard (after existing rows),
 *   then end-state D4 cull across all tiers keeping
 *   max pushes → max ballPushes → min glyphs.
 * minMoved = 3. Does not delete existing hard up front.
 *
 *   node tools/tetromino/enumerateFourBlock6x6Hard.mjs
 *   node tools/tetromino/enumerateFourBlock6x6Hard.mjs --wanted-per-cell=50 --attempts=500000
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  PIECE_TYPES,
  createRng,
  generateByReversePushes,
  solvePushPuzzle,
  analyzeCanonicalTetrominoSolution,
  dirFromSolutionChar,
} from './pushEngine.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const puzzlesAbs = path.join(repoRoot, 'puzzlegames/dungbeetle/puzzles.js')
const progressAbs = path.join(repoRoot, 'tools/reports/enumerate-6x6-4block-hard-progress.json')

const args = new Map(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const eq = a.indexOf('=')
      return eq === -1 ? [a.slice(2), 'true'] : [a.slice(2, eq), a.slice(eq + 1)]
    })
)
const num = (k, f) => (args.has(k) ? Number(args.get(k)) : f)

const WANTED_PER_CELL = num('wanted-per-cell', 50)
const ATTEMPT_CAP = num('attempts', 500000)
const BATCH_SIZE = num('batch', 50)
const MAX_STATES = num('max-states', 250000)
const VERIFY_MS = num('verify-ms', 6000)
const CANON_MS = num('canon-ms', 90000)
const MAX_PUSHES = num('max-pushes', 24)
const MAX_BALL = num('max-ball-pushes', 24)
const MIN_PUSHES = 8
const MIN_MOVED = 3
const MIN_TOTAL = 12
const MAX_TOTAL = 24
const MIN_GLYPHS = 30
const MAX_GLYPHS = 70
const MIN_DIF = 80
/** Soft prefilters before canonicalize. */
const SOFT_MIN_GLYPHS = 25
const SOFT_MAX_GLYPHS = 90
const SOFT_MIN_DIF = 60
const SEED = num('seed', Date.now() & 0x7fffffff)
const FLUSH_ONLY = args.has('flush-only')

const TIERS = ['tutorial', 'easy', 'medium', 'hard']
const BANDS = [
  { minPushes: 12, minBall: 0 },
  { minPushes: 10, minBall: 2 },
  { minPushes: 8, minBall: 4 },
]

/** Five quads: omit one of I,L,O,S,T → LOST, IOST, ILST, ILOT, ILOS. */
const QUADS = PIECE_TYPES.map((omit) => PIECE_TYPES.filter((t) => t !== omit))

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/dungbeetle/engine.js')).href
)
const { normalizePuzzleInput, initPlayState, tryMove, checkWon } = engine

function log(msg) {
  process.stderr.write(msg + '\n')
}

function countsForQuad(quad) {
  const set = new Set(quad)
  return Object.fromEntries(PIECE_TYPES.map((t) => [t, set.has(t) ? 1 : 0]))
}

function startFingerprint(puzzle) {
  return JSON.stringify({
    s: puzzle.size,
    p: puzzle.pieces
      .map((piece) =>
        piece.cells
          .map((cell) => `${cell.r},${cell.c}`)
          .sort()
          .join('|')
      )
      .sort(),
    pl: [puzzle.player.r, puzzle.player.c],
    b: puzzle.ball ? [puzzle.ball.r, puzzle.ball.c] : null,
    t: [puzzle.target.r, puzzle.target.c],
  })
}

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
  return JSON.stringify({ s: size, h: [hole.r, hole.c], p: pieceKeys })
}

function canonicalEndKey(size, hole, pieces) {
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
  if (typeof solution !== 'string' || !solution) return { ok: false, why: 'missing-solution' }
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

function cellPair(v) {
  if (Array.isArray(v)) return `[${v[0]},${v[1]}]`
  return `[${v.r},${v.c}]`
}

/** walk udlr=1, ball NSWE (and legacy wase)=2, block UDLR=5. All glyphs. */
function glyphDif(solution) {
  if (typeof solution !== 'string') return 0
  let score = 0
  for (const ch of solution) {
    if ('udlr'.includes(ch)) score += 1
    else if ('UDLR'.includes(ch)) score += 5
    else if ('NSWE'.includes(ch) || 'wsae'.includes(ch)) score += 2
  }
  return score
}

function formatPuzzle(raw) {
  const p = normalizePuzzleInput(raw, true)
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
  const dif = Number.isFinite(raw.dif) ? raw.dif : glyphDif(raw.solution)
  const head =
    `    { size: ${p.size}, pieces: ${piecesPart}, ` +
    `player: ${cellPair(raw.player ?? p.player)}, ` +
    `ball: ${cellPair(raw.ball ?? p.ball)}, ` +
    `hole: ${cellPair(raw.hole ?? raw.target ?? p.target)}, ` +
    `pushes: ${pushes}` +
    (Number.isFinite(raw.ballPushes) ? `, ballPushes: ${raw.ballPushes}` : '') +
    (Number.isFinite(raw.blocksMoved) ? `, blocksMoved: ${raw.blocksMoved}` : '') +
    (Number.isFinite(raw.solns) ? `, solns: ${raw.solns}` : '') +
    `, dif: ${dif}` +
    (typeof raw.note === 'string' && raw.note ? `, note: ${JSON.stringify(raw.note)}` : '') +
    ','
  const sol =
    typeof raw.solution === 'string' && raw.solution
      ? `\n  solution: ${JSON.stringify(raw.solution)} },`
      : ' },'
  return head + sol
}

function writePuzzles(data) {
  const header = `/**
 * Dung Beetle daily tiers + tutorial.
 *
 * Difficulty bands (approximate): easy lower pushes, medium mid, hard higher.
 * Layouts deduped across tiers.
 * Solution glyphs: capitals push — UDLR = tetromino (par), NSWE = ball; udlr = walk.
 * Official \`solution\` is min tetromino pushes, then min total glyphs, then lex — see
 * tools/tetromino/canonicalizeTetrominoSolutions.mjs / analyzeCanonicalTetrominoSolution.
 * \`solns\` = distinct per-piece trajectories among min-push solutions (free ball routing ignored).
 * \`dif\` = solution glyph score: walk udlr=1, ball NSWE=2, block UDLR=5 (all glyphs counted).
 * Refresh: npm run canonicalize:tetromino -- --mode=dung --write (skips rows that already have solns).
 * Optional \`note\` on a row is a curator flag (preserved by dedupe/canonicalize).
 */
export default {
`
  const body = TIERS.map((tier) => {
    const lines = (data[tier] || []).map(formatPuzzle).join('\n')
    return `  ${tier}: [\n${lines}\n  ],`
  }).join('\n\n')
  fs.writeFileSync(puzzlesAbs, `${header}${body}\n}\n`, 'utf8')
}

function loadData() {
  return import(pathToFileURL(puzzlesAbs).href + `?t=${Date.now()}`).then((m) => m.default)
}

function pieceCount(raw) {
  if (Array.isArray(raw.pieces)) return raw.pieces.length
  return Object.values(raw.pieces || {}).reduce((s, a) => s + a.length, 0)
}

function toRawLedger(candidate, result) {
  const grouped = {}
  for (const piece of candidate.pieces) {
    if (!grouped[piece.type]) grouped[piece.type] = []
    grouped[piece.type].push(piece.cells.map((cell) => [cell.r, cell.c]))
  }
  return {
    size: candidate.size,
    pieces: grouped,
    player: [candidate.player.r, candidate.player.c],
    ball: [candidate.ball.r, candidate.ball.c],
    hole: [candidate.target.r, candidate.target.c],
    pushes: result.pushes,
    ballPushes: result.ballPushes,
    blocksMoved: result.blocksMoved,
    solution: result.solution,
  }
}

function meetsHardCriteria(raw) {
  const pushes = raw.pushes ?? 0
  const ball = raw.ballPushes ?? 0
  const total = pushes + ball
  const moved = raw.blocksMoved ?? 0
  const glyphs = typeof raw.solution === 'string' ? raw.solution.length : 0
  const dif = Number.isFinite(raw.dif) ? raw.dif : glyphDif(raw.solution)
  return (
    pushes >= MIN_PUSHES &&
    pushes <= MAX_PUSHES &&
    moved >= MIN_MOVED &&
    total >= MIN_TOTAL &&
    total <= MAX_TOTAL &&
    ball <= MAX_BALL &&
    glyphs >= MIN_GLYPHS &&
    glyphs <= MAX_GLYPHS &&
    dif >= MIN_DIF
  )
}

/** Prefer higher block pushes, then ball, then fewer glyphs; stable on tier/index. */
function betterKeeper(a, b) {
  if (a.pushes !== b.pushes) return a.pushes > b.pushes ? a : b
  if (a.ballPushes !== b.ballPushes) return a.ballPushes > b.ballPushes ? a : b
  if (a.glyphs !== b.glyphs) return a.glyphs < b.glyphs ? a : b
  const ti = TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier)
  if (ti !== 0) return ti < 0 ? a : b
  return a.index0 <= b.index0 ? a : b
}

/**
 * End-state D4 cull across all tiers.
 * Keep rule: max pushes → max ball → min glyphs.
 */
function cullEndStateDupes(data) {
  /** @type {Map<string, { tier: string, index0: number, raw: any, pushes: number, ballPushes: number, glyphs: number }[]>} */
  const byKey = new Map()
  let failed = 0

  for (const tier of TIERS) {
    for (const [i, raw] of (data[tier] || []).entries()) {
      const puzzle = normalizePuzzleInput(raw, true)
      const end = replayToEnd(puzzle, raw.solution)
      if (!end.ok) {
        failed++
        continue
      }
      const key = canonicalEndKey(end.size, end.hole, end.pieces)
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key).push({
        tier,
        index0: i,
        raw,
        pushes: raw.pushes ?? 0,
        ballPushes: raw.ballPushes ?? 0,
        glyphs: typeof raw.solution === 'string' ? raw.solution.length : 9999,
      })
    }
  }

  const drop = new Set()
  let clusters = 0
  let dropped = 0
  for (const members of byKey.values()) {
    if (members.length < 2) continue
    clusters++
    let winner = members[0]
    for (let i = 1; i < members.length; i++) winner = betterKeeper(winner, members[i])
    for (const m of members) {
      if (m.tier === winner.tier && m.index0 === winner.index0) continue
      drop.add(`${m.tier}:${m.index0}`)
      dropped++
    }
  }

  const next = {}
  for (const tier of TIERS) {
    next[tier] = (data[tier] || []).filter((_, i) => !drop.has(`${tier}:${i}`))
  }
  return { next, clusters, dropped, failed }
}

function loadSeenFingerprints(data) {
  const seen = new Set()
  for (const tier of TIERS) {
    for (const raw of data[tier] || []) {
      seen.add(startFingerprint(normalizePuzzleInput(raw, true)))
    }
  }
  return seen
}

/** Official solution + solns + dif for a raw ledger row. */
function canonicalizeRaw(raw) {
  const puzzle = normalizePuzzleInput(raw, true)
  const result = analyzeCanonicalTetrominoSolution(puzzle, {
    dungMode: true,
    maxStates: MAX_STATES,
    timeBudgetMs: CANON_MS,
  })
  if (!result.ok || !result.solution) {
    return {
      ok: false,
      why: result.reason || (result.cutoff ? 'cutoff' : 'fail'),
      raw,
    }
  }
  return {
    ok: true,
    raw: {
      ...raw,
      pushes: result.pushes,
      ballPushes: result.ballPushes,
      blocksMoved: result.blocksMoved,
      solns: result.solns,
      solution: result.solution,
      dif: glyphDif(result.solution),
    },
  }
}

async function flushBatch(pending, data) {
  if (pending.length === 0) return { data, added: 0, dropped: 0, canonFail: 0 }

  const append = []
  let canonFail = 0
  for (const raw of pending.splice(0, pending.length)) {
    const c = canonicalizeRaw(raw)
    if (!c.ok) {
      canonFail++
      log(`  canon fail: ${c.why}`)
      continue
    }
    if (!meetsHardCriteria(c.raw)) {
      canonFail++
      log(
        `  canon dropped band: ${c.raw.pushes}+${c.raw.ballPushes} moved=${c.raw.blocksMoved}` +
          ` glyphs=${c.raw.solution?.length} dif=${c.raw.dif}`
      )
      continue
    }
    append.push(c.raw)
  }

  if (append.length === 0) {
    log(`  flush: nothing survived canonicalize (fails=${canonFail})`)
    return { data, added: 0, dropped: 0, canonFail }
  }

  const merged = {
    tutorial: data.tutorial,
    easy: data.easy,
    medium: data.medium,
    hard: [...data.hard, ...append],
  }
  const { next, clusters, dropped, failed } = cullEndStateDupes(merged)
  writePuzzles(next)
  log(
    `  flush: appended ${append.length}, canonFail=${canonFail}, end-dupe clusters=${clusters} dropped=${dropped}` +
      (failed ? ` replayFail=${failed}` : '') +
      ` → hard ${next.hard.length}`
  )
  return { data: next, added: append.length, dropped, canonFail }
}

const cells = []
for (const quad of QUADS) {
  for (const band of BANDS) {
    cells.push({
      id: `${quad.join('')}-b${band.minPushes}+ball${band.minBall}+`,
      quad,
      ...band,
    })
  }
}

const hadProgress = fs.existsSync(progressAbs)
let progress = { seed: SEED, doneCells: [], cellResults: {} }
if (hadProgress) {
  try {
    progress = JSON.parse(fs.readFileSync(progressAbs, 'utf8'))
  } catch {
    // ignore
  }
}

function saveProgress() {
  fs.mkdirSync(path.dirname(progressAbs), { recursive: true })
  fs.writeFileSync(progressAbs, JSON.stringify(progress, null, 2), 'utf8')
}

let data = await loadData()

const pending = []
let ledgerSeen = loadSeenFingerprints(data)
const rng = createRng(progress.seed || SEED)

log(
  `Enumerate 6×6 four-block hard: ${QUADS.length} quads × ${BANDS.length} bands = ${cells.length} cells` +
    `\n  wanted/cell=${WANTED_PER_CELL} attempts=${ATTEMPT_CAP} batch=${BATCH_SIZE}` +
    ` minMoved=${MIN_MOVED} total=${MIN_TOTAL}–${MAX_TOTAL} glyphs=${MIN_GLYPHS}–${MAX_GLYPHS}` +
    ` dif≥${MIN_DIF} seed=${progress.seed || SEED}`
)
log(
  `  ledger: tutorial ${data.tutorial.length}, easy ${data.easy.length}, medium ${data.medium.length}, hard ${data.hard.length}`
)
log(`  quads: ${QUADS.map((q) => q.join('')).join(' ')}`)
log(`  start fingerprints loaded: ${ledgerSeen.size}`)

if (FLUSH_ONLY) {
  await flushBatch(pending, data)
  process.exit(0)
}

const summary = []
let totalKeptRaw = 0

for (const cell of cells) {
  if (progress.doneCells.includes(cell.id)) {
    log(`skip ${cell.id} (already done)`)
    continue
  }

  const counts = countsForQuad(cell.quad)
  const ballPulls = 2 * Math.max(cell.minPushes, MIN_PUSHES)
  let chainBase = Math.max(cell.minPushes, MIN_PUSHES) + 1
  const chainCeiling = cell.minPushes + 10
  let lastTuned = 0
  let tunedBelow = 0
  let tunedAbove = 0

  let attempts = 0
  let kept = 0
  let belowBand = 0
  let aboveBand = 0
  let ballBand = 0
  let glyphBand = 0
  let buildFailed = 0
  let duplicate = 0
  let other = 0
  const cellSeen = new Set()

  log(`\n=== ${cell.id}  pushes≥${cell.minPushes} ball≥${cell.minBall} ===`)

  while (kept < WANTED_PER_CELL && attempts < ATTEMPT_CAP) {
    attempts++
    const candidate = generateByReversePushes({
      size: 6,
      counts,
      dungMode: true,
      reversePushes: Math.min(chainCeiling, chainBase + Math.floor(rng() * 5)),
      minMoved: MIN_MOVED,
      ballPulls,
      strictChain: false,
      rng,
    })
    if (!candidate) {
      buildFailed++
      continue
    }

    const fp = startFingerprint(candidate)
    if (ledgerSeen.has(fp) || cellSeen.has(fp)) {
      duplicate++
      continue
    }
    cellSeen.add(fp)

    const result = solvePushPuzzle(candidate, {
      dungMode: true,
      maxStates: MAX_STATES,
      timeBudgetMs: VERIFY_MS,
    })

    if (!result.solvable || result.cutoff || !result.solution) {
      other++
      continue
    }
    if (result.pushes < cell.minPushes || result.pushes < MIN_PUSHES) {
      belowBand++
      continue
    }
    if (result.pushes > MAX_PUSHES) {
      aboveBand++
      continue
    }
    if (result.ballPushes < cell.minBall || result.ballPushes > MAX_BALL) {
      ballBand++
      continue
    }
    if (result.blocksMoved < MIN_MOVED) {
      other++
      continue
    }
    const total = result.pushes + result.ballPushes
    if (total < MIN_TOTAL || total > MAX_TOTAL) {
      other++
      continue
    }
    const g = result.solution.length
    const dif = glyphDif(result.solution)
    if (
      g < SOFT_MIN_GLYPHS ||
      g > SOFT_MAX_GLYPHS ||
      dif < SOFT_MIN_DIF
    ) {
      glyphBand++
      continue
    }

    const raw = toRawLedger(candidate, result)
    pending.push(raw)
    ledgerSeen.add(fp)
    kept++
    totalKeptRaw++
    log(
      `  kept ${kept}/${WANTED_PER_CELL}: ${result.pushes}b+${result.ballPushes}ball ` +
        `glyphs=${g} dif=${dif} (attempts ${attempts}, pending ${pending.length})`
    )

    if (pending.length >= BATCH_SIZE) {
      const flushed = await flushBatch(pending, data)
      data = flushed.data
      ledgerSeen = loadSeenFingerprints(data)
      for (const p of pending) {
        ledgerSeen.add(startFingerprint(normalizePuzzleInput(p, true)))
      }
    }

    if (attempts - lastTuned >= 3000) {
      const below = belowBand - tunedBelow
      const above = aboveBand - tunedAbove
      if (below > above * 4 && chainBase < chainCeiling) chainBase++
      else if (above > below && chainBase > MIN_PUSHES) chainBase--
      lastTuned = attempts
      tunedBelow = belowBand
      tunedAbove = aboveBand
    }
  }

  const barren = kept === 0 && attempts >= ATTEMPT_CAP
  log(
    `  done ${cell.id}: kept ${kept} in ${attempts} attempts` +
      (barren ? ' (BARREN)' : '') +
      ` | below ${belowBand} above ${aboveBand} ballBand ${ballBand} glyphBand ${glyphBand}` +
      ` dup ${duplicate} unbuild ${buildFailed} other ${other}`
  )

  progress.doneCells.push(cell.id)
  progress.cellResults[cell.id] = { kept, attempts, barren }
  saveProgress()
  summary.push({ id: cell.id, kept, attempts, barren })
}

if (pending.length) {
  const flushed = await flushBatch(pending, data)
  data = flushed.data
}

data = await loadData()
const finalCull = cullEndStateDupes(data)
writePuzzles(finalCull.next)
data = finalCull.next

log(`\n======== SUMMARY ========`)
log(`Raw keepers this run (pre end-dupe / pre-canon filter): ${totalKeptRaw}`)
log(
  `Final ledger: tutorial ${data.tutorial.length}, easy ${data.easy.length}, medium ${data.medium.length}, hard ${data.hard.length}`
)
log(`Final end-dupe: clusters=${finalCull.clusters} dropped=${finalCull.dropped}`)

const hard4 = data.hard.filter((p) => p.size === 6 && pieceCount(p) === 4)
const inBand = hard4.filter(meetsHardCriteria)
log(`Hard 6×6 four-block: ${hard4.length} (meeting criteria: ${inBand.length})`)

for (const s of summary) {
  log(
    `  ${s.id.padEnd(18)} kept=${String(s.kept).padStart(2)} attempts=${String(s.attempts).padStart(6)}${s.barren ? ' BARREN' : ''}`
  )
}

saveProgress()
log(`Progress saved to ${progressAbs}`)
