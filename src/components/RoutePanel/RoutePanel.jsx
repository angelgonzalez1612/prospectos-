import { useState } from 'react'
import './RoutePanel.css'

const MODES = [
  { key: 'DRIVING',   icon: '🚗', label: 'Auto'       },
  { key: 'WALKING',   icon: '🚶', label: 'A pie'      },
  { key: 'TRANSIT',   icon: '🚌', label: 'Transporte' },
  { key: 'BICYCLING', icon: '🚲', label: 'Bici'       },
]

const GM_MODE = { DRIVING: 'driving', WALKING: 'walking', TRANSIT: 'transit', BICYCLING: 'bicycling' }

export default function RoutePanel({ origin, destination, durations, distances, activeMode, onModeChange, onClose }) {
  const [copied, setCopied] = useState(false)

  function handleShare() {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=${GM_MODE[activeMode]}`
    navigator.clipboard?.writeText(url).catch(() => {})
    window.open(url, '_blank')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="route-panel">
      <div className="route-panel__header">
        <div className="route-panel__dest-block">
          <span className="route-panel__dest" title={destination?.nombre}>
            📍 {destination?.nombre || 'Destino'}
          </span>
          {destination?.direccion && (
            <span className="route-panel__addr" title={destination.direccion}>
              {destination.direccion}
            </span>
          )}
        </div>
        <div className="route-panel__actions">
          <button className="route-panel__share-btn" onClick={handleShare}>
            {copied ? '✓ Copiado' : '🔗 Compartir ruta'}
          </button>
          <button className="route-panel__close-btn" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="route-panel__tabs">
        {MODES.map(({ key, icon, label }) => (
          <button
            key={key}
            className={`route-tab ${activeMode === key ? 'route-tab--active' : ''}`}
            onClick={() => onModeChange(key)}
          >
            <span className="route-tab__icon">{icon}</span>
            <span className="route-tab__label">{label}</span>
            <span className="route-tab__time">{durations[key] ?? '…'}</span>
            {distances[key] && <span className="route-tab__dist">{distances[key]}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
