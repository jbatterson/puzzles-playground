/**
 * Hub and in-game share plaintext formatters for suite games.
 * Progress is read via hubProgress.js, which is the single source of truth for localStorage access.
 */

import { readSuiteGameElapsedMs } from './suiteCompletionTimer.js'
import { formatAllTenElapsedMsForShare } from './allTenSharePlaintext.js'
import { isTileGameKey } from './gameChrome.js'
import { loadCompletions, loadPerfects, loadMoveCounts } from './hubProgress.js'
import {
  getEnabledTierIndices,
  isSuiteTimerEnabled,
  readSuiteDashboardPreferences,
} from './suiteDashboardPreferences.js'

function elapsedLineForShare(gameKey, dateKey) {
  if (!isSuiteTimerEnabled()) return ''
  const ms = readSuiteGameElapsedMs(gameKey, dateKey)
  if (ms == null) return ''
  return `\n${formatAllTenElapsedMsForShare(ms)}\n`
}

const DIFF_LABELS = ['Easy', 'Med', 'Hard']

const GAME_TITLES = Object.freeze({
  sumtiles: 'Sum Tiles',
  productiles: 'Productiles',
  rolypoly: 'Roly Poly',
})

function buildShareText(key, title, href, completions, perfects, moveCounts, dateKey, prefs) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const playUrl = new URL(href, origin || 'http://localhost').href
  const isTileGame = isTileGameKey(key)
  const tiers = getEnabledTierIndices(key, prefs)
  let out = title.toUpperCase() + '\n'
  for (const i of tiers) {
    const label = DIFF_LABELS[i]
    if (completions[i]) {
      let moves = ''
      if (isTileGame && moveCounts && moveCounts[i] != null) {
        const star = perfects && perfects[i] ? ' ⭐' : ''
        moves = ` (${moveCounts[i]} moves${star})`
      }
      const firstTry = !isTileGame && perfects && perfects[i] ? ' (⭐ First try!)' : ''
      out += `${label}   🟩${moves}${firstTry}\n`
    } else {
      out += `${label}   ⬜\n`
    }
  }
  out += elapsedLineForShare(key, dateKey)
  out += playUrl
  return out
}

/**
 * Whether the hub would show an enabled share for this game/date (any completion).
 * @param {string} gameKey
 * @param {string} dateKey
 * @returns {boolean}
 */
export function hasShareableHubProgress(gameKey, dateKey) {
  const prefs = readSuiteDashboardPreferences()
  if (!GAME_TITLES[gameKey]) return false
  const completions = loadCompletions(gameKey, dateKey)
  return getEnabledTierIndices(gameKey, prefs).some((i) => completions[i])
}

/**
 * Plaintext copied by hub share and suite completion modals.
 * @param {string} gameKey
 * @param {string} dateKey — PST calendar YYYY-MM-DD
 * @param {string} [baseHref] — `import.meta.env.BASE_URL` (e.g. /Puzzles/)
 * @returns {string}
 */
export function buildHubSharePlaintext(gameKey, dateKey, baseHref = '/') {
  const title = GAME_TITLES[gameKey]
  if (!title) return ''
  const prefs = readSuiteDashboardPreferences()
  const b = baseHref.endsWith('/') ? baseHref : `${baseHref}/`
  const href = `${b}puzzlegames/${gameKey}/`
  return buildShareText(
    gameKey,
    title,
    href,
    loadCompletions(gameKey, dateKey),
    loadPerfects(gameKey, dateKey),
    loadMoveCounts(gameKey, dateKey),
    dateKey,
    prefs
  )
}
