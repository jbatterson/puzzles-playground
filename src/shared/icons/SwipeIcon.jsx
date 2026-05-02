import React from 'react'

/** Hub icon — grid with swipe arrows (matches Swipe’s sliding-ball puzzle). */
export default function SwipeIcon({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 150 150"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="28"
        y="28"
        width="94"
        height="94"
        rx="8"
        fill="none"
        stroke="#1a3d5b"
        strokeWidth="6"
      />
      <circle cx="75" cy="75" r="14" fill="#ff3b30" />
      <path
        d="M75 18 L75 42 M63 30 L75 18 L87 30"
        fill="none"
        stroke="#1a3d5b"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M132 75 L108 75 M120 63 L132 75 L120 87"
        fill="none"
        stroke="#1a3d5b"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M75 132 L75 108 M87 120 L75 132 L63 120"
        fill="none"
        stroke="#1a3d5b"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 75 L42 75 M30 87 L18 75 L30 63"
        fill="none"
        stroke="#1a3d5b"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
