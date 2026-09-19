/**
 * Trace naive-look h along Dung Beetle solutions.
 *
 *   node tools/tetromino/traceNaiveLook.mjs
 *   node tools/tetromino/traceNaiveLook.mjs --tier=tutorial --index=0,1
 *   node tools/tetromino/traceNaiveLook.mjs --tier=easy --index=0,1,2 --piece-cost=4
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { dirFromSolutionChar } from './pushEngine.mjs'
import { traceNaiveLook } from './naiveLook.mjs'

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

const tier = args.get('tier') || 'tutorial'
const pieceCost = args.has('piece-cost') ? Number(args.get('piece-cost')) : 4
const indexArg = args.get('index')
const indexes = indexArg
  ? indexArg.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
  : null

const engine = await import(
  pathToFileURL(path.join(repoRoot, 'puzzlegames/dungbeetle/engine.js')).href
)
const data = (
  await import(pathToFileURL(path.join(repoRoot, 'puzzlegames/dungbeetle/puzzles.js')).href)
).default

const rows = data[tier] || []
if (!rows.length) {
  console.error(`No puzzles in tier "${tier}"`)
  process.exit(1)
}

const pick = indexes ?? [...rows.keys()].slice(0, Math.min(5, rows.length))

console.log(`dungbeetle / ${tier}  pieceCost=${pieceCost}`)
console.log('h = 100*(1-reach) + 10*(1-clear) + (clear ? ballDist : softDist)\n')

let failures = 0

for (const i of pick) {
  const raw = rows[i]
  if (!raw) {
    console.log(`#${i}: (missing)`)
    continue
  }

  const t = traceNaiveLook(engine, raw, { dirFromSolutionChar, pieceCost })
  if (!t.ok) {
    failures++
    console.log(`#${i}: FAIL ${t.why}`)
    continue
  }

  console.log(
    `#${i}  pushes=${t.pushes} ballPushes=${t.ballPushes}  ` +
      `hStart=${t.hStart} hAfterLastPush=${t.hEnd}  ` +
      `counterintuitive=${t.counterintuitive}  clearFlip@${t.clearFlipAt ?? '—'}  ` +
      `sol=${t.solution}`
  )

  for (const e of t.events) {
    const flag = e.counterintuitive ? '  *** CI ***' : ''
    const dist = e.clear ? `ballDist=${e.ballDist}` : `softDist=${e.softDist}`
    const delta =
      e.at === 'start' ? '' : `  Δ=${e.delta > 0 ? '+' : ''}${e.delta}`
    console.log(
      `  ${e.at.padEnd(6)} ch=${(e.ch || '·').padEnd(2)}  h=${String(e.h).padStart(4)}  ` +
        `reach=${e.reachBall ? 1 : 0} clear=${e.clear ? 1 : 0}  ${dist}${delta}${flag}`
    )
  }
  console.log('')
}

if (failures) process.exit(1)
