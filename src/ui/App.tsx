import { FarmScene } from '../scene/FarmScene'
import { StatusBars } from './StatusBars'
import { TimeControl } from './TimeControl'
import { ControlPanel } from './ControlPanel'
import { DebugOverlay } from './DebugOverlay'
import { ProfilerPanel } from './ProfilerPanel'
import { TaskPanel } from './TaskPanel'

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

export function App() {
  return (
    <div style={appStyle}>
      <FarmScene />
      <div style={overlayStyle}>
        <StatusBars />
        <TimeControl />
        <ControlPanel />
        <TaskPanel />
        <DebugOverlay />
        <ProfilerPanel />
      </div>
    </div>
  )
}
