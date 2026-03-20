import { useGameStore } from './hooks'

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  background: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(8px)',
  borderRadius: 12,
  padding: 16,
  color: '#fff',
  fontFamily: 'system-ui, sans-serif',
  minWidth: 200,
  pointerEvents: 'auto',
}

const barContainerStyle: React.CSSProperties = {
  marginBottom: 10,
}

const barLabelRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4,
  fontSize: 13,
  fontWeight: 600,
}

const barTrackStyle: React.CSSProperties = {
  width: '100%',
  height: 10,
  background: 'rgba(255,255,255,0.15)',
  borderRadius: 5,
  overflow: 'hidden',
}

/**
 * For hunger: high value = bad (starving), so color goes green->yellow->red as value rises.
 * For energy/happiness: high value = good, so color goes red->yellow->green as value rises.
 */
function getBarColor(value: number, inverted: boolean): string {
  // For inverted (hunger): low=good(green), high=bad(red)
  // For normal (energy, happiness): low=bad(red), high=good(green)
  const goodness = inverted ? 100 - value : value

  if (goodness >= 60) return '#4caf50' // green
  if (goodness >= 30) return '#ffc107' // yellow
  return '#f44336' // red
}

interface NeedBarProps {
  label: string
  value: number
  inverted?: boolean
}

function NeedBar({ label, value, inverted = false }: NeedBarProps) {
  const color = getBarColor(value, inverted)
  // For display width: hunger shows how "full" the bar is based on actual value
  // (high hunger = full red bar, which communicates urgency)
  const displayWidth = value

  return (
    <div style={barContainerStyle}>
      <div style={barLabelRowStyle}>
        <span>{label}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
          {Math.round(value)}
        </span>
      </div>
      <div style={barTrackStyle}>
        <div
          style={{
            width: `${displayWidth}%`,
            height: '100%',
            background: color,
            borderRadius: 5,
            transition: 'width 0.3s ease, background 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}

export function StatusBars() {
  const hunger = useGameStore((s) => s.cow.needs.hunger)
  const energy = useGameStore((s) => s.cow.needs.energy)
  const happiness = useGameStore((s) => s.cow.needs.happiness)

  return (
    <div style={containerStyle}>
      <NeedBar label="Hunger" value={hunger} inverted />
      <NeedBar label="Energy" value={energy} />
      <NeedBar label="Happiness" value={happiness} />
    </div>
  )
}
