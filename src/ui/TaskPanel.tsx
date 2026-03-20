import { useGameStore } from './hooks'

const PANEL_CLASS = 'task-panel-scroll'

const scrollbarCSS = `
.${PANEL_CLASS}::-webkit-scrollbar { width: 4px; }
.${PANEL_CLASS}::-webkit-scrollbar-track { background: transparent; }
.${PANEL_CLASS}::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
.${PANEL_CLASS}::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
`

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 280,
  right: 16,
  background: 'linear-gradient(135deg, rgba(10, 12, 18, 0.82), rgba(18, 22, 32, 0.78))',
  backdropFilter: 'blur(16px)',
  borderRadius: 16,
  padding: '18px 20px',
  color: '#fff',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  minWidth: 210,
  maxHeight: 360,
  overflowY: 'auto',
  pointerEvents: 'auto',
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(255,255,255,0.15) transparent',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'rgba(255, 255, 255, 0.4)',
  textTransform: 'uppercase',
  letterSpacing: 1.2,
  marginBottom: 8,
}

export function TaskPanel() {
  const dayCount = useGameStore((s) => s.world.dayCount)
  const dailyTasks = useGameStore((s) => s.tasks.dailyTasks)
  const achievements = useGameStore((s) => s.tasks.achievements)

  const unlockedAchievements = achievements.filter((a) => a.unlocked)
  const completedCount = dailyTasks.filter(t => t.completed).length

  return (
    <div style={containerStyle} className={PANEL_CLASS}>
      <style>{scrollbarCSS}</style>

      {/* Day header */}
      <div style={{
        fontSize: 18,
        fontWeight: 800,
        marginBottom: 4,
        textAlign: 'center',
        letterSpacing: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 20 }}>{'\uD83D\uDCC5'}</span>
        <span>Day {dayCount}</span>
      </div>

      {/* Progress summary */}
      {dailyTasks.length > 0 && (
        <div style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.4)',
          marginBottom: 14,
          fontWeight: 500,
        }}>
          {completedCount}/{dailyTasks.length} tasks completed
        </div>
      )}

      {/* Daily Tasks */}
      <div style={sectionTitleStyle}>{'\uD83D\uDCCB'} Daily Tasks</div>
      {dailyTasks.length === 0 ? (
        <div style={{
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.3)',
          fontStyle: 'italic',
          padding: '4px 0',
        }}>
          No tasks today
        </div>
      ) : (
        dailyTasks.map((task) => (
          <div
            key={task.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              marginBottom: 6,
              padding: '6px 10px',
              borderRadius: 8,
              background: task.completed
                ? 'rgba(76, 175, 80, 0.08)'
                : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${task.completed ? 'rgba(76, 175, 80, 0.12)' : 'rgba(255, 255, 255, 0.04)'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                background: task.completed
                  ? 'linear-gradient(135deg, #66bb6a, #43a047)'
                  : 'rgba(255, 255, 255, 0.06)',
                color: task.completed ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                border: `1px solid ${task.completed ? 'rgba(102, 187, 106, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
              }}
            >
              {task.completed ? '\u2713' : ''}
            </span>
            <span
              style={{
                textDecoration: task.completed ? 'line-through' : 'none',
                opacity: task.completed ? 0.5 : 0.85,
                fontWeight: task.completed ? 400 : 500,
                letterSpacing: 0.2,
              }}
            >
              {task.label}
            </span>
          </div>
        ))
      )}

      {/* Divider */}
      <div style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        margin: '14px 0',
      }} />

      {/* Achievements */}
      <div style={sectionTitleStyle}>{'\uD83C\uDFC6'} Achievements</div>
      {unlockedAchievements.length === 0 ? (
        <div style={{
          fontSize: 12,
          color: 'rgba(255, 255, 255, 0.3)',
          fontStyle: 'italic',
          padding: '4px 0',
        }}>
          No achievements yet
        </div>
      ) : (
        unlockedAchievements.map((a) => (
          <div
            key={a.id}
            style={{
              marginBottom: 8,
              padding: '8px 10px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.08), rgba(255, 152, 0, 0.04))',
              border: '1px solid rgba(255, 193, 7, 0.12)',
            }}
          >
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#ffd54f',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              letterSpacing: 0.3,
            }}>
              <span>{'\uD83C\uDFC5'}</span>
              {a.label}
            </div>
            <div style={{
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.45)',
              marginTop: 3,
              lineHeight: 1.4,
              letterSpacing: 0.2,
            }}>
              {a.description}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
