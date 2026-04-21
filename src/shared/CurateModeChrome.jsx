import React from 'react'

export function CurateCopyToast({ message }) {
  if (!message) return null
  return (
    <div
      className="toast-panel share-result-toast toast-fixed-chip"
      style={{
        position: 'fixed',
        top: 58,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        padding: '10px 14px',
      }}
      role="status"
    >
      {message}
    </div>
  )
}

/**
 * @param {object} props
 * @param {string} props.exitCurateHref
 * @param {number} props.curateIdx
 * @param {(fn: (n: number) => number) => void} props.setCurateIdx
 * @param {{ tier: string, indexInTier: number, puzzle: unknown }[]} props.roster
 * @param {Record<string, unknown>} props.puzzleData — original module export (for tier lengths)
 * @param {React.ReactNode} [props.metricsSlot] — e.g. bugs/folds counts (left column, under exit)
 */
export function CurateLevelNav({
  exitCurateHref,
  curateIdx,
  setCurateIdx,
  roster,
  puzzleData,
  metricsSlot = null,
}) {
  const entry = roster[curateIdx]
  const tierTotal =
    entry && puzzleData && Array.isArray(puzzleData[entry.tier]) ? puzzleData[entry.tier].length : 0

  return (
    <div className="level-nav">
      <div className="left-spacer level-nav__left-stack">
        <a className="skip-link" href={exitCurateHref}>
          Exit curate
        </a>
        {metricsSlot ? <div className="stats-group stats-group--left">{metricsSlot}</div> : null}
      </div>
      <div className="selector-group">
        <button
          type="button"
          className={`nav-arrow ${curateIdx === 0 ? 'disabled' : ''}`}
          onClick={() => {
            if (curateIdx > 0) setCurateIdx((j) => j - 1)
          }}
        >
          ←
        </button>
        <div className="level-label" style={{ textAlign: 'center' }}>
          <span className="sub">{entry?.tier ?? ''}</span>
          <span className="num">
            {entry ? entry.indexInTier + 1 : 0} / {tierTotal}
          </span>
          <div style={{ fontSize: '0.78rem', opacity: 0.88, marginTop: 2 }}>
            {curateIdx + 1} / {roster.length} total
          </div>
        </div>
        <button
          type="button"
          className={`nav-arrow ${curateIdx >= roster.length - 1 ? 'disabled' : ''}`}
          onClick={() => {
            if (curateIdx < roster.length - 1) setCurateIdx((j) => j + 1)
          }}
        >
          →
        </button>
      </div>
      <div className="level-nav__right-slot" aria-hidden />
    </div>
  )
}
