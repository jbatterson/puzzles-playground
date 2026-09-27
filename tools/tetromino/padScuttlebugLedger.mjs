/**
 * Pad Scuttlebug easy/medium/hard via find → merge → canonicalize → D4 dedupe
 * → cells/overlap near-dupe cull → pushes≥10 rebucket + sort.
 * Tutorial is never modified.
 *
 * After each productive find cell:
 *   canon → D4 start dedupe → exact cells cull → same-shape overlap cull
 *   → rebucket (pushes≥10 → hard; else 5×5 easy / 6×6 medium) → sort pushes then glyphs
 *
 *   node tools/tetromino/padScuttlebugLedger.mjs --cull-only
 *   node tools/tetromino/padScuttlebugLedger.mjs --phase=easy
 *   node tools/tetromino/padScuttlebugLedger.mjs --phase=medium4
 *   node tools/tetromino/padScuttlebugLedger.mjs --phase=hard4
 *   node tools/tetromino/padScuttlebugLedger.mjs --phase=medium5
 *   node tools/tetromino/padScuttlebugLedger.mjs --phase=hard5
 *   node tools/tetromino/padScuttlebugLedger.mjs --phase=all4
 *   node tools/tetromino/padScuttlebugLedger.mjs --phase=all
 *   node tools/tetromino/padScuttlebugLedger.mjs --phase=all --fresh-progress
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { PIECE_TYPES } from './pushEngine.mjs'
import { polishScuttlebugDaily, rebucketByPushes } from './scuttlebugNearDupeCull.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const abs = path.join(repoRoot, 'puzzlegames/scuttlebug/puzzles.js')
const progressAbs = path.join(repoRoot, 'tools/reports/pad-scuttlebug-progress.json')

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
const phase = args.get('phase') || 'all4'
const CULL_ONLY = args.has('cull-only')
const FRESH_PROGRESS = args.has('fresh-progress')
const COUNT = num('count', 50)
const ATTEMPTS = num('attempts', 500000) // same as Dung enumerate cells
const BUDGET_MS = num('budget-ms', 1_800_000) // 30 min/cell wall clock
const MAX_PUSHES = 20
const VERIFY_MS = num('verify-ms', 6000)

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/scuttlebug/engine.js')).href
)
const { normalizePuzzleInput } = engine

function log(msg) {
  process.stderr.write(msg + '\n')
}

function glyphs(p) {
  return typeof p.solution === 'string' ? p.solution.length : 0
}

function blockCount(raw) {
  const p = normalizePuzzleInput(raw, false)
  return p.pieces.length
}

function distinctTypes(raw) {
  const p = normalizePuzzleInput(raw, false)
  return new Set(p.pieces.map((x) => x.type)).size
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
    (Number.isFinite(raw.dif) ? `, dif: ${raw.dif}` : '') +
    (typeof raw.note === 'string' && raw.note ? `, note: ${JSON.stringify(raw.note)}` : '') +
    ','
  const sol =
    typeof raw.solution === 'string' && raw.solution
      ? `\n  solution: ${JSON.stringify(raw.solution)} },`
      : ' },'
  return head + sol
}

function writeLedger(data) {
  const src = fs.readFileSync(abs, 'utf8')
  const headerMatch = src.match(/^[\s\S]*?export default \{\r?\n/)
  if (!headerMatch) throw new Error('header not found')
  const header = headerMatch[0].replace(/\r\n/g, '\n')
  const TIERS = ['tutorial', 'easy', 'medium', 'hard']
  const body = TIERS.map((tier) => {
    const lines = (data[tier] || []).map(formatPuzzle).join('\n')
    return `  ${tier}: [\n${lines}\n  ],`
  }).join('\n\n')
  const out = `${header}${body}\n}\n`
  fs.writeFileSync(abs, src.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out, 'utf8')
}

function loadData() {
  return import(pathToFileURL(abs).href + `?t=${Date.now()}`).then((m) => m.default)
}

function minMovedFor(blocks) {
  if (blocks >= 5) return 4
  if (blocks >= 4) return 3
  return 2
}

/** Keep rows that meet structural floors (no glyph-band gate; tier from pushes). */
function passesStructural(raw) {
  const size = raw.size ?? 5
  const blocks = blockCount(raw)
  const types = distinctTypes(raw)
  const pushes = raw.pushes ?? raw.minPushes ?? 0
  const moved = raw.blocksMoved ?? 0

  if (types !== blocks) return false // no duplicate piece types

  if (size === 5) {
    return (blocks === 2 || blocks === 3) && pushes >= 4 && moved >= 2
  }
  if (size === 6 && (blocks === 4 || blocks === 5)) {
    return moved >= minMovedFor(blocks) && pushes >= 6
  }
  return false
}

function rebucketDaily(easy, medium, hard) {
  const pool = [...easy, ...medium, ...hard].filter(passesStructural)
  return rebucketByPushes(pool, [], [])
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

function d4StartFingerprint(raw) {
  const p = normalizePuzzleInput(raw, false)
  const size = p.size
  let best = null
  for (let orient = 0; orient < 8; orient++) {
    const [pr, pc] = mapCell(p.player.r, p.player.c, size, orient)
    const [hr, hc] = mapCell(p.target.r, p.target.c, size, orient)
    const pieceKeys = p.pieces
      .map((piece) => {
        const cells = piece.cells
          .map((c) => {
            const [r, c2] = mapCell(c.r, c.c, size, orient)
            return `${r},${c2}`
          })
          .sort()
          .join('|')
        return `${piece.type}:${cells}`
      })
      .sort()
    const key = JSON.stringify({ s: size, pl: [pr, pc], h: [hr, hc], p: pieceKeys })
    if (best == null || key < best) best = key
  }
  return best
}

function d4DedupeTiers(data) {
  const seen = new Set()
  const next = { tutorial: data.tutorial || [], easy: [], medium: [], hard: [] }
  let removed = 0
  for (const tier of ['easy', 'medium', 'hard']) {
    for (const raw of data[tier] || []) {
      const fp = d4StartFingerprint(raw)
      if (seen.has(fp)) {
        removed++
        continue
      }
      seen.add(fp)
      next[tier].push(raw)
    }
  }
  return { next, removed }
}

async function cullExisting() {
  const data = await loadData()
  const before = {
    easy: (data.easy || []).length,
    medium: (data.medium || []).length,
    hard: (data.hard || []).length,
  }
  const filtered = rebucketDaily(data.easy || [], data.medium || [], data.hard || [])
  const { next, removed } = d4DedupeTiers({
    tutorial: data.tutorial,
    ...filtered,
  })
  const polished = polishScuttlebugDaily(
    { tutorial: data.tutorial, easy: next.easy, medium: next.medium, hard: next.hard },
    engine
  )
  writeLedger({
    tutorial: polished.tutorial,
    easy: polished.easy,
    medium: polished.medium,
    hard: polished.hard,
  })
  const s = polished.stats
  log(
    `Cull: easy ${before.easy}→${s.easy}, medium ${before.medium}→${s.medium}, hard ${before.hard}→${s.hard}` +
      ` (D4 −${removed}; cells −${s.cellsRemoved}; overlap −${s.overlapRemoved})`
  )
}

function combinations(n, k) {
  const out = []
  const idx = Array.from({ length: k }, (_, i) => i)
  const walk = (start, depth) => {
    if (depth === k) {
      out.push(idx.slice())
      return
    }
    for (let i = start; i < n; i++) {
      idx[depth] = i
      walk(i + 1, depth + 1)
    }
  }
  walk(0, 0)
  return out
}

function countsFromTypes(types) {
  const c = Object.fromEntries(PIECE_TYPES.map((t) => [t, 0]))
  for (const t of types) c[t] = 1
  return PIECE_TYPES.map((t) => c[t]).join(',')
}

function buildCells(phaseName) {
  const cells = []
  if (phaseName === 'easy' || phaseName === 'all4' || phaseName === 'all') {
    for (const k of [2, 3]) {
      for (const comb of combinations(5, k)) {
        const types = comb.map((i) => PIECE_TYPES[i])
        cells.push({
          id: `easy-${types.join('')}-p4`,
          tierHint: 'easy',
          size: 5,
          counts: countsFromTypes(types),
          minPushes: 4,
          minMoved: 2,
          maxMoves: 40,
        })
      }
    }
  }
  if (phaseName === 'medium4' || phaseName === 'all4' || phaseName === 'all') {
    for (const comb of combinations(5, 4)) {
      const types = comb.map((i) => PIECE_TYPES[i])
      for (const minPushes of [6, 7, 8, 9, 10]) {
        cells.push({
          id: `medium4-${types.join('')}-p${minPushes}`,
          tierHint: 'medium',
          size: 6,
          counts: countsFromTypes(types),
          minPushes,
          minMoved: 3,
          maxMoves: 50,
        })
      }
    }
  }
  if (phaseName === 'hard4' || phaseName === 'all4' || phaseName === 'all') {
    for (const comb of combinations(5, 4)) {
      const types = comb.map((i) => PIECE_TYPES[i])
      for (const minPushes of [10, 11, 12, 13, 14, 15]) {
        cells.push({
          id: `hard4-${types.join('')}-p${minPushes}`,
          tierHint: 'hard',
          size: 6,
          counts: countsFromTypes(types),
          minPushes,
          minMoved: 3,
          maxMoves: 100,
        })
      }
    }
  }
  if (phaseName === 'medium5' || phaseName === 'all') {
    for (const minPushes of [6, 7, 8, 9, 10]) {
      cells.push({
        id: `medium5-ILOST-p${minPushes}`,
        tierHint: 'medium',
        size: 6,
        counts: '1,1,1,1,1',
        minPushes,
        minMoved: 4,
        maxMoves: 50,
      })
    }
  }
  if (phaseName === 'hard5' || phaseName === 'all') {
    for (const minPushes of [10, 11, 12, 13, 14, 15]) {
      cells.push({
        id: `hard5-ILOST-p${minPushes}`,
        tierHint: 'hard',
        size: 6,
        counts: '1,1,1,1,1',
        minPushes,
        minMoved: 4,
        maxMoves: 100,
      })
    }
  }
  return cells
}

function runFind(cell) {
  return new Promise((resolve, reject) => {
    const findJs = path.join(repoRoot, 'tools/tetromino/findTetrominoPuzzles.mjs')
    const argv = [
      findJs,
      '--mode=scuttle',
      `--size=${cell.size}`,
      `--counts=${cell.counts}`,
      `--min-pushes=${cell.minPushes}`,
      `--max-pushes=${MAX_PUSHES}`,
      `--min-moved=${cell.minMoved}`,
      `--max-moves=${cell.maxMoves}`,
      `--count=${COUNT}`,
      `--attempts=${ATTEMPTS}`,
      `--budget-ms=${BUDGET_MS}`,
      `--verify-ms=${VERIFY_MS}`,
    ]
    log(`\n── find ${cell.id} ──\n  node ${argv.map((a) => (a.includes(' ') ? JSON.stringify(a) : a)).join(' ')}`)
    const child = spawn(process.execPath, argv, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d
    })
    child.stderr.on('data', (d) => {
      const s = d.toString()
      stderr += s
      process.stderr.write(s)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code, stdout, stderr })
    })
  })
}

function parseLedgerStdout(stdout) {
  const trimmed = stdout.trim()
  if (!trimmed) return []
  // formatLedgerLine emits `{ ... },` lines (possibly multiline)
  try {
    // eslint-disable-next-line no-new-func
    const arr = Function(`"use strict"; return [${trimmed}\n]`)()
    return arr.filter((x) => x && typeof x === 'object')
  } catch (e) {
    log(`  parse error: ${e.message}`)
    return []
  }
}

function runCanon() {
  return new Promise((resolve, reject) => {
    const js = path.join(repoRoot, 'tools/tetromino/canonicalizeTetrominoSolutions.mjs')
    const child = spawn(process.execPath, [js, '--mode=scuttle', '--write'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stderr.on('data', (d) => process.stderr.write(d))
    child.stdout.on('data', (d) => process.stderr.write(d))
    child.on('error', reject)
    child.on('close', (code) => resolve(code))
  })
}

async function mergeAndPolish(newPuzzles, tierHint) {
  if (!newPuzzles.length) return
  const data = await loadData()
  const easy = [...(data.easy || [])]
  const medium = [...(data.medium || [])]
  const hard = [...(data.hard || [])]
  if (tierHint === 'easy') easy.push(...newPuzzles)
  else if (tierHint === 'hard') hard.push(...newPuzzles)
  else medium.push(...newPuzzles)

  writeLedger({ tutorial: data.tutorial, easy, medium, hard })
  log(`  merged ${newPuzzles.length} into ${tierHint}; canonicalizing…`)
  const canonCode = await runCanon()
  if (canonCode !== 0) log(`  canonicalize exited ${canonCode}`)

  const after = await loadData()
  const structural = rebucketDaily(after.easy || [], after.medium || [], after.hard || [])
  const { next, removed } = d4DedupeTiers({ tutorial: after.tutorial, ...structural })
  log(`  D4 start dedupe −${removed}; near-dupe cull…`)
  const polished = polishScuttlebugDaily(
    { tutorial: after.tutorial, easy: next.easy, medium: next.medium, hard: next.hard },
    engine
  )
  writeLedger({
    tutorial: polished.tutorial,
    easy: polished.easy,
    medium: polished.medium,
    hard: polished.hard,
  })
  const s = polished.stats
  log(
    `  post: easy ${s.easy}, medium ${s.medium}, hard ${s.hard}` +
      ` (cells −${s.cellsRemoved}/${s.cellsClusters}cl, overlap −${s.overlapRemoved}/${s.overlapClumps}cl)`
  )
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(progressAbs, 'utf8'))
  } catch {
    return { done: {}, startedAt: new Date().toISOString() }
  }
}

function saveProgress(progress) {
  fs.mkdirSync(path.dirname(progressAbs), { recursive: true })
  fs.writeFileSync(progressAbs, JSON.stringify(progress, null, 2), 'utf8')
}

/** Family id without the -pN floor suffix (e.g. hard4-ILOS). */
function familyKey(cellOrId) {
  const id = typeof cellOrId === 'string' ? cellOrId : cellOrId.id
  return id.replace(/-p\d+$/, '')
}

/**
 * When a min-pushes floor yields 0–5 keepers, higher floors in the same
 * type-family are almost always barren — mark them skipped.
 */
function markHigherFloorsSkipped(cells, progress, triggerCell, kept) {
  let n = 0
  for (const later of cells) {
    if (familyKey(later) !== familyKey(triggerCell)) continue
    if (later.minPushes <= triggerCell.minPushes) continue
    if (progress.done[later.id]?.complete) continue
    progress.done[later.id] = {
      complete: true,
      kept: 0,
      skipped: true,
      reason: `low-yield-${triggerCell.id}(${kept})`,
      at: new Date().toISOString(),
    }
    n++
  }
  if (n) {
    log(
      `  low yield (${kept} new) — skipping ${n} higher min-pushes for ${familyKey(triggerCell)}`
    )
    saveProgress(progress)
  }
  return n
}

/** Apply skip rule from already-completed low-yield cells (resume). */
function applyLowYieldSkips(cells, progress) {
  for (const cell of cells) {
    const d = progress.done[cell.id]
    if (!d?.complete || d.skipped) continue
    if ((d.kept ?? 0) > 5) continue
    markHigherFloorsSkipped(cells, progress, cell, d.kept ?? 0)
  }
}

async function main() {
  log(`padScuttlebug phase=${phase} count=${COUNT} attempts=${ATTEMPTS} budgetMs=${BUDGET_MS}`)
  await cullExisting()
  if (CULL_ONLY) return

  const cells = buildCells(phase)
  log(`Cells to run: ${cells.length}`)
  if (FRESH_PROGRESS && fs.existsSync(progressAbs)) {
    fs.unlinkSync(progressAbs)
    log(`Cleared progress ${progressAbs}`)
  }
  const progress = loadProgress()
  applyLowYieldSkips(cells, progress)

  for (const cell of cells) {
    if (progress.done[cell.id]?.complete) {
      const d = progress.done[cell.id]
      if (d.skipped) log(`skip ${cell.id} (${d.reason || 'low-yield predecessor'})`)
      else log(`skip ${cell.id} (already done, kept ${d.kept})`)
      continue
    }
    const { code, stdout } = await runFind(cell)
    const puzzles = parseLedgerStdout(stdout)
    log(`  find exit=${code} parsed=${puzzles.length}`)
    progress.done[cell.id] = {
      complete: true,
      kept: puzzles.length,
      exit: code,
      at: new Date().toISOString(),
    }
    saveProgress(progress)
    if (puzzles.length) await mergeAndPolish(puzzles, cell.tierHint)
    if (puzzles.length <= 5) markHigherFloorsSkipped(cells, progress, cell, puzzles.length)
  }

  log('\nAll requested cells finished.')
  const final = await loadData()
  log(
    `Final: tutorial ${(final.tutorial || []).length}, easy ${(final.easy || []).length}, medium ${(final.medium || []).length}, hard ${(final.hard || []).length}`
  )
}

await main()
