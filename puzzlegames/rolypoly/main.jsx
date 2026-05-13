import { migrateSwipeToRolyPoly } from '@shared-contracts/migrateSwipeToRolyPoly.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import GameErrorBoundary from '../../src/shared/GameErrorBoundary.jsx'
import RolyPoly from './rolypoly.jsx'

migrateSwipeToRolyPoly()

ReactDOM.createRoot(document.getElementById('root')).render(
  <GameErrorBoundary>
    <RolyPoly />
  </GameErrorBoundary>
)
