import React from 'react'
import DiceFace from './DiceFace.jsx'
import { HubDiceStar, HubDiceCheck } from './HubDiceStar.jsx'
import { isTileGameKey } from '@shared-contracts/gameChrome.js'
import { PUZZLE_SUITE_CORRECT_GREEN, PUZZLE_SUITE_INK, PUZZLE_SUITE_SURFACE_INCOMPLETE } from '@shared-contracts/chromeUi.js'
import {
  getEnabledTierIndices,
  readSuiteDashboardPreferences,
} from '@shared-contracts/suiteDashboardPreferences.js'
import { BONUS_SLOT } from '@shared-contracts/bonusPuzzle.js'

function dieContent({ done, isTileGame, perfect, moves, incompleteFace }) {
  if (!done) return incompleteFace
  if (isTileGame) {
    if (perfect) return <HubDiceStar />
    if (moves != null) return String(Math.min(moves, 99))
    return <HubDiceCheck />
  }
  return perfect ? <HubDiceStar /> : <HubDiceCheck />
}

/**
 * Hub-style dice for the completion modal (matches home card row; respects suite tier prefs).
 * When `bonusUnlocked`, appends a 4th die (incomplete = "!").
 *
 * @param {{
 *   gameKey: string,
 *   completions: boolean[],
 *   perfects: boolean[],
 *   moveCounts?: (number|null)[],
 *   doneColor?: string,
 *   bonusUnlocked?: boolean,
 * }} props
 */
export default function SuiteCompletionHubDice({
  gameKey,
  completions,
  perfects,
  moveCounts,
  doneColor = PUZZLE_SUITE_CORRECT_GREEN,
  bonusUnlocked = false,
}) {
  const isTileGame = isTileGameKey(gameKey)
  const prefs = readSuiteDashboardPreferences()
  const slots = getEnabledTierIndices(gameKey, prefs)
  const showSlots = bonusUnlocked ? [...slots, BONUS_SLOT] : slots

  return (
    <div
      style={{
        display: 'flex',
        gap: '6px',
        marginTop: '8px',
        justifyContent: 'center',
      }}
    >
      {showSlots.map((i) => {
        const done = !!completions[i]
        const moves = moveCounts != null ? moveCounts[i] : null
        const incompleteFace =
          i === BONUS_SLOT ? (
            '!'
          ) : (
            <DiceFace count={i + 1} size={20} />
          )
        const content = dieContent({
          done,
          isTileGame,
          perfect: !!perfects[i],
          moves,
          incompleteFace,
        })
        return (
          <div
            key={i}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: done ? doneColor : PUZZLE_SUITE_SURFACE_INCOMPLETE,
              color: done ? '#fff' : PUZZLE_SUITE_INK,
              fontWeight: 900,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}
