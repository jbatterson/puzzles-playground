import React from 'react'

/**
 * Yesterday-practice right-slot control: Show Solution / Pause, or Reset when
 * playback is unavailable (board not pristine).
 */
export default function YesterdaySolutionNavButton({
  playbackEnabled,
  playbackStatus,
  onTogglePlayback,
  onReset,
  canReset,
}) {
  if (playbackEnabled) {
    const label =
      playbackStatus === 'playing' ? 'Pause' : playbackStatus === 'paused' ? 'Resume' : 'Show Solution'
    return (
      <button type="button" className="skip-link" onClick={onTogglePlayback}>
        {label}
      </button>
    )
  }

  return (
    <button type="button" className="skip-link" onClick={onReset} disabled={!canReset}>
      Reset
    </button>
  )
}
