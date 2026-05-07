import './DemandBar.css'

const LEVEL = {
  high: { label: 'Alta',  icon: '🔥', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  mid:  { label: 'Media', icon: '📈', color: '#d97706', bg: '#fef9c3', border: '#fde047' },
  low:  { label: 'Baja',  icon: '📉', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
}

export default function DemandBar({ estado, score, level, rank, total }) {
  const cfg = LEVEL[level] || LEVEL.low

  return (
    <div className="dbar">
      {/* Nombre del estado */}
      <div className="dbar__estado">
        <span className="dbar__pin">📍</span>
        <span className="dbar__name">{estado}</span>
      </div>

      <div className="dbar__divider" />

      {/* Score de demanda */}
      <div className="dbar__kpi" style={{ background: cfg.bg, borderColor: cfg.border }}>
        <span className="dbar__kpi-icon">{cfg.icon}</span>
        <div className="dbar__kpi-body">
          <span className="dbar__kpi-label" style={{ color: cfg.color }}>
            Demanda {cfg.label}
          </span>
          <div className="dbar__kpi-track">
            <div
              className="dbar__kpi-fill"
              style={{ width: `${score}%`, background: cfg.color }}
            />
          </div>
        </div>
        <span className="dbar__kpi-score" style={{ color: cfg.color }}>
          {score}<span className="dbar__kpi-max">/100</span>
        </span>
      </div>

      {/* Ranking */}
      {rank != null && (
        <>
          <div className="dbar__divider" />
          <div className="dbar__rank">
            <span className="dbar__rank-num">#{rank}</span>
            <span className="dbar__rank-of">de {total}</span>
          </div>
        </>
      )}
    </div>
  )
}
