import React from 'react'
import DiceFace from './DiceFace.jsx'
import { HubDiceStar, HubDiceCheck } from './HubDiceStar.jsx'
import { isTileGameKey } from '@shared-contracts/gameChrome.js'
import { PUZZLE_SUITE_INK, PUZZLE_SUITE_SURFACE_INCOMPLETE } from '@shared-contracts/chromeUi.js'
import {
  getEnabledTierIndices,
  readSuiteDashboardPreferences,
} from '@shared-contracts/suiteDashboardPreferences.js'

/**
 * Hub-style dice for the completion modal (matches home card row; respects suite tier prefs).
 * @param {{ gameKey: string, completions: boolean[], perfects: boolean[], moveCounts?: (number|null)[] }} props
 */
export default function SuiteCompletionHubDice({
  gameKey,
  completions,
  perfects,
  moveCounts,
}) {
  const isTileGame = isTileGameKey(gameKey)
  const prefs = readSuiteDashboardPreferences()
  const slots = getEnabledTierIndices(gameKey, prefs)

  return (
    <div
      style={{
        display: 'flex',
        gap: '6px',
        marginTop: '8px',
        justifyContent: 'center',
      }}
    >
      {slots.map((i) => {
        const done = !!completions[i]
        const moves = moveCounts != null ? moveCounts[i] : null
        const content = !done ? (
          <DiceFace count={i + 1} size={20} />
        ) : isTileGame ? (
          perfects[i] ? (
            <HubDiceStar />
          ) : moves != null ? (
            String(Math.min(moves, 99))
          ) : (
            <HubDiceCheck />
          )
        ) : perfects[i] ? (
          <HubDiceStar />
        ) : (
          <HubDiceCheck />
        )
        return (
          <div
            key={i}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: done ? '#6b9b3b' : PUZZLE_SUITE_SURFACE_INCOMPLETE,
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
