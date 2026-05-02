/**
 * Rewrites Sum Tiles / Productiles puzzle files (one puzzle object per line per tier).
 * Run from repo root: node --import ./tools/registerSharedContractsResolve.mjs tools/compactPuzzleData.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const repoRoot = path.resolve(import.meta.dirname, '..')

const TIER_ORDER = ['tutorial', 'easy', 'medium', 'hard']

/**
 * @param {string} key
 */
function jsKey(key) {
  if (/^[a-zA-Z_$][\w$]*$/.test(key)) return key
  return `'${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/**
 * @param {unknown} value
 */
function toJs(value) {
  if (value === null) return 'null'
  const t = typeof value
  if (t === 'number' || t === 'boolean') return String(value)
  if (t === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }
  if (Array.isArray(value)) {
    const inner = value.map((v) => toJs(v)).join(', ')
    return `[${inner}]`
  }
  if (t === 'object') {
    const o = /** @type {Record<string, unknown>} */ (value)
    const parts = Object.keys(o).map((k) => `${jsKey(k)}: ${toJs(o[k])}`)
    return `{ ${parts.join(', ')} }`
  }
  return 'undefined'
}

/**
 * @param {Record<string, unknown[]>} data
 */
function formatExportBody(data) {
  const tiers = TIER_ORDER.filter((t) => Object.prototype.hasOwnProperty.call(data, t))
  const blocks = tiers.map((tier) => {
    const list = data[tier]
    if (!Array.isArray(list)) throw new Error(`Tier "${tier}" is not an array`)
    const lines = list.map((p) => `    ${toJs(p)},`)
    return `  ${tier}: [\n${lines.join('\n')}\n  ],`
  })
  return `export default {\n${blocks.join('\n\n')}\n}\n`
}

let cacheNonce = 0

async function loadDefault(rel) {
  const abs = path.join(repoRoot, rel)
  const url = pathToFileURL(abs).href + `?c=${++cacheNonce}`
  const mod = await import(url)
  return mod.default
}

async function main() {
  for (const rel of ['puzzlegames/sumtiles/puzzles.js', 'puzzlegames/productiles/puzzles.js']) {
    const data = await loadDefault(rel)
    const abs = path.join(repoRoot, rel)
    fs.writeFileSync(abs, formatExportBody(/** @type {Record<string, unknown[]>} */ (data)), 'utf8')
    console.log('Wrote', rel)
  }

  console.log('Done. Run: npm run check:puzzle-schemas')
}

await main()
