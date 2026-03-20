import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from './hooks'
import { scoreActivities } from '../engine/behaviors'
import type { EngineEvent } from '../engine/types'

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  bottom: 0,
  width: 380,
  background: 'rgba(0, 0, 0, 0.85)',
  color: '#00ff88',
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: 12,
  padding: 16,
  overflowY: 'auto',
  pointerEvents: 'auto',
  zIndex: 100,
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 12,
}

const headingStyle: React.CSSProperties = {
  color: '#ffc107',
  fontWeight: 700,
  fontSize: 13,
  marginBottom: 4,
  borderBottom: '1px solid rgba(255,255,255,0.2)',
  paddingBottom: 2,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  lineHeight: 1.6,
}

const eventStyle: React.CSSProperties = {
  color: '#aaa',
  fontSize: 11,
  lineHeight: 1.5,
}

function formatVec3(v: [number, number, number]): string {
  return `[${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)}]`
}

function formatActivityType(activity: { type: string }): string {
  return JSON.stringify(activity)
}

function relationshipTierFromTrust(trust: number): string {
  if (trust <= 30) return 'Wary'
  if (trust <= 65) return 'Familiar'
  return 'Bonded'
}

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter']

function formatEvent(event: EngineEvent): string {
  switch (event.type) {
    case 'behavior_changed':
      return `behavior: ${event.from} -> ${event.to}`
    case 'activity_changed':
      return `activity: ${event.activity.type}`
    case 'food_placed':
      return `food placed (${event.food.id})`
    case 'food_consumed':
      return `food consumed (${event.foodId})`
    case 'pet_received':
      return 'pet received'
    case 'play_started':
      return 'play started'
    case 'arrived_at_target':
      return 'arrived at target'
    case 'need_critical':
      return `CRITICAL: ${event.need} = ${event.value.toFixed(1)}`
    case 'relationship_changed':
      return `relationship: ${event.tier}`
    case 'health_warning':
      return `health warning: ${event.condition}`
    case 'achievement_unlocked':
      return `ACHIEVEMENT: ${event.id}`
    case 'gate_toggled':
      return `gate ${event.gateId}: ${event.isOpen ? 'open' : 'closed'}`
    case 'day_passed':
      return `day ${event.dayCount}`
    case 'milk_produced':
      return `milk produced: ${event.amount}`
    default:
      return JSON.stringify(event)
  }
}

function useFPS(): number {
  const [fps, setFps] = useState(0)
  const framesRef = useRef(0)
  const lastTimeRef = useRef(performance.now())

  // Count frames using the existing rAF loop via a lightweight callback
  // instead of spinning up a second requestAnimationFrame loop.
  useEffect(() => {
    const onFrame = () => {
      framesRef.current++
      const now = performance.now()
      const elapsed = now - lastTimeRef.current
      if (elapsed >= 1000) {
        setFps(Math.round((framesRef.current * 1000) / elapsed))
        framesRef.current = 0
        lastTimeRef.current = now
      }
    }

    // Use a 100ms interval to sample — much cheaper than a full rAF loop,
    // and the scene's own rAF already drives rendering.
    const id = setInterval(onFrame, 100)
    return () => clearInterval(id)
  }, [])

  return fps
}

export function DebugOverlay() {
  const [visible, setVisible] = useState(false)
  const [eventLog, setEventLog] = useState<string[]>([])
  const fps = useFPS()

  const cow = useGameStore((s) => s.cow)
  const world = useGameStore((s) => s.world)
  const events = useGameStore((s) => s.events)

  // Track events
  useEffect(() => {
    if (events.length > 0) {
      setEventLog((prev) => {
        const newEntries = events.map(formatEvent)
        return [...newEntries, ...prev].slice(0, 10)
      })
    }
  }, [events])

  // Toggle on backtick/tilde key
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === '`' || e.key === '~') {
      setVisible((v) => !v)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  if (!visible) return null

  // Compute behavior scores
  let scores: Record<string, number> = {}
  try {
    scores = scoreActivities(cow, world, false, 0)
  } catch {
    // behaviors module may not be available yet
  }

  return (
    <div style={overlayStyle}>
      <div style={sectionStyle}>
        <div style={headingStyle}>DEBUG (press ~ to close)</div>
        <div style={rowStyle}>
          <span>FPS</span>
          <span>{fps}</span>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>COW STATE</div>
        <div style={rowStyle}>
          <span>Behavior</span>
          <span>{cow.behavior}</span>
        </div>
        <div style={rowStyle}>
          <span>Activity</span>
          <span style={{ maxWidth: 200, textAlign: 'right', wordBreak: 'break-all' }}>
            {formatActivityType(cow.activity)}
          </span>
        </div>
        <div style={rowStyle}>
          <span>Position</span>
          <span>{formatVec3(cow.position)}</span>
        </div>
        <div style={rowStyle}>
          <span>Facing</span>
          <span>{cow.facingAngle.toFixed(2)} rad</span>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>NEEDS</div>
        <div style={rowStyle}>
          <span>Hunger</span>
          <span>{cow.needs.hunger.toFixed(1)}</span>
        </div>
        <div style={rowStyle}>
          <span>Energy</span>
          <span>{cow.needs.energy.toFixed(1)}</span>
        </div>
        <div style={rowStyle}>
          <span>Happiness</span>
          <span>{cow.needs.happiness.toFixed(1)}</span>
        </div>
        <div style={rowStyle}>
          <span>Thirst</span>
          <span>{cow.needs.thirst.toFixed(1)}</span>
        </div>
        <div style={rowStyle}>
          <span>Health</span>
          <span>{cow.health.toFixed(1)}</span>
        </div>
        <div style={rowStyle}>
          <span>Milk Storage</span>
          <span>{cow.milkStorage.toFixed(1)}</span>
        </div>
        <div style={rowStyle}>
          <span>Trust</span>
          <span>{cow.personality.trust.toFixed(1)}</span>
        </div>
        <div style={rowStyle}>
          <span>Curiosity</span>
          <span>{cow.personality.curiosity.toFixed(1)}</span>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>CONDITION</div>
        <div style={rowStyle}>
          <span>Conditions</span>
          <span style={{ maxWidth: 200, textAlign: 'right', wordBreak: 'break-all' }}>
            {cow.conditions.join(', ') || 'none'}
          </span>
        </div>
        <div style={rowStyle}>
          <span>Relationship</span>
          <span>{relationshipTierFromTrust(cow.personality.trust)}</span>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>WORLD</div>
        <div style={rowStyle}>
          <span>Time of Day</span>
          <span>{world.timeOfDay.toFixed(2)}</span>
        </div>
        <div style={rowStyle}>
          <span>Sim Time</span>
          <span>{world.simulationTime.toFixed(1)}s</span>
        </div>
        <div style={rowStyle}>
          <span>Speed</span>
          <span>{world.timeSpeed}x</span>
        </div>
        <div style={rowStyle}>
          <span>Paused</span>
          <span>{world.isPaused ? 'YES' : 'NO'}</span>
        </div>
        <div style={rowStyle}>
          <span>Day</span>
          <span>{world.dayCount}</span>
        </div>
        <div style={rowStyle}>
          <span>Season</span>
          <span>{SEASON_NAMES[world.season] ?? world.season} ({world.season})</span>
        </div>
        <div style={rowStyle}>
          <span>Foods</span>
          <span>{world.foods.length}</span>
        </div>
        {world.gates.map((gate) => (
          <div key={gate.id} style={rowStyle}>
            <span>Gate {gate.id}</span>
            <span>{gate.isOpen ? 'OPEN' : 'CLOSED'}</span>
          </div>
        ))}
      </div>

      {Object.keys(scores).length > 0 && (
        <div style={sectionStyle}>
          <div style={headingStyle}>BEHAVIOR SCORES</div>
          {Object.entries(scores)
            .sort(([, a], [, b]) => b - a)
            .map(([key, value]) => (
              <div key={key} style={rowStyle}>
                <span>{key}</span>
                <span>{value.toFixed(1)}</span>
              </div>
            ))}
        </div>
      )}

      <div style={sectionStyle}>
        <div style={headingStyle}>EVENTS (last 10)</div>
        {eventLog.length === 0 && <div style={eventStyle}>No events yet</div>}
        {eventLog.map((entry, i) => (
          <div key={i} style={eventStyle}>
            {entry}
          </div>
        ))}
      </div>
    </div>
  )
}
