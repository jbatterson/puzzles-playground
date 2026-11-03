import { migrateSwipeToRolyPoly } from '@shared-contracts/migrateSwipeToRolyPoly.js'
import { pruneStaleGameStateStorage } from '@shared-contracts/pruneGameStateStorage.js'
import React from 'react'
import ReactDOM from 'react-dom/client'
import GameErrorBoundary from '../../src/shared/GameErrorBoundary.jsx'
import RolyPoly from './rolypoly.jsx'

migrateSwipeToRolyPoly()
pruneStaleGameStateStorage()

ReactDOM.createRoot(document.getElementById('root')).render(
  <GameErrorBoundary>
    <RolyPoly />
  </GameErrorBoundary>
)
