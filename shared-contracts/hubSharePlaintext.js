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
  THREE_TIER_GAME_KEYS,
} from './suiteDashboardPreferences.js'

function elapsedLineForShare(gameKey, dateKey) {
  if (!isSuiteTimerEnabled()) return ''
  const ms = readSuiteGameElapsedMs(gameKey, dateKey)
  if (ms == null) return ''
  return `${formatAllTenElapsedMsForShare(ms)}\n`
}

const DIFF_LABELS = ['Easy', 'Med', 'Hard']

const GAME_TITLES = Object.freeze({
  sumtiles: 'Sum Tiles',
  productiles: 'Productiles',
  rolypoly: 'Roly Poly',
  dungbeetle: 'Dung Beetle',
  scuttlebug: 'Scuttlebug',
})

/** Hub tile order for aggregate share. */
export const HUB_SHARE_GAME_KEYS = Object.freeze([...THREE_TIER_GAME_KEYS])

function absoluteUrl(href, baseHref) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return new URL(href, origin || 'http://localhost').href
}

/**
 * One game’s share body (title, tiers, optional timer). No play URL.
 * @returns {string} empty when the game key is unknown
 */
function buildShareBody(key, title, completions, perfects, moveCounts, dateKey, prefs) {
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
  return out
}

function buildShareText(key, title, href, completions, perfects, moveCounts, dateKey, prefs) {
  const body = buildShareBody(key, title, completions, perfects, moveCounts, dateKey, prefs)
  if (!body) return ''
  return body + absoluteUrl(href)
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
 * True if any suite game has shareable progress for the date.
 * @param {string} dateKey
 * @returns {boolean}
 */
export function hasAnyShareableHubProgress(dateKey) {
  return HUB_SHARE_GAME_KEYS.some((key) => hasShareableHubProgress(key, dateKey))
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

/**
 * Aggregate plaintext for all suite games with shareable progress today.
 * Per-game play URLs are omitted; a single hub URL is appended at the end.
 * @param {string} dateKey — PST calendar YYYY-MM-DD
 * @param {string} [baseHref] — `import.meta.env.BASE_URL` (e.g. /Puzzles/)
 * @returns {string} empty when nothing is shareable
 */
export function buildAllHubSharePlaintext(dateKey, baseHref = '/') {
  const prefs = readSuiteDashboardPreferences()
  const b = baseHref.endsWith('/') ? baseHref : `${baseHref}/`
  const bodies = []
  for (const key of HUB_SHARE_GAME_KEYS) {
    if (!hasShareableHubProgress(key, dateKey)) continue
    const title = GAME_TITLES[key]
    bodies.push(
      buildShareBody(
        key,
        title,
        loadCompletions(key, dateKey),
        loadPerfects(key, dateKey),
        loadMoveCounts(key, dateKey),
        dateKey,
        prefs
      )
    )
  }
  if (bodies.length === 0) return ''
  const hubUrl = absoluteUrl(b)
  // Each body ends with \n; join with \n → blank line between games; trailing \n before hub URL.
  return `${bodies.join('\n')}\n${hubUrl}`
}
