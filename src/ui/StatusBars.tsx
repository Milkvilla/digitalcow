import { useGameStore } from './hooks'
import type { RelationshipTier, CowCondition } from '../engine/types'

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 16,
  left: 16,
  background: 'linear-gradient(135deg, rgba(10, 12, 18, 0.82), rgba(18, 22, 32, 0.78))',
  backdropFilter: 'blur(16px)',
  borderRadius: 16,
  padding: '18px 20px',
  color: '#fff',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  minWidth: 220,
  pointerEvents: 'auto',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
}

const barContainerStyle: React.CSSProperties = {
  marginBottom: 12,
}

const barLabelRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 5,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.3,
}

const barTrackStyle: React.CSSProperties = {
  width: '100%',
  height: 8,
  background: 'rgba(255, 255, 255, 0.08)',
  borderRadius: 4,
  overflow: 'hidden',
  position: 'relative',
}

interface BarConfig {
  icon: string
  label: string
  gradient: [string, string]
  glowColor: string
}

const BAR_CONFIGS: Record<string, BarConfig> = {
  hunger:       { icon: '\uD83C\uDF3E', label: 'Hunger',       gradient: ['#4caf50', '#81c784'], glowColor: '#4caf50' },
  thirst:       { icon: '\uD83D\uDCA7', label: 'Thirst',       gradient: ['#42a5f5', '#90caf9'], glowColor: '#42a5f5' },
  energy:       { icon: '\u26A1',        label: 'Energy',       gradient: ['#ffa726', '#ffcc02'], glowColor: '#ffa726' },
  happiness:    { icon: '\u2764\uFE0F',  label: 'Happiness',    gradient: ['#ec407a', '#f48fb1'], glowColor: '#ec407a' },
  health:       { icon: '\u2795',        label: 'Health',       gradient: ['#66bb6a', '#a5d6a7'], glowColor: '#66bb6a' },
  milk:         { icon: '\uD83E\uDD5B',  label: 'Milk',         gradient: ['#f5f5f5', '#e0e0e0'], glowColor: '#ffffff' },
  relationship: { icon: '\uD83E\uDD1D',  label: 'Relationship', gradient: ['#ab47bc', '#ce93d8'], glowColor: '#ab47bc' },
}

function getBarGradient(value: number, inverted: boolean): [string, string] {
  const goodness = inverted ? 100 - value : value
  if (goodness >= 60) return ['#4caf50', '#81c784']
  if (goodness >= 30) return ['#ffc107', '#ffe082']
  return ['#f44336', '#ef9a9a']
}

function getHealthGradient(value: number): [string, string] {
  const red = Math.round(255 * (1 - value / 100))
  const green = Math.round(255 * (value / 100))
  const c1 = `rgb(${red}, ${green}, 60)`
  const c2 = `rgb(${Math.min(255, red + 40)}, ${Math.min(255, green + 40)}, 80)`
  return [c1, c2]
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

function getTierInfo(tier: RelationshipTier): { color: string; gradient: [string, string] } {
  switch (tier) {
    case 'wary': return { color: '#ef5350', gradient: ['#ef5350', '#ff8a80'] }
    case 'familiar': return { color: '#ffa726', gradient: ['#ffa726', '#ffcc80'] }
    case 'bonded': return { color: '#66bb6a', gradient: ['#66bb6a', '#a5d6a7'] }
  }
}

interface NeedBarProps {
  configKey: string
  value: number
  inverted?: boolean
  gradientOverride?: [string, string]
  labelOverride?: string
  critical?: boolean
}

function NeedBar({ configKey, value, inverted = false, gradientOverride, labelOverride, critical = false }: NeedBarProps) {
  const config = BAR_CONFIGS[configKey]
  const gradient = gradientOverride ?? getBarGradient(value, inverted)
  const isCritical = critical || (inverted ? value > 75 : value < 25)

  return (
    <div style={barContainerStyle}>
      <div style={barLabelRowStyle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13 }}>{config.icon}</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.85)' }}>{labelOverride ?? config.label}</span>
        </span>
        <span style={{
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.5)',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(value)}%
        </span>
      </div>
      <div style={barTrackStyle}>
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${gradient[0]}, ${gradient[1]})`,
            borderRadius: 4,
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s ease',
            boxShadow: isCritical
              ? `0 0 8px ${gradient[0]}80, 0 0 16px ${gradient[0]}40`
              : `0 0 4px ${gradient[0]}30`,
          }}
        />
      </div>
    </div>
  )
}

function ConditionDisplay({ conditions }: { conditions: CowCondition[] }) {
  if (conditions.length === 0) return null

  return (
    <div style={{ ...barContainerStyle, marginBottom: 0 }}>
      <div style={{ ...barLabelRowStyle, marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13 }}>{'\uD83C\uDFE5'}</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Condition</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {conditions.map((condition) => {
          const isHealthy = condition === 'healthy'
          return (
            <span
              key={condition}
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 10,
                background: isHealthy
                  ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.25), rgba(129, 199, 132, 0.15))'
                  : 'linear-gradient(135deg, rgba(244, 67, 54, 0.25), rgba(239, 154, 154, 0.15))',
                color: isHealthy ? '#a5d6a7' : '#ef9a9a',
                fontWeight: 600,
                border: `1px solid ${isHealthy ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}`,
                letterSpacing: 0.3,
              }}
            >
              {condition}
            </span>
          )
        })}
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
  const tierInfo = getTierInfo(tier)
  const showMilk = age > 0.5

  return (
    <div style={containerStyle}>
      <NeedBar configKey="hunger" value={hunger} inverted />
      <NeedBar configKey="thirst" value={thirst} inverted gradientOverride={['#42a5f5', '#90caf9']} />
      <NeedBar configKey="energy" value={energy} />
      <NeedBar configKey="happiness" value={happiness} gradientOverride={['#ec407a', '#f48fb1']} />
      <NeedBar configKey="health" value={health} gradientOverride={getHealthGradient(health)} />
      {showMilk && (
        <NeedBar configKey="milk" value={milkStorage} gradientOverride={['#e0e0e0', '#fafafa']} />
      )}

      {/* Relationship / Trust */}
      <div style={barContainerStyle}>
        <div style={barLabelRowStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13 }}>{'\uD83E\uDD1D'}</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Relationship</span>
          </span>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: tierInfo.color,
            padding: '1px 8px',
            borderRadius: 8,
            background: `${tierInfo.color}18`,
            border: `1px solid ${tierInfo.color}30`,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            {getTierDisplayName(tier)}
          </span>
        </div>
        <div style={barTrackStyle}>
          <div
            style={{
              width: `${trust}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${tierInfo.gradient[0]}, ${tierInfo.gradient[1]})`,
              borderRadius: 4,
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s ease',
              boxShadow: `0 0 6px ${tierInfo.color}40`,
            }}
          />
        </div>
      </div>

      <ConditionDisplay conditions={conditions} />
    </div>
  )
}
