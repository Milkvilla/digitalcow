import { useState } from 'react'
import { useStore } from 'zustand'
import { gameStore } from './hooks'
import type { FoodType, CameraMode } from '../engine/types'
import { useGameStore } from './hooks'
import { BREEDS, BREED_IDS } from '../engine/breeds'
import { profilerStore } from './profiler-store'

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 20,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  pointerEvents: 'auto',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 5,
  alignItems: 'center',
  background: 'linear-gradient(135deg, rgba(10, 12, 18, 0.78), rgba(18, 22, 32, 0.72))',
  backdropFilter: 'blur(16px)',
  borderRadius: 14,
  padding: '8px 10px',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
}

const buttonStyle: React.CSSProperties = {
  padding: '7px 13px',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  color: '#fff',
  transition: 'all 0.15s ease',
  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
  letterSpacing: 0.3,
  outline: 'none',
}

const smallBtnStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: '5px 10px',
  fontSize: 11,
  borderRadius: 8,
}

const selectStyle: React.CSSProperties = {
  padding: '7px 12px',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 10,
  cursor: 'pointer',
  color: '#fff',
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
  outline: 'none',
  letterSpacing: 0.2,
}

const optionStyle: React.CSSProperties = {
  backgroundColor: '#1a1a2e',
  color: '#fff',
}

const actionDefs: { key: string; label: string; icon: string; colors: [string, string]; action: () => void; darkText?: boolean }[] = [
  { key: 'feed', label: 'Feed', icon: '\uD83C\uDF3E', colors: ['#b8a030', '#8a7820'], action: () => {} },
  { key: 'play', label: 'Play', icon: '\uD83C\uDFBE', colors: ['#42a5f5', '#1e88e5'], action: () => gameStore.getState().playerAction({ type: 'play' }) },
  { key: 'pet', label: 'Pet', icon: '\uD83D\uDC4B', colors: ['#ff9800', '#ef6c00'], action: () => gameStore.getState().playerAction({ type: 'pet' }) },
  { key: 'call', label: 'Call', icon: '\uD83D\uDCE3', colors: ['#ab47bc', '#7b1fa2'], action: () => gameStore.getState().playerAction({ type: 'call' }) },
  { key: 'jump', label: 'Jump', icon: '\uD83E\uDE82', colors: ['#26c6da', '#00acc1'], action: () => gameStore.getState().playerAction({ type: 'jump' }) },
  { key: 'drink', label: 'Drink', icon: '\uD83D\uDCA7', colors: ['#42a5f5', '#1565c0'], action: () => gameStore.getState().playerAction({ type: 'drink' }) },
  { key: 'graze', label: 'Graze', icon: '\uD83C\uDF3F', colors: ['#66bb6a', '#388e3c'], action: () => gameStore.getState().playerAction({ type: 'graze_patch' }) },
  { key: 'milk', label: 'Milk', icon: '\uD83E\uDD5B', colors: ['#e0e0e0', '#bdbdbd'], action: () => gameStore.getState().playerAction({ type: 'milk' }), darkText: true },
]

const toggleStyle = (active: boolean): React.CSSProperties => ({
  ...smallBtnStyle,
  background: active
    ? 'linear-gradient(135deg, #66bb6a, #388e3c)'
    : 'rgba(255, 255, 255, 0.08)',
  color: active ? '#fff' : 'rgba(255, 255, 255, 0.5)',
  border: `1px solid ${active ? 'rgba(102, 187, 106, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
  boxShadow: active ? '0 2px 8px rgba(102, 187, 106, 0.25)' : 'none',
})

const sliderContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: '#fff',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: "'Inter', system-ui, sans-serif",
}

const sliderStyle: React.CSSProperties = {
  width: 90,
  accentColor: '#8d6e63',
  cursor: 'pointer',
  height: 4,
}

function hover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = 'translateY(-1px) scale(1.03)'
  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
}
function unhover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = 'translateY(0) scale(1)'
  e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)'
}

const FOOD_LABELS: Record<FoodType, string> = { hay: '\uD83C\uDF3E Hay', apple: '\uD83C\uDF4E Apple', carrot: '\uD83E\uDD55 Carrot' }
const CAMERA_LABELS: Record<CameraMode, string> = { manual: '\uD83C\uDFA5 Manual', cinematic: '\uD83C\uDFAC Cinematic', firstPerson: '\uD83D\uDC41 1st Person' }
const SEASON_LABELS = ['\uD83C\uDF38 Spring', '\u2600\uFE0F Summer', '\uD83C\uDF42 Autumn', '\u2744\uFE0F Winter']

export function ControlPanel() {
  const [feedType, setFeedType] = useState<FoodType>('hay')
  const showButterflies = useGameStore((s) => s.world.showButterflies)
  const cameraMode = useGameStore((s) => s.cameraMode)
  const rain = useGameStore((s) => s.rain)
  const rainIntensity = useGameStore((s) => s.rainIntensity)
  const currentBreed = useGameStore((s) => s.cow.breed)
  const currentAge = useGameStore((s) => s.cow.age)
  const currentSeason = useGameStore((s) => s.world.season)
  const profilerEnabled = useStore(profilerStore, (s) => s.enabled)
  const gates = useGameStore((s) => s.world.gates)
  const trust = useGameStore((s) => s.cow.personality.trust)

  const gateOpen = gates.length > 0 && gates[0].isOpen
  const tierLabel = trust <= 30 ? 'Wary' : trust <= 65 ? 'Familiar' : 'Bonded'
  const tierIcon = trust <= 30 ? '\uD83D\uDE10' : trust <= 65 ? '\uD83D\uDE0A' : '\uD83E\uDD70'
  const tierGradient = trust <= 30
    ? 'linear-gradient(135deg, rgba(239, 83, 80, 0.3), rgba(239, 83, 80, 0.15))'
    : trust <= 65
      ? 'linear-gradient(135deg, rgba(255, 167, 38, 0.3), rgba(255, 167, 38, 0.15))'
      : 'linear-gradient(135deg, rgba(102, 187, 106, 0.3), rgba(102, 187, 106, 0.15))'
  const tierColor = trust <= 30 ? '#ef5350' : trust <= 65 ? '#ffa726' : '#66bb6a'

  return (
    <div style={containerStyle}>
      {/* Row 1: Feed + action buttons */}
      <div style={rowStyle}>
        <select
          style={selectStyle}
          value={feedType}
          onChange={(e) => setFeedType(e.target.value as FoodType)}
        >
          {(['hay', 'apple', 'carrot'] as FoodType[]).map((ft) => (
            <option key={ft} value={ft} style={optionStyle}>{FOOD_LABELS[ft]}</option>
          ))}
        </select>
        {actionDefs.map((def) => (
          <button
            key={def.key}
            style={{
              ...buttonStyle,
              background: `linear-gradient(135deg, ${def.colors[0]}, ${def.colors[1]})`,
              color: def.darkText ? '#2a2a2a' : '#fff',
            }}
            onClick={def.key === 'feed'
              ? () => gameStore.getState().playerAction({ type: 'place_food', foodType: feedType })
              : def.action
            }
            onMouseEnter={hover}
            onMouseLeave={unhover}
          >
            {def.icon} {def.label}
          </button>
        ))}
      </div>

      {/* Row 2: Camera + toggles + breed + age + season + relationship */}
      <div style={{ ...rowStyle, gap: 8, padding: '8px 20px', width: '75vw', justifyContent: 'center' }}>
        <select
          style={selectStyle}
          value={cameraMode}
          onChange={(e) => gameStore.getState().setCameraMode(e.target.value as CameraMode)}
        >
          {(['manual', 'cinematic', 'firstPerson'] as CameraMode[]).map((m) => (
            <option key={m} value={m} style={optionStyle}>{CAMERA_LABELS[m]}</option>
          ))}
        </select>
        <button style={toggleStyle(showButterflies)} onClick={() => gameStore.getState().toggleButterflies()} onMouseEnter={hover} onMouseLeave={unhover}>
          {showButterflies ? '\uD83E\uDD8B On' : '\uD83E\uDD8B Off'}
        </button>
        <button style={toggleStyle(rain)} onClick={() => gameStore.getState().toggleRain()} onMouseEnter={hover} onMouseLeave={unhover}>
          {rain ? '\uD83C\uDF27 On' : '\uD83C\uDF27 Off'}
        </button>
        {rain && (
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={rainIntensity}
            style={{ ...sliderStyle, width: 55, accentColor: '#42a5f5' }}
            onChange={(e) => gameStore.getState().setRainIntensity(parseFloat(e.target.value))}
          />
        )}
        <button
          style={{ ...smallBtnStyle, background: 'linear-gradient(135deg, #7b1fa2, #4a148c)', border: '1px solid rgba(123, 31, 162, 0.3)' }}
          onClick={() => gameStore.getState().toggleCinematicView()}
          onMouseEnter={hover} onMouseLeave={unhover}
          title="Press C to toggle"
        >
          {'\uD83C\uDFAC'} Cinema
        </button>
        <button style={toggleStyle(profilerEnabled)} onClick={() => profilerStore.getState().toggleProfiler()} onMouseEnter={hover} onMouseLeave={unhover}>
          {profilerEnabled ? 'Profiler ON' : 'Profiler OFF'}
        </button>
        <button style={toggleStyle(gateOpen)} onClick={() => gameStore.getState().playerAction({ type: 'toggle_gate', gateId: 'gate_right' })} onMouseEnter={hover} onMouseLeave={unhover}>
          {gateOpen ? '\uD83D\uDEAA Open' : '\uD83D\uDEAA Closed'}
        </button>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
        <select
          style={selectStyle}
          value={currentBreed}
          onChange={(e) => gameStore.getState().setBreed(e.target.value as typeof currentBreed)}
        >
          {BREED_IDS.map((id) => (
            <option key={id} value={id} style={optionStyle}>{BREEDS[id].label}</option>
          ))}
        </select>
        <div style={sliderContainerStyle}>
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', minWidth: 32 }}>
            {currentAge < 0.3 ? '\uD83D\uDC2E' : currentAge < 0.7 ? '\uD83D\uDC04' : '\uD83D\uDC03'}
            {' '}{currentAge < 0.3 ? 'Calf' : currentAge < 0.7 ? 'Young' : 'Adult'}
          </span>
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={currentAge}
            style={sliderStyle}
            onChange={(e) => gameStore.getState().setAge(parseFloat(e.target.value))}
          />
        </div>
        <select
          style={selectStyle}
          value={currentSeason}
          onChange={(e) => gameStore.getState().setSeason(parseInt(e.target.value))}
        >
          {SEASON_LABELS.map((label, i) => (
            <option key={i} value={i} style={optionStyle}>{label}</option>
          ))}
        </select>
        <span style={{
          padding: '5px 10px',
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "'Inter', system-ui, sans-serif",
          borderRadius: 10,
          color: tierColor,
          background: tierGradient,
          border: `1px solid ${tierColor}30`,
          letterSpacing: 0.3,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {tierIcon} {tierLabel} ({Math.round(trust)})
        </span>
      </div>
    </div>
  )
}
