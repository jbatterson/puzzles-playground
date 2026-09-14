import React from 'react'
import { SVG_DUNG_BEETLE } from './dungBeetleSvg.js'

const SIZED_BEETLE = SVG_DUNG_BEETLE.replace(
  /<svg\b/,
  '<svg width="100%" height="100%" style="display:block"'
)

export default function DungBeetleIcon({ size = 28, className = '' }) {
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
      dangerouslySetInnerHTML={{ __html: SIZED_BEETLE }}
    />
  )
}
