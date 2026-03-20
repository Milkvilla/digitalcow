import { useGameStore, gameStore } from './hooks'
import { getTimeLabel } from '../engine/time'
import { SUNRISE_HOUR, SUNSET_HOUR } from '../engine/constants'

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  background: 'linear-gradient(135deg, rgba(10, 12, 18, 0.82), rgba(18, 22, 32, 0.78))',
  backdropFilter: 'blur(16px)',
  borderRadius: 16,
  padding: '18px 20px',
  color: '#fff',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  width: 240,
  pointerEvents: 'auto',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
}

const sliderContainerStyle: React.CSSProperties = {
  marginBottom: 14,
}

const sliderStyle: React.CSSProperties = {
  width: '100%',
  cursor: 'pointer',
  accentColor: '#ffc107',
  height: 4,
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'rgba(255, 255, 255, 0.45)',
  marginBottom: 6,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: 1,
  fontWeight: 600,
}

const SPEEDS = [1, 10, 60, 300] as const

function getTimeIcon(hour: number): string {
  if (hour >= 6 && hour < 12) return '\u2600\uFE0F'   // sun
  if (hour >= 12 && hour < 17) return '\uD83C\uDF24\uFE0F' // sun behind cloud
  if (hour >= 17 && hour < 20) return '\uD83C\uDF05' // sunset
  return '\uD83C\uDF19'                              // moon
}

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
      {/* Time display */}
      <div style={{
        fontSize: 20,
        fontWeight: 700,
        marginBottom: 4,
        textAlign: 'center',
        letterSpacing: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 22 }}>{getTimeIcon(timeOfDay)}</span>
        <span>{formatTime(timeOfDay)}</span>
      </div>

      {/* Day progress indicator */}
      <div style={{
        width: '100%',
        height: 3,
        background: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 2,
        marginBottom: 14,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${(timeOfDay / 24) * 100}%`,
          height: '100%',
          background: timeOfDay >= SUNRISE_HOUR && timeOfDay < SUNSET_HOUR
            ? 'linear-gradient(90deg, #ffc107, #ff9800)'
            : 'linear-gradient(90deg, #5c6bc0, #3949ab)',
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>

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

      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Speed</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {SPEEDS.map((speed) => {
            const isActive = timeSpeed === speed
            return (
              <button
                key={speed}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  fontSize: 11,
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  transition: 'all 0.2s ease',
                  background: isActive
                    ? 'linear-gradient(135deg, #ffc107, #ff9800)'
                    : 'rgba(255, 255, 255, 0.06)',
                  color: isActive ? '#1a1a1a' : 'rgba(255, 255, 255, 0.5)',
                  boxShadow: isActive ? '0 2px 8px rgba(255, 193, 7, 0.3)' : 'none',
                  letterSpacing: 0.3,
                }}
                onClick={() => gameStore.getState().setTimeSpeed(speed)}
              >
                {speed}x
              </button>
            )
          })}
        </div>
      </div>

      <button
        style={{
          width: '100%',
          padding: '9px 0',
          fontSize: 13,
          fontWeight: 700,
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
          fontFamily: "'Inter', system-ui, sans-serif",
          transition: 'all 0.2s ease',
          background: isPaused
            ? 'linear-gradient(135deg, #66bb6a, #43a047)'
            : 'linear-gradient(135deg, #ef5350, #e53935)',
          color: '#fff',
          boxShadow: isPaused
            ? '0 2px 8px rgba(102, 187, 106, 0.3)'
            : '0 2px 8px rgba(239, 83, 80, 0.3)',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
        onClick={() => gameStore.getState().togglePause()}
      >
        {isPaused ? '\u25B6  Resume' : '\u23F8  Pause'}
      </button>
    </div>
  )
}
