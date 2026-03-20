import { useEffect, useState, useCallback } from 'react'
import { FarmScene } from '../scene/FarmScene'
import { StatusBars } from './StatusBars'
import { TimeControl } from './TimeControl'
import { ControlPanel } from './ControlPanel'
import { DebugOverlay } from './DebugOverlay'
import { ProfilerPanel } from './ProfilerPanel'
import { TaskPanel } from './TaskPanel'
import { useGameStore, gameStore } from './hooks'

const appStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  position: 'relative',
  overflow: 'hidden',
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
}

const hintStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 40,
  left: '50%',
  transform: 'translateX(-50%)',
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: 14,
  fontFamily: 'system-ui, sans-serif',
  fontWeight: 500,
  background: 'rgba(0, 0, 0, 0.4)',
  backdropFilter: 'blur(6px)',
  padding: '10px 24px',
  borderRadius: 10,
  pointerEvents: 'none',
  transition: 'opacity 1.5s ease',
  letterSpacing: 0.3,
}

function CinematicHint() {
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    // Fade out after 2 seconds
    const timer = setTimeout(() => setOpacity(0), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ ...hintStyle, opacity }}>
      Press C to exit cinematic view
    </div>
  )
}

export function App() {
  const cinematicView = useGameStore((s) => s.cinematicView)

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'c' || e.key === 'C') {
      // Don't trigger if user is typing in an input/select
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      gameStore.getState().toggleCinematicView()
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div style={appStyle}>
      <FarmScene />
      {cinematicView ? (
        <CinematicHint />
      ) : (
        <div style={overlayStyle}>
          <StatusBars />
          <TimeControl />
          <ControlPanel />
          <TaskPanel />
          <DebugOverlay />
          <ProfilerPanel />
        </div>
      )}
    </div>
  )
}
