import React from 'react'
import { SVG_UNROLLED } from './swipeBugUnrolledSvg.js'

const SIZED_UNROLLED = SVG_UNROLLED.replace(
  /<svg\b/,
  '<svg width="100%" height="100%" style="display:block"'
)

export default function SwipeIcon({ size = 28, className = '' }) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        lineHeight: 0,
        flexShrink: 0,
      }}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: SIZED_UNROLLED }}
    />
  )
}
