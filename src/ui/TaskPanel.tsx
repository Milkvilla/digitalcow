import { useGameStore } from './hooks'

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 230,
  right: 16,
  background: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(8px)',
  borderRadius: 12,
  padding: 16,
  color: '#fff',
  fontFamily: 'system-ui, sans-serif',
  minWidth: 200,
  maxHeight: 360,
  overflowY: 'auto',
  pointerEvents: 'auto',
}

const headerStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 12,
  textAlign: 'center',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'rgba(255, 255, 255, 0.6)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 6,
}

const taskRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  marginBottom: 4,
}

const dividerStyle: React.CSSProperties = {
  borderTop: '1px solid rgba(255, 255, 255, 0.15)',
  margin: '10px 0',
}

const achievementRowStyle: React.CSSProperties = {
  marginBottom: 6,
}

const achievementLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#ffc107',
}

const achievementDescStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255, 255, 255, 0.6)',
  marginTop: 1,
}

const emptyTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(255, 255, 255, 0.45)',
  fontStyle: 'italic',
}

export function TaskPanel() {
  const dayCount = useGameStore((s) => s.world.dayCount)
  const dailyTasks = useGameStore((s) => s.tasks.dailyTasks)
  const achievements = useGameStore((s) => s.tasks.achievements)

  const unlockedAchievements = achievements.filter((a) => a.unlocked)

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Day {dayCount}</div>

      {/* Daily Tasks */}
      <div style={sectionTitleStyle}>Daily Tasks</div>
      {dailyTasks.length === 0 ? (
        <div style={emptyTextStyle}>No tasks today</div>
      ) : (
        dailyTasks.map((task) => (
          <div key={task.id} style={taskRowStyle}>
            <span
              style={{
                color: task.completed ? '#4caf50' : 'rgba(255, 255, 255, 0.35)',
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              {task.completed ? '\u2713' : '\u25CB'}
            </span>
            <span
              style={{
                textDecoration: task.completed ? 'line-through' : 'none',
                opacity: task.completed ? 0.6 : 1,
              }}
            >
              {task.label}
            </span>
          </div>
        ))
      )}

      <div style={dividerStyle} />

      {/* Achievements */}
      <div style={sectionTitleStyle}>Achievements</div>
      {unlockedAchievements.length === 0 ? (
        <div style={emptyTextStyle}>No achievements yet</div>
      ) : (
        unlockedAchievements.map((a) => (
          <div key={a.id} style={achievementRowStyle}>
            <div style={achievementLabelStyle}>{a.label}</div>
            <div style={achievementDescStyle}>{a.description}</div>
          </div>
        ))
      )}
    </div>
  )
}
