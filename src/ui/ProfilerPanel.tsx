import { useStore } from 'zustand'
import { profilerStore, type ProfilerState } from './profiler-store'

function useProfiler<T>(selector: (s: ProfilerState) => T): T {
  return useStore(profilerStore, selector)
}

const COMPONENTS: [string, string][] = [
  ['sky', 'Sky'],
  ['clouds', 'Clouds'],
  ['horizon', 'Horizon'],
  ['ground', 'Ground'],
  ['grass', 'Grass (field)'],
  ['grassPatch', 'Grass Patch'],
  ['decorations', 'Decorations'],
  ['trees', 'Trees'],
  ['cow', 'Cow'],
  ['barn', 'Barn'],
  ['pond', 'Pond'],
  ['fences', 'Fences'],
  ['food', 'Food Items'],
  ['creatures', 'Creatures'],
  ['rain', 'Rain'],
  ['particles', 'Particles'],
  ['postProcessing', 'Post Processing'],
  ['windmill', 'Windmill'],
  ['hayBales', 'Hay Bales'],
  ['waterWell', 'Water Well'],
  ['stonePath', 'Stone Path'],
  ['scarecrow', 'Scarecrow'],
  ['chickens', 'Chickens'],
  ['ducks', 'Ducks'],
  ['farmDog', 'Farm Dog'],
  ['flowerPatches', 'Flower Patches'],
  ['birdsOverhead', 'Birds Overhead'],
  ['fireflies', 'Fireflies'],
  ['cloudShadows', 'Cloud Shadows'],
  ['moodBubbles', 'Mood Bubbles'],
  ['milkSystem', 'Milk System'],
  ['vegetableGarden', 'Vegetable Garden'],
  ['seasonalEffects', 'Seasonal Effects'],
]

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  background: 'rgba(0,0,0,0.85)',
  color: '#eee',
  fontFamily: 'monospace',
  fontSize: 12,
  padding: 12,
  borderRadius: 8,
  pointerEvents: 'auto',
  maxHeight: '90vh',
  overflowY: 'auto',
  minWidth: 200,
  zIndex: 100,
}

const headerStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 8,
  borderBottom: '1px solid #555',
  paddingBottom: 4,
}

const statRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '2px 0',
}

const statValueStyle: React.CSSProperties = {
  color: '#6cf',
  fontWeight: 600,
}

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '2px 0',
  cursor: 'pointer',
}

const checkboxStyle = (on: boolean): React.CSSProperties => ({
  width: 14,
  height: 14,
  borderRadius: 3,
  border: '2px solid #888',
  background: on ? '#4caf50' : 'transparent',
  display: 'inline-block',
  flexShrink: 0,
})

const btnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 11,
  fontFamily: 'monospace',
  border: '1px solid #666',
  borderRadius: 4,
  cursor: 'pointer',
  background: '#333',
  color: '#eee',
  marginRight: 4,
}

export function ProfilerPanel() {
  const enabled = useProfiler((s) => s.enabled)
  const toggles = useProfiler((s) => s.toggles)
  const stats = useProfiler((s) => s.stats)

  if (!enabled) return null

  const allOn = Object.values(toggles).every(Boolean)

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>Scene Profiler</div>

      {/* Renderer stats */}
      <div style={{ marginBottom: 8 }}>
        <div style={statRowStyle}>
          <span>Draw calls</span>
          <span style={statValueStyle}>{stats.drawCalls}</span>
        </div>
        <div style={statRowStyle}>
          <span>Triangles</span>
          <span style={statValueStyle}>{stats.triangles.toLocaleString()}</span>
        </div>
        <div style={statRowStyle}>
          <span>Geometries</span>
          <span style={statValueStyle}>{stats.geometries}</span>
        </div>
        <div style={statRowStyle}>
          <span>Textures</span>
          <span style={statValueStyle}>{stats.textures}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #555', paddingTop: 6, marginBottom: 6 }}>
        <button
          style={btnStyle}
          onClick={() => {
            const target = !allOn
            const next: Record<string, boolean> = {}
            for (const [key] of COMPONENTS) next[key] = target
            profilerStore.setState({ toggles: next })
          }}
        >
          {allOn ? 'Disable All' : 'Enable All'}
        </button>
      </div>

      {/* Component toggles */}
      {COMPONENTS.map(([key, label]) => (
        <div
          key={key}
          style={toggleRowStyle}
          onClick={() => profilerStore.getState().toggle(key)}
        >
          <div style={checkboxStyle(toggles[key])} />
          <span style={{ opacity: toggles[key] ? 1 : 0.5 }}>{label}</span>
        </div>
      ))}

      <div style={{ marginTop: 8, fontSize: 10, color: '#888' }}>
        Toggle components to isolate bottlenecks.
        <br />
        Watch draw calls & FPS change.
      </div>
    </div>
  )
}
