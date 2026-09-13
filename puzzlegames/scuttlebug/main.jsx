import React from 'react'
import ReactDOM from 'react-dom/client'
import GameErrorBoundary from '../../src/shared/GameErrorBoundary.jsx'
import Scuttlebug from './scuttlebug.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <GameErrorBoundary>
    <Scuttlebug />
  </GameErrorBoundary>
)
