import React, { useMemo, useState, useCallback } from 'react'
import TopBar from './shared/TopBar.jsx'
import PlaygroundLinksModal from './shared/PlaygroundLinksModal.jsx'
import SuiteSettingsModal from './shared/SuiteSettingsModal.jsx'
import AddToHomeScreenModal from './shared/AddToHomeScreenModal.jsx'
import './shared/style.css'
import ProductilesIcon from './shared/icons/ProductilesIcon.jsx'
import SumTilesIcon from './shared/icons/SumTilesIcon.jsx'
import SwipeIcon from './shared/icons/SwipeIcon.jsx'
import DiceFace from './shared/DiceFace.jsx'
import { HubDiceStar, HubDiceCheck } from './shared/HubDiceStar.jsx'
import { PUZZLE_SUITE_INK, PUZZLE_SUITE_SURFACE_INCOMPLETE } from '@shared-contracts/chromeUi.js'
import {
  SUITE_DASHBOARD_PREFS_KEY,
  getEnabledTierIndices,
  hubHrefFirstUnfinishedThreeWithPrefs,
  isPuzzleOnInSuitePrefs,
  isSuiteCompleteForPrefs,
  isThreeTierGameKey,
  readSuiteDashboardPreferences,
} from '@shared-contracts/suiteDashboardPreferences.js'
import { getDailyKey, computeStreak } from '@shared-contracts/dailyPuzzleDate.js'
import { formatPuzzleDateHeading } from '@shared-contracts/suiteCompletionTimer.js'
import { isTileGameKey } from '@shared-contracts/gameChrome.js'
import { loadCompletions, loadPerfects, loadMoveCounts } from '@shared-contracts/hubProgress.js'

const base = import.meta.env.BASE_URL

const MAX_STREAK_DAYS = 365

/** True if the player’s enabled suite for that game is fully complete on that calendar day (PST). */
function dayHasCompletion(gameKey, dateKey) {
  if (isThreeTierGameKey(gameKey)) return isSuiteCompleteForPrefs(gameKey, dateKey)
  return false
}

function PuzzleBoxes({ gameKey, completions, perfects, moveCounts, tierSlots }) {
  const isTileGame = isTileGameKey(gameKey)
  const c = completions ?? [false, false, false]
  const p = perfects ?? [false, false, false]
  const mc = moveCounts ?? [null, null, null]
  const slots = tierSlots ?? [0, 1, 2]
  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
      {slots.map((i) => {
        const done = c[i]
        const perfect = p[i]
        const moves = mc[i] != null ? mc[i] : null
        const content = !done ? (
          <DiceFace count={i + 1} size={20} />
        ) : isTileGame ? (
          perfect ? (
            <HubDiceStar />
          ) : moves != null ? (
            String(Math.min(moves, 99))
          ) : (
            <HubDiceCheck />
          )
        ) : perfect ? (
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

const GAMES = [
  {
    key: 'sumtiles',
    href: `${base}puzzlegames/sumtiles/`,
    Icon: SumTilesIcon,
    title: 'Sum Tiles',
    desc: 'Slide tiles so every row and column hits its sum.',
  },
  {
    key: 'productiles',
    href: `${base}puzzlegames/productiles/`,
    Icon: ProductilesIcon,
    title: 'Productiles',
    desc: 'Slide tiles so every row and column hits its product.',
  },
  {
    key: 'swipe',
    href: `${base}puzzlegames/swipe/`,
    Icon: SwipeIcon,
    title: 'Roly Poly',
    desc: 'Swipe to roll every bug onto a yellow target.',
  },
]

export default function Home() {
  const [dateKey, setDateKey] = useState(getDailyKey)
  const today = formatPuzzleDateHeading(dateKey)

  const [suitePrefs, setSuitePrefs] = useState(() => readSuiteDashboardPreferences())
  const [showSettings, setShowSettings] = useState(false)
  const [showAddToHomeGuide, setShowAddToHomeGuide] = useState(false)
  const refreshSuitePrefs = useCallback(() => setSuitePrefs(readSuiteDashboardPreferences()), [])

  const completions = useMemo(
    () => Object.fromEntries(GAMES.map((g) => [g.key, loadCompletions(g.key, dateKey)])),
    [dateKey]
  )
  const perfects = useMemo(
    () => Object.fromEntries(GAMES.map((g) => [g.key, loadPerfects(g.key, dateKey)])),
    [dateKey]
  )
  const moveCounts = useMemo(
    () => Object.fromEntries(GAMES.map((g) => [g.key, loadMoveCounts(g.key, dateKey)])),
    [dateKey]
  )

  const [streakRefresh, setStreakRefresh] = useState(0)
  const streaks = useMemo(
    () =>
      Object.fromEntries(
        GAMES.map((g) => [
          g.key,
          computeStreak((dateKey) => dayHasCompletion(g.key, dateKey), MAX_STREAK_DAYS),
        ])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- streakRefresh, suitePrefs intentionally invalidate
    [streakRefresh, suitePrefs]
  )

  const gamesOnDashboard = useMemo(
    () => GAMES.filter((g) => isPuzzleOnInSuitePrefs(g.key, suitePrefs)),
    [suitePrefs]
  )
  const gamesHidden = useMemo(
    () => GAMES.filter((g) => !isPuzzleOnInSuitePrefs(g.key, suitePrefs)),
    [suitePrefs]
  )
  const settingsGamesList = useMemo(
    () => GAMES.map(({ key, title, Icon }) => ({ key, title, Icon })),
    []
  )

  const [showLinks, setShowLinks] = useState(false)

  React.useEffect(() => {
    const bumpStreaks = () => {
      setDateKey(getDailyKey())
      setStreakRefresh((n) => n + 1)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') bumpStreaks()
    }
    const onPageShow = (e) => {
      if (e.persisted) bumpStreaks()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onPageShow)
    const onStorage = (e) => {
      bumpStreaks()
      if (e.key === SUITE_DASHBOARD_PREFS_KEY) refreshSuitePrefs()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('storage', onStorage)
    }
  }, [refreshSuitePrefs])

  return (
    <>
      <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;900&display=swap');

                :root {
                    --bg: #ffffff;
                    --text: var(--puzzle-ink);
                    --muted: var(--puzzle-ink-muted);
                    --hairline: #e7e7e7;
                    --tile: #f4f4f4;
                    --tileHover: #eeeeee;
                    --shadow: 0 1px 0 rgba(26, 61, 91, 0.06);
                    --hp-card-bg: #f7f8f9;
                    --hp-card-hover: #f1f3f5;
                    --hp-card-shadow: 0 1px 0 rgba(26, 61, 91, 0.04);
                    --hp-card-focus: rgba(26, 61, 91, 0.26);
                    --radius: 10px;
                }

                * { box-sizing: border-box; }

                #root {
                    max-width: none;
                    width: 100%;
                }

                body {
                    margin: 0;
                    background: var(--bg);
                    color: var(--text);
                    font-family: 'Outfit', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
                    -webkit-font-smoothing: antialiased;
                }

                .hp-shell {
                    min-height: 100dvh;
                    display: flex;
                    flex-direction: column;
                }

                .hp-page {
                    flex: 1;
                    width: min(95vw, 500px);
                    max-width: min(95vw, 500px);
                    margin: 0 auto;
                    box-sizing: border-box;
                    padding: 18px 20px 48px;
                }

                .hp-intro {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 18px;
                }

                .hp-tagline {
                    margin: 0;
                    font-size: 15px;
                    font-weight: 600;
                    line-height: 1.4;
                    color: var(--puzzle-ink-soft);
                    max-width: 52ch;
                }

                .hp-date {
                    font-size: 13px;
                    color: var(--puzzle-ink-muted);
                    letter-spacing: 0.02em;
                }

                .hp-divider {
                    height: 2px;
                    background: var(--puzzle-grid-line);
                    margin: 18px 0;
                }

                .hp-list {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 14px;
                }

                a.hp-card {
                    display: flex;
                    gap: 16px;
                    text-decoration: none;
                    color: inherit;
                    padding: 12px;
                    border-radius: var(--radius);
                    background: var(--hp-card-bg);
                    box-shadow: var(--hp-card-shadow);
                    transition: background 140ms ease, transform 140ms ease, box-shadow 140ms ease;
                }

                a.hp-card:hover {
                    background: var(--hp-card-hover);
                    box-shadow: 0 1px 0 rgba(26, 61, 91, 0.055);
                    transform: translateY(-1px);
                }

                a.hp-card:active {
                    transform: translateY(0px);
                    box-shadow: var(--hp-card-shadow);
                }

                .hp-iconTile {
                    width: 96px;
                    height: 96px;
                    border-radius: var(--radius);
                    display: grid;
                    place-items: center;
                    flex: 0 0 auto;
                }

                .hp-meta {
                    min-width: 0;
                    padding-top: 4px;
                }

                .hp-cardTitle {
                    font-size: 16px;
                    font-weight: 900;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    margin-bottom: 6px;
                }

                .hp-desc {
                    font-size: 14px;
                    line-height: 1.35;
                    color: var(--puzzle-ink-soft);
                    max-width: 52ch;
                }

                @media (max-width: 420px) {
                    .hp-iconTile { width: 84px; height: 84px; }
                }

                a.hp-card:focus-visible {
                    outline: 3px solid var(--hp-card-focus);
                    outline-offset: 3px;
                }

                .hp-tiles-section { margin-top: 22px; }
                .hp-section-label {
                    font-size: 0.72rem;
                    font-weight: 900;
                    letter-spacing: 0.12em;
                    color: var(--puzzle-ink-muted);
                    margin-bottom: 10px;
                }
                .hp-tile-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
                    gap: 10px;
                }
                a.hp-tile {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 10px 6px;
                    border-radius: var(--radius);
                    text-decoration: none;
                    color: inherit;
                    background: var(--tile);
                    box-shadow: var(--shadow);
                    min-height: 88px;
                    transition: background 140ms ease, transform 140ms ease;
                }
                a.hp-tile:hover {
                    background: var(--tileHover);
                    transform: translateY(-1px);
                }
                .hp-tile-title {
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 0.06em;
                    text-align: center;
                    line-height: 1.2;
                    color: var(--puzzle-ink-soft);
                }
            `}</style>

      <div className="hp-shell">
        <div style={{ flexShrink: 0, width: '100%' }}>
          <TopBar
            title="PUZZLES"
            showHome={false}
            showStats={false}
            titleOpensLinks
            hubBaLinksMenu
            onSettings={() => setShowSettings(true)}
            onCube={() => setShowLinks(true)}
          />
        </div>

        <main className="hp-page">
          <header className="hp-intro">
            <p className="hp-tagline">
              Daily puzzles for the breakfast table, the car ride, or the classroom warm-up.
            </p>
            <div className="hp-date">{today}</div>
          </header>

          <div className="hp-divider" />

          <div className="hp-section-label">MY PUZZLES</div>
          <section className="hp-list">
            {gamesOnDashboard.map(({ key, href, Icon, title, desc }) => {
              const tierSlots = getEnabledTierIndices(key, suitePrefs)
              const cardHref = hubHrefFirstUnfinishedThreeWithPrefs(
                href,
                completions[key],
                suitePrefs
              )
              return (
                <a key={key} className="hp-card" href={cardHref}>
                  <div className="hp-iconTile">
                    <Icon size={56} />
                  </div>
                  <div className="hp-meta">
                    <div className="hp-cardTitle">{title}</div>
                    <div className="hp-desc">{desc}</div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <PuzzleBoxes
                        gameKey={key}
                        completions={completions[key]}
                        perfects={perfects[key]}
                        moveCounts={moveCounts[key]}
                        tierSlots={tierSlots}
                      />
                      {streaks[key] > 0 && (
                        <span style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.35 }}>
                          Streak: {streaks[key]}
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              )
            })}
          </section>

          {gamesHidden.length > 0 ? (
            <section className="hp-tiles-section" aria-label="Other puzzles">
              <div className="hp-section-label">OTHER PUZZLES</div>
              <div className="hp-tile-grid">
                {gamesHidden.map(({ key, href, Icon, title }) => {
                  const tileHref = hubHrefFirstUnfinishedThreeWithPrefs(
                    href,
                    completions[key],
                    suitePrefs
                  )
                  return (
                    <a key={key} className="hp-tile" href={tileHref}>
                      <Icon size={40} />
                      <span className="hp-tile-title">{title.toUpperCase()}</span>
                    </a>
                  )
                })}
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <SuiteSettingsModal
        show={showSettings}
        onClose={() => setShowSettings(false)}
        games={settingsGamesList}
        onSaved={refreshSuitePrefs}
        onOpenAddToHomeGuide={() => {
          setShowSettings(false)
          setShowAddToHomeGuide(true)
        }}
      />
      <AddToHomeScreenModal
        show={showAddToHomeGuide}
        onClose={() => setShowAddToHomeGuide(false)}
      />
      <PlaygroundLinksModal show={showLinks} onClose={() => setShowLinks(false)} />
    </>
  )
}
