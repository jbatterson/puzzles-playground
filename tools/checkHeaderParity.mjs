import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8')
}

const checks = []

const suiteFiles = [
  'puzzlegames/sumtiles/sumtiles.jsx',
  'puzzlegames/productiles/productiles.jsx',
  'puzzlegames/swipe/swipe.jsx',
]

for (const relPath of suiteFiles) {
  const content = read(relPath)
  checks.push({
    name: `${relPath} uses shared chrome contract`,
    ok: /getGameChrome\(GAME_KEYS\./.test(content),
  })
  checks.push({
    name: `${relPath} uses puzzle chrome menu in header`,
    ok: /puzzleChrome=\{\{/.test(content),
  })
}

const failed = checks.filter((c) => !c.ok)
if (failed.length) {
  console.error('Header parity check failed:')
  for (const check of failed) {
    console.error(`- ${check.name}`)
  }
  process.exit(1)
}

console.log('Header parity check passed.')
