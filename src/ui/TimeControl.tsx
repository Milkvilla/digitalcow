import { useGameStore, gameStore } from './hooks'
import { getTimeLabel } from '../engine/time'

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  background: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(8px)',
  borderRadius: 12,
  padding: 16,
  color: '#fff',
  fontFamily: 'system-ui, sans-serif',
  minWidth: 220,
  pointerEvents: 'auto',
}

const timeDisplayStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 12,
  textAlign: 'center',
}

const sliderContainerStyle: React.CSSProperties = {
  marginBottom: 12,
}

const sliderStyle: React.CSSProperties = {
  width: '100%',
  cursor: 'pointer',
  accentColor: '#ffc107',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.6)',
  marginBottom: 4,
  display: 'block',
}

const speedRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  marginBottom: 10,
}

const speedButtonBase: React.CSSProperties = {
  flex: 1,
  padding: '6px 0',
  fontSize: 12,
  fontWeight: 600,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
  transition: 'background 0.15s',
}

const pauseButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 0',
  fontSize: 14,
  fontWeight: 600,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
  transition: 'background 0.15s',
}

const SPEEDS = [1, 10, 60, 300] as const

function formatTime(hour: number): string {
  const label = getTimeLabel(hour)
  const capitalLabel = label.charAt(0).toUpperCase() + label.slice(1)

  const h24 = Math.floor(hour)
  const minutes = Math.floor((hour - h24) * 60)
  const h12 = h24 % 12 || 12
  const ampm = h24 < 12 ? 'AM' : 'PM'
  const minuteStr = minutes.toString().padStart(2, '0')

  return `${capitalLabel} ${h12}:${minuteStr} ${ampm}`
}

export function TimeControl() {
  const timeOfDay = useGameStore((s) => s.world.timeOfDay)
  const timeSpeed = useGameStore((s) => s.world.timeSpeed)
  const isPaused = useGameStore((s) => s.world.isPaused)

  return (
    <div style={containerStyle}>
      <div style={timeDisplayStyle}>{formatTime(timeOfDay)}</div>

      <div style={sliderContainerStyle}>
        <span style={labelStyle}>Time of Day</span>
        <input
          type="range"
          min={0}
          max={24}
          step={0.1}
          value={timeOfDay}
          onChange={(e) => gameStore.getState().setTimeOfDay(parseFloat(e.target.value))}
          style={sliderStyle}
        />
      </div>

      <div>
        <span style={labelStyle}>Speed</span>
        <div style={speedRowStyle}>
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              style={{
                ...speedButtonBase,
                background: timeSpeed === speed ? '#ffc107' : 'rgba(255,255,255,0.15)',
                color: timeSpeed === speed ? '#000' : '#fff',
              }}
              onClick={() => gameStore.getState().setTimeSpeed(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      <button
        style={{
          ...pauseButtonStyle,
          background: isPaused ? '#4caf50' : '#f44336',
          color: '#fff',
        }}
        onClick={() => gameStore.getState().togglePause()}
      >
        {isPaused ? 'Play' : 'Pause'}
      </button>
    </div>
  )
}
