import { useRef, useEffect, useCallback } from 'react'
import { HONEYCOMBS_BEE_ART_INNER_HTML } from '../../src/shared/icons/honeycombsBeeArtSvg.js'
import { HEX_R } from './honeycombsGeometry.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const BEE_FORWARD_OFFSET_DEG = 90
const BEE_TURN_MS = 90
const SEG_MS = 150
/** Keep in sync with `#hex-trace.trace-pulse-win` in honeycombs.css (0.6s × 3 iterations). */
export const WIN_TRACE_PULSE_TOTAL_MS = 0.6 * 3 * 1000

/**
 * Conservative upper bound from `runTrace(..., onDone)` start until `onDone` runs on a winning
 * trace (bee segments + win pulse). Used for suite-modal fallback if `onDone` never fires.
 * @param {number} cellCountOnGrid
 */
export function getMaxWinTraceCompleteMs(cellCountOnGrid) {
  const n = Math.max(1, Math.min(40, Math.floor(cellCountOnGrid)))
  const segments = Math.max(0, n - 1)
  // Per segment: bee + line use `SEG_MS`; allow slack for rAF + transitionend.
  const perSegmentMs = SEG_MS + 150
  return segments * perSegmentMs + WIN_TRACE_PULSE_TOTAL_MS + 400
}

function normalizeAngleDeg(deg) {
  return ((deg % 360) + 360) % 360
}

function shortestAngleDeltaDeg(fromDeg, toDeg) {
  let delta = normalizeAngleDeg(toDeg) - normalizeAngleDeg(fromDeg)
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return delta
}

/**
 * Hook that manages the imperative bee/trace path animation for the Honeycombs SVG.
 *
 * The `#hex-trace` group is created imperatively and appended to the SVG once on
 * mount, keeping it outside React's reconciliation so re-renders do not clear
 * in-flight animations.
 *
 * @param {React.RefObject<SVGSVGElement>} svgRef
 * @returns {{ runTrace, clearTrace, notifyUserInput }}
 */
export default function useHoneycombsTrace(svgRef) {
  const traceGroupRef = useRef(null)
  const sessionRef = useRef(0)
  const fadeTimerRef = useRef(null)
  /** Win callback must not share `fadeTimerRef` — `scheduleWinLineFade` clears that ref ~220ms after the pulse starts. */
  const winAfterPulseTimerRef = useRef(null)
  const beeRafRef = useRef(null)
  const beeTokenRef = useRef(0)

  // Create the #hex-trace group imperatively so React never reconciles its children.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const g = document.createElementNS(SVG_NS, 'g')
    g.id = 'hex-trace'
    svg.appendChild(g)
    traceGroupRef.current = g
    return () => {
      g.remove()
      traceGroupRef.current = null
    }
  }, [svgRef])

  // ─── helpers ────────────────────────────────────────────────────────────────

  const stopBeeBuzz = useCallback(() => {
    beeTokenRef.current++
    if (beeRafRef.current !== null) {
      cancelAnimationFrame(beeRafRef.current)
      beeRafRef.current = null
    }
  }, [])

  const clearFadeTimer = useCallback(() => {
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
  }, [])

  const clearWinAfterPulseTimer = useCallback(() => {
    if (winAfterPulseTimerRef.current) {
      clearTimeout(winAfterPulseTimerRef.current)
      winAfterPulseTimerRef.current = null
    }
  }, [])

  const clearTraceDom = useCallback(() => {
    stopBeeBuzz()
    clearWinAfterPulseTimer()
    const g = traceGroupRef.current
    if (!g) return
    g.innerHTML = ''
    g.classList.remove('trace-pulse-win')
    g.style.opacity = '1'
    g.style.transition = ''
  }, [stopBeeBuzz, clearWinAfterPulseTimer])

  // ─── public API ─────────────────────────────────────────────────────────────

  /** Clear any active trace/bee immediately (e.g. on puzzle change). */
  const clearTrace = useCallback(() => {
    clearFadeTimer()
    clearTraceDom()
  }, [clearFadeTimer, clearTraceDom])

  /** Call on any user input: clears the trace so the path reflects the new board state. */
  const notifyUserInput = useCallback(() => {
    const g = traceGroupRef.current
    if (!g || g.childNodes.length === 0) {
      clearFadeTimer()
      clearWinAfterPulseTimer()
      return
    }
    clearFadeTimer()
    clearTraceDom()
  }, [clearFadeTimer, clearTraceDom, clearWinAfterPulseTimer])

  /**
   * Run the path trace animation.
   *
   * @param {{ complete: boolean, cells: Array<{cx: number, cy: number}> }} trace
   *   Cell objects must have FINAL viewBox coordinates (cx + offX, cy + offY already applied).
   * @param {(() => void) | null} onWinAnimationComplete
   *   Called when the win path pulse animation finishes (third iteration), with a timeout fallback.
   */
  const runTrace = useCallback(
    (trace, onWinAnimationComplete) => {
      const traceG = traceGroupRef.current
      if (!traceG || !trace.cells.length) return

      sessionRef.current++
      const session = sessionRef.current

      clearFadeTimer()
      clearWinAfterPulseTimer()
      traceG.innerHTML = ''
      traceG.classList.remove('trace-pulse-win')
      traceG.style.opacity = '1'
      traceG.style.transition = ''

      const drawColor = 'rgba(107, 114, 128, 0.5)'
      const okColor = '#6b9b3b'
      const badColor = '#9d270c'

      const pts = trace.cells.map((c) => `${c.cx},${c.cy}`)

      // ── bee helpers ──────────────────────────────────────────────────────────

      function createBeeSprite(start, initialHeadingDeg) {
        const bee = document.createElementNS(SVG_NS, 'g')
        bee.setAttribute('class', 'trace-bee')
        bee.innerHTML = HONEYCOMBS_BEE_ART_INNER_HTML
        const beeSize = Math.max(18, HEX_R * 1.15)
        const scale = beeSize / 150
        let angle = initialHeadingDeg + BEE_FORWARD_OFFSET_DEG
        const setPose = (x, y, deg) => {
          bee.setAttribute(
            'transform',
            `translate(${x} ${y}) rotate(${deg}) scale(${scale}) translate(-75 -75)`
          )
        }
        traceG.appendChild(bee)
        setPose(start.x, start.y, angle)
        return {
          bee,
          setPose,
          getAngle: () => angle,
          setAngle: (deg) => {
            angle = deg
          },
        }
      }

      function startIdleBeeBuzz(beeCtl, anchor) {
        stopBeeBuzz()
        const myToken = ++beeTokenRef.current
        const radius = HEX_R * 0.7
        const speedPxPerSec = HEX_R * 0.32
        let x = anchor.x
        let y = anchor.y
        let angle = beeCtl.getAngle()
        let targetX = x
        let targetY = y
        let lastTs = performance.now()
        const pickTarget = () => {
          targetX = anchor.x + (Math.random() * 2 - 1) * radius
          targetY = anchor.y + (Math.random() * 2 - 1) * radius
        }
        pickTarget()
        const tick = (now) => {
          if (myToken !== beeTokenRef.current) return
          if (session !== sessionRef.current || !beeCtl.bee.isConnected) return
          const dt = Math.min(0.05, (now - lastTs) / 1000)
          lastTs = now
          const dx = targetX - x
          const dy = targetY - y
          const dist = Math.hypot(dx, dy)
          if (dist < 1.5) {
            pickTarget()
          } else {
            const move = Math.min(dist, speedPxPerSec * dt)
            x += (dx / dist) * move
            y += (dy / dist) * move
            const desired = (Math.atan2(dy, dx) * 180) / Math.PI + BEE_FORWARD_OFFSET_DEG
            const delta = shortestAngleDeltaDeg(angle, desired)
            angle = normalizeAngleDeg(angle + delta * Math.min(1, dt * 2.8))
            beeCtl.setPose(x, y, angle)
            beeCtl.setAngle(angle)
          }
          beeRafRef.current = requestAnimationFrame(tick)
        }
        beeRafRef.current = requestAnimationFrame(tick)
      }

      // ── win/loss fade helpers ────────────────────────────────────────────────

      function scheduleWinLineFade() {
        clearFadeTimer()
        fadeTimerRef.current = setTimeout(() => {
          fadeTimerRef.current = null
          if (!traceG || traceG.childNodes.length === 0) return
          const strokes = traceG.querySelectorAll('line, polyline, circle')
          if (!strokes.length) return
          for (const node of strokes) {
            node.style.transition = 'opacity 0.6s ease'
            node.style.opacity = '0'
          }
          setTimeout(() => {
            for (const node of strokes) node.remove()
          }, 620)
        }, 1200)
      }

      function scheduleLossFade() {
        clearFadeTimer()
        fadeTimerRef.current = setTimeout(() => {
          fadeTimerRef.current = null
          // fade out including bee
          const g = traceG
          if (!g || g.childNodes.length === 0) {
            clearTraceDom()
            return
          }
          sessionRef.current++
          stopBeeBuzz()
          g.style.transition = 'opacity 0.45s ease'
          g.style.opacity = '0'
          setTimeout(() => clearTraceDom(), 450)
        }, 2000)
      }

      // ── single-cell win ──────────────────────────────────────────────────────

      const scheduleWinModalAfterPulse = () => {
        let cleaned = false
        const fire = () => {
          if (cleaned) return
          cleaned = true
          clearWinAfterPulseTimer()
          traceG.removeEventListener('animationend', onAnimEnd)
          if (session !== sessionRef.current) return
          onWinAnimationComplete?.()
        }
        const onAnimEnd = (e) => {
          if (e.target !== traceG) return
          fire()
        }
        traceG.addEventListener('animationend', onAnimEnd)
        winAfterPulseTimerRef.current = setTimeout(() => {
          winAfterPulseTimerRef.current = null
          fire()
        }, WIN_TRACE_PULSE_TOTAL_MS + 80)
      }

      if (pts.length === 1) {
        const c0 = trace.cells[0]
        const dot = document.createElementNS(SVG_NS, 'circle')
        dot.setAttribute('cx', String(c0.cx))
        dot.setAttribute('cy', String(c0.cy))
        dot.setAttribute('r', '5')
        dot.setAttribute('fill', 'none')
        dot.setAttribute('stroke', drawColor)
        dot.setAttribute('stroke-width', '8')
        traceG.appendChild(dot)
        requestAnimationFrame(() => {
          if (session !== sessionRef.current) return
          dot.setAttribute('stroke', trace.complete ? okColor : badColor)
          if (trace.complete) {
            traceG.classList.add('trace-pulse-win')
            scheduleWinModalAfterPulse()
          }
          if (!trace.complete) scheduleLossFade()
        })
        return
      }

      // ── multi-cell path animation ────────────────────────────────────────────

      const lines = []
      let colorApplied = false
      let strokeDone = false

      const applyFinalColor = () => {
        if (session !== sessionRef.current || colorApplied) return
        colorApplied = true
        const end = trace.complete ? okColor : badColor
        for (const line of lines) {
          line.style.transition = 'stroke 0.22s ease'
          line.setAttribute('stroke', end)
        }
        if (trace.complete) {
          traceG.classList.add('trace-pulse-win')
          scheduleWinModalAfterPulse()
        }
        setTimeout(finishStroke, 220)
      }

      let lastBeePoint = null
      let beeCtl = null

      const finishStroke = () => {
        if (session !== sessionRef.current || strokeDone) return
        strokeDone = true
        if (trace.complete) {
          if (lastBeePoint) startIdleBeeBuzz(beeCtl, lastBeePoint)
          scheduleWinLineFade()
          return
        }
        scheduleLossFade()
      }

      const parsePt = (s) => {
        const [x, y] = s.split(',').map(Number)
        return { x, y }
      }
      const headingDeg = (a, b) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI

      const start = parsePt(pts[0])
      const firstTarget = parsePt(pts[1])
      beeCtl = createBeeSprite(start, headingDeg(start, firstTarget))
      lastBeePoint = { x: start.x, y: start.y }

      const animateBeeSegment = (a, b) => {
        const startedAt = performance.now()
        const startAngle = beeCtl.getAngle()
        const targetAngle = headingDeg(a, b) + BEE_FORWARD_OFFSET_DEG
        const delta = shortestAngleDeltaDeg(startAngle, targetAngle)
        const run = (now) => {
          if (session !== sessionRef.current || !beeCtl.bee.isConnected) return
          const t = Math.min(1, (now - startedAt) / SEG_MS)
          const turnT = Math.min(1, (now - startedAt) / BEE_TURN_MS)
          const easedTurn = 1 - Math.pow(1 - turnT, 3)
          const angle = normalizeAngleDeg(startAngle + delta * easedTurn)
          const x = a.x + (b.x - a.x) * t
          const y = a.y + (b.y - a.y) * t
          beeCtl.setPose(x, y, angle)
          beeCtl.setAngle(angle)
          if (t >= 1) lastBeePoint = { x: b.x, y: b.y }
          if (t < 1) requestAnimationFrame(run)
        }
        requestAnimationFrame(run)
      }

      const runSegment = (i) => {
        if (session !== sessionRef.current) return
        if (i >= pts.length - 1) {
          applyFinalColor()
          return
        }
        const a = parsePt(pts[i])
        const b = parsePt(pts[i + 1])
        const segLen = Math.hypot(b.x - a.x, b.y - a.y)

        if (segLen < 0.5) {
          beeCtl.setPose(b.x, b.y, beeCtl.getAngle())
          lastBeePoint = { x: b.x, y: b.y }
          runSegment(i + 1)
          return
        }

        animateBeeSegment(a, b)

        const line = document.createElementNS(SVG_NS, 'line')
        line.setAttribute('stroke', drawColor)
        line.setAttribute('stroke-width', '8')
        line.setAttribute('stroke-linecap', 'round')
        line.setAttribute('x1', String(a.x))
        line.setAttribute('y1', String(a.y))
        line.setAttribute('x2', String(b.x))
        line.setAttribute('y2', String(b.y))
        line.style.strokeDasharray = String(segLen)
        line.style.strokeDashoffset = String(segLen)
        line.style.transition = `stroke-dashoffset ${SEG_MS}ms ease-out`
        traceG.appendChild(line)
        traceG.appendChild(beeCtl.bee)
        lines.push(line)

        requestAnimationFrame(() => {
          if (session !== sessionRef.current) return
          line.getBoundingClientRect()
          requestAnimationFrame(() => {
            if (session !== sessionRef.current) return
            line.style.strokeDashoffset = '0'
          })
        })

        let advanced = false
        const next = () => {
          if (session !== sessionRef.current || advanced) return
          advanced = true
          runSegment(i + 1)
        }
        line.addEventListener(
          'transitionend',
          (e) => {
            if (e.propertyName === 'stroke-dashoffset') next()
          },
          { once: true }
        )
        setTimeout(() => {
          if (session !== sessionRef.current || advanced) return
          if (line.style.strokeDashoffset !== '0') return
          next()
        }, SEG_MS + 60)
      }

      runSegment(0)
    },
    [clearFadeTimer, clearWinAfterPulseTimer, clearTraceDom, stopBeeBuzz]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBeeBuzz()
      clearFadeTimer()
      clearWinAfterPulseTimer()
    }
  }, [stopBeeBuzz, clearFadeTimer, clearWinAfterPulseTimer])

  return { runTrace, clearTrace, notifyUserInput }
}
