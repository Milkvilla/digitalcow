import { useState } from 'react'
import { useStore } from 'zustand'
import { gameStore } from './hooks'
import type { FoodType, CameraMode } from '../engine/types'
import { useGameStore } from './hooks'
import { BREEDS, BREED_IDS } from '../engine/breeds'
import { profilerStore } from './profiler-store'

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  pointerEvents: 'auto',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
}

const buttonStyle: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'system-ui, sans-serif',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  color: '#fff',
  transition: 'transform 0.1s, box-shadow 0.1s',
  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
}

const smallBtnStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: '6px 10px',
  fontSize: 11,
  borderRadius: 6,
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'system-ui, sans-serif',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  color: '#fff',
  backgroundColor: '#444',
  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
}

const optionStyle: React.CSSProperties = {
  backgroundColor: '#333',
  color: '#fff',
}

const actionColors: Record<string, string[]> = {
  feed: ['#b8a030', '#8a7820'],
  play: ['#2196f3', '#1565c0'],
  pet: ['#ff9800', '#e65100'],
  call: ['#9c27b0', '#6a1b9a'],
  jump: ['#00bcd4', '#00838f'],
  drink: ['#1e88e5', '#0d47a1'],
  graze: ['#43a047', '#2e7d32'],
  milk: ['#f5f5f5', '#bdbdbd'],
}

const actionBtn = (key: string): React.CSSProperties => ({
  ...buttonStyle,
  background: `linear-gradient(135deg, ${actionColors[key][0]}, ${actionColors[key][1]})`,
})

const toggleStyle = (active: boolean): React.CSSProperties => ({
  ...smallBtnStyle,
  background: active
    ? 'linear-gradient(135deg, #66bb6a, #388e3c)'
    : 'linear-gradient(135deg, #777, #555)',
  opacity: active ? 1 : 0.7,
})

const sliderContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'system-ui, sans-serif',
  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
}

const sliderStyle: React.CSSProperties = {
  width: 100,
  accentColor: '#8d6e63',
  cursor: 'pointer',
}

function hover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = 'scale(1.05)'
}
function unhover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = 'scale(1)'
}

const FOOD_LABELS: Record<FoodType, string> = { hay: 'Hay', apple: 'Apple', carrot: 'Carrot' }
const CAMERA_LABELS: Record<CameraMode, string> = { manual: 'Manual', cinematic: 'Cinematic', firstPerson: '1st Person' }
const SEASON_LABELS = ['Spring', 'Summer', 'Autumn', 'Winter']

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
  const relationshipTier = trust <= 30 ? 'Wary' : trust <= 65 ? 'Familiar' : 'Bonded'

  return (
    <div style={containerStyle}>
      {/* Row 1: Feed dropdown + Feed button + action buttons */}
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
        <button
          style={actionBtn('feed')}
          onClick={() => gameStore.getState().playerAction({ type: 'place_food', foodType: feedType })}
          onMouseEnter={hover} onMouseLeave={unhover}
        >
          Feed
        </button>
        <button style={actionBtn('play')} onClick={() => gameStore.getState().playerAction({ type: 'play' })} onMouseEnter={hover} onMouseLeave={unhover}>Play</button>
        <button style={actionBtn('pet')} onClick={() => gameStore.getState().playerAction({ type: 'pet' })} onMouseEnter={hover} onMouseLeave={unhover}>Pet</button>
        <button style={actionBtn('call')} onClick={() => gameStore.getState().playerAction({ type: 'call' })} onMouseEnter={hover} onMouseLeave={unhover}>Call</button>
        <button style={actionBtn('jump')} onClick={() => gameStore.getState().playerAction({ type: 'jump' })} onMouseEnter={hover} onMouseLeave={unhover}>Jump</button>
        <button style={actionBtn('drink')} onClick={() => gameStore.getState().playerAction({ type: 'drink' })} onMouseEnter={hover} onMouseLeave={unhover}>Drink</button>
        <button style={actionBtn('graze')} onClick={() => gameStore.getState().playerAction({ type: 'graze_patch' })} onMouseEnter={hover} onMouseLeave={unhover}>Graze</button>
        <button style={{ ...actionBtn('milk'), color: '#333' }} onClick={() => gameStore.getState().playerAction({ type: 'milk' })} onMouseEnter={hover} onMouseLeave={unhover}>Milk</button>
      </div>

      {/* Row 2: Camera dropdown + toggles */}
      <div style={rowStyle}>
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
          {showButterflies ? 'Butterflies ON' : 'Butterflies OFF'}
        </button>
        <button style={toggleStyle(rain)} onClick={() => gameStore.getState().toggleRain()} onMouseEnter={hover} onMouseLeave={unhover}>
          {rain ? 'Rain ON' : 'Rain OFF'}
        </button>
        {rain && (
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={rainIntensity}
            style={{ ...sliderStyle, width: 60, accentColor: '#1e88e5' }}
            onChange={(e) => gameStore.getState().setRainIntensity(parseFloat(e.target.value))}
          />
        )}
        <button style={toggleStyle(profilerEnabled)} onClick={() => profilerStore.getState().toggleProfiler()} onMouseEnter={hover} onMouseLeave={unhover}>
          {profilerEnabled ? 'Profiler ON' : 'Profiler OFF'}
        </button>
        <button style={toggleStyle(gateOpen)} onClick={() => gameStore.getState().playerAction({ type: 'toggle_gate', gateId: 'gate_right' })} onMouseEnter={hover} onMouseLeave={unhover}>
          {gateOpen ? 'Gate OPEN' : 'Gate CLOSED'}
        </button>
      </div>

      {/* Row 3: Breed dropdown + age slider + season */}
      <div style={rowStyle}>
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
          <span>{currentAge < 0.3 ? 'Calf' : currentAge < 0.7 ? 'Young' : 'Adult'}</span>
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
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'system-ui, sans-serif',
          borderRadius: 6,
          color: '#fff',
          background: relationshipTier === 'Bonded'
            ? 'linear-gradient(135deg, #66bb6a, #388e3c)'
            : relationshipTier === 'Familiar'
              ? 'linear-gradient(135deg, #ffa726, #ef6c00)'
              : 'linear-gradient(135deg, #777, #555)',
          textShadow: '0 1px 3px rgba(0,0,0,0.4)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        }}>
          {relationshipTier} ({trust})
        </span>
      </div>
    </div>
  )
}
