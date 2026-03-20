import { useGameStore } from './hooks'
import type { RelationshipTier, CowCondition } from '../engine/types'

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
 * For hunger/thirst: high value = bad (starving/dehydrated), so color goes green->yellow->red as value rises.
 * For energy/happiness/health: high value = good, so color goes red->yellow->green as value rises.
 */
function getBarColor(value: number, inverted: boolean): string {
  // For inverted (hunger, thirst): low=good(green), high=bad(red)
  // For normal (energy, happiness, health): low=bad(red), high=good(green)
  const goodness = inverted ? 100 - value : value

  if (goodness >= 60) return '#4caf50' // green
  if (goodness >= 30) return '#ffc107' // yellow
  return '#f44336' // red
}

function getHealthBarColor(value: number): string {
  // Red-green gradient: low health = red, high health = green
  const red = Math.round(255 * (1 - value / 100))
  const green = Math.round(255 * (value / 100))
  return `rgb(${red}, ${green}, 60)`
}

function getRelationshipTierFromTrust(trust: number): RelationshipTier {
  if (trust >= 66) return 'bonded'
  if (trust >= 31) return 'familiar'
  return 'wary'
}

function getTierDisplayName(tier: RelationshipTier): string {
  switch (tier) {
    case 'wary': return 'Wary'
    case 'familiar': return 'Familiar'
    case 'bonded': return 'Bonded'
  }
}

function getTierColor(tier: RelationshipTier): string {
  switch (tier) {
    case 'wary': return '#f44336'
    case 'familiar': return '#ffc107'
    case 'bonded': return '#4caf50'
  }
}

interface NeedBarProps {
  label: string
  value: number
  inverted?: boolean
  colorOverride?: string
}

function NeedBar({ label, value, inverted = false, colorOverride }: NeedBarProps) {
  const color = colorOverride ?? getBarColor(value, inverted)
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

function ConditionDisplay({ conditions }: { conditions: CowCondition[] }) {
  if (conditions.length === 0) return null

  return (
    <div style={barContainerStyle}>
      <div style={barLabelRowStyle}>
        <span>Condition</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {conditions.map((condition) => (
          <span
            key={condition}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 8,
              background:
                condition === 'healthy'
                  ? 'rgba(76, 175, 80, 0.3)'
                  : 'rgba(244, 67, 54, 0.3)',
              color:
                condition === 'healthy'
                  ? '#81c784'
                  : '#ef9a9a',
              fontWeight: 500,
            }}
          >
            {condition}
          </span>
        ))}
      </div>
    </div>
  )
}

export function StatusBars() {
  const hunger = useGameStore((s) => s.cow.needs.hunger)
  const energy = useGameStore((s) => s.cow.needs.energy)
  const happiness = useGameStore((s) => s.cow.needs.happiness)
  const thirst = useGameStore((s) => s.cow.needs.thirst)
  const health = useGameStore((s) => s.cow.health)
  const milkStorage = useGameStore((s) => s.cow.milkStorage)
  const age = useGameStore((s) => s.cow.age)
  const trust = useGameStore((s) => s.cow.personality.trust)
  const conditions = useGameStore((s) => s.cow.conditions)

  const tier = getRelationshipTierFromTrust(trust)
  const showMilk = age > 0.5

  return (
    <div style={containerStyle}>
      <NeedBar label="Hunger" value={hunger} inverted />
      <NeedBar label="Thirst" value={thirst} inverted colorOverride="#42a5f5" />
      <NeedBar label="Energy" value={energy} />
      <NeedBar label="Happiness" value={happiness} />
      <NeedBar label="Health" value={health} colorOverride={getHealthBarColor(health)} />
      {showMilk && (
        <NeedBar label="Milk" value={milkStorage} colorOverride="#fff8e1" />
      )}

      {/* Relationship / Trust */}
      <div style={barContainerStyle}>
        <div style={barLabelRowStyle}>
          <span>Relationship</span>
          <span style={{ fontSize: 12, color: getTierColor(tier), fontWeight: 700 }}>
            {getTierDisplayName(tier)}
          </span>
        </div>
        <div style={barTrackStyle}>
          <div
            style={{
              width: `${trust}%`,
              height: '100%',
              background: getTierColor(tier),
              borderRadius: 5,
              transition: 'width 0.3s ease, background 0.3s ease',
            }}
          />
        </div>
      </div>

      <ConditionDisplay conditions={conditions} />
    </div>
  )
}
