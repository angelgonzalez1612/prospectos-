import { GIROS }       from '../../constants/giros'
import { ESTADOS }     from '../../constants/estados'
import { PROFILES }    from '../../constants/profiles'
import AddressSearch   from '../AddressSearch/AddressSearch'
import './FilterPanel.css'

const MODES = [
  { key: 'estado',    icon: '🗺️',  label: 'Estado',     desc: 'Todo un estado'      },
  { key: 'municipio', icon: '🏙️',  label: 'Municipio',  desc: 'Click en el mapa'    },
  { key: 'radio',     icon: '🎯',  label: 'Radio',      desc: 'Centro + distancia'  },
  { key: 'direccion', icon: '📍',  label: 'Dirección',  desc: 'Desde una dirección' },
]

export default function FilterPanel({
  selectedProfile, onProfileChange,
  giro, onGiroChange,
  mode, onModeChange,
  estado, onEstadoChange, estadoZone,
  municipioZone, onClearMunicipio,
  radioCenter, onClearRadioCenter, radioKm, onRadioChange,
  direccionCenter, onDireccionSelect, onClearDireccion,
  onSearch, isLoading, isLoadingZone,
}) {
  const giroFinal = selectedProfile
    ? selectedProfile.giros[0]
    : giro.trim()

  const hasZone = (() => {
    if (mode === 'estado')    return !!estado
    if (mode === 'municipio') return !!municipioZone
    if (mode === 'radio')     return !!radioCenter
    if (mode === 'direccion') return !!direccionCenter
    return false
  })()

  const canSearch = !!giroFinal && hasZone

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSearch) return
    onSearch(giroFinal)
  }

  function handleProfileClick(profile) {
    if (selectedProfile?.key === profile.key) {
      onProfileChange(null)
    } else {
      onProfileChange(profile)
      onGiroChange(profile.giros[0])
    }
  }

  function handleGiroChange(val) {
    onGiroChange(val)
    if (selectedProfile) onProfileChange(null)
  }

  // Texto de ayuda cuando el botón está deshabilitado
  const searchHint = (() => {
    if (!giroFinal && !hasZone) return 'Selecciona un giro/perfil y configura la zona'
    if (!giroFinal)             return 'Selecciona un giro o perfil de cliente'
    if (!hasZone) {
      if (mode === 'estado')    return 'Elige un estado del selector'
      if (mode === 'municipio') return 'Haz click en el mapa para elegir municipio'
      if (mode === 'radio')     return 'Haz click en el mapa para fijar el centro'
      if (mode === 'direccion') return 'Escribe una dirección de partida'
    }
    return null
  })()

  return (
    <div className="fp">
      <h2 className="fp__title">Buscador de Prospectos</h2>

      {/* ── Perfiles ──────────────────────────────────────────────── */}
      <div className="fp__section">
        <span className="fp__label">Perfil de cliente</span>
        <div className="fp__profiles">
          {PROFILES.map(p => (
            <button
              key={p.key}
              type="button"
              className={`fp__profile-card ${selectedProfile?.key === p.key ? 'fp__profile-card--active' : ''}`}
              style={selectedProfile?.key === p.key ? { borderColor: p.color, background: p.bg } : {}}
              onClick={() => handleProfileClick(p)}
              data-tooltip={p.giros.join(' · ')}
            >
              <span className="fp__profile-icon">{p.icon}</span>
              <span className="fp__profile-label">{p.label}</span>
              <span className="fp__profile-count"
                style={selectedProfile?.key === p.key ? { background: p.color } : {}}>
                {p.giros.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Giro libre — siempre visible ─────────────────────────── */}
      <div className="fp__field">
        <label className="fp__label">Giro</label>
        <input
          className="fp__input"
          type="text"
          list="fp-giros-list"
          placeholder="Ej: restaurantes, talleres…"
          value={giro}
          onChange={e => handleGiroChange(e.target.value)}
          autoComplete="off"
        />
        <datalist id="fp-giros-list">
          {GIROS.map(g => <option key={g.value} value={g.label} />)}
        </datalist>
      </div>

      {/* ── Tipo de búsqueda ─────────────────────────────────────── */}
      <div className="fp__mode-strip">
        {MODES.map(m => (
          <button
            key={m.key}
            type="button"
            className={`fp__mode-btn ${mode === m.key ? 'fp__mode-btn--active' : ''}`}
            onClick={() => { if (m.key !== mode) onModeChange(m.key) }}
            title={m.desc}
          >
            <span className="fp__mode-btn__icon">{m.icon}</span>
            <span className="fp__mode-btn__label">{m.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="fp__form">

        {/* ── ESTADO ───────────────────────────────────────────── */}
        {mode === 'estado' && (
          <>
            <div className="fp__field">
              <label className="fp__label">Selecciona un estado</label>
              <select className="fp__select" value={estado} onChange={e => onEstadoChange(e.target.value)}>
                <option value="">-- Estado --</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            {isLoadingZone && <p className="fp__hint fp__hint--loading">Cargando límite del estado…</p>}
            {estadoZone && !isLoadingZone && (
              <div className="fp__badge fp__badge--estado">
                🗺️ <strong>{estadoZone.nombre}</strong> listo
              </div>
            )}
          </>
        )}

        {/* ── MUNICIPIO ────────────────────────────────────────── */}
        {mode === 'municipio' && (
          <>
            {!municipioZone ? (
              <div className="fp__hint-box">
                <span className="fp__hint-icon">👆</span>
                <p>Haz click en el mapa para seleccionar un municipio o alcaldía</p>
              </div>
            ) : (
              <div className="fp__badge fp__badge--zona">
                <div className="fp__badge-info">
                  <strong>{municipioZone.nombre}</strong>
                  {municipioZone.estado && <span>{municipioZone.estado}</span>}
                </div>
                <button type="button" className="fp__badge-clear" onClick={onClearMunicipio}>×</button>
              </div>
            )}
            {isLoadingZone && <p className="fp__hint fp__hint--loading">Detectando municipio…</p>}
          </>
        )}

        {/* ── RADIO ────────────────────────────────────────────── */}
        {mode === 'radio' && (
          <>
            {!radioCenter ? (
              <div className="fp__hint-box">
                <span className="fp__hint-icon">📍</span>
                <p>Haz click en el mapa para fijar el centro de búsqueda</p>
              </div>
            ) : (
              <div className="fp__badge fp__badge--radio">
                <div className="fp__badge-info">
                  <strong>Centro fijado</strong>
                  <span>{radioCenter.lat.toFixed(4)}, {radioCenter.lng.toFixed(4)}</span>
                </div>
                <button type="button" className="fp__badge-clear" onClick={onClearRadioCenter}>×</button>
              </div>
            )}
            <div className="fp__field">
              <label className="fp__label">
                Radio de búsqueda
                <span className="fp__radio-val">{radioKm} km</span>
              </label>
              <input type="range" min="1" max="50" step="1" value={radioKm}
                onChange={e => onRadioChange(Number(e.target.value))} className="fp__slider" />
              <div className="fp__slider-labels"><span>1 km</span><span>25 km</span><span>50 km</span></div>
            </div>
          </>
        )}

        {/* ── DIRECCIÓN ────────────────────────────────────────── */}
        {mode === 'direccion' && (
          <>
            {!direccionCenter ? (
              <div className="fp__field">
                <label className="fp__label">Dirección de partida</label>
                <AddressSearch onSelect={onDireccionSelect} />
                <p className="fp__hint">Busca una dirección, colonia o lugar de referencia</p>
              </div>
            ) : (
              <div className="fp__badge fp__badge--radio">
                <div className="fp__badge-info">
                  <strong>Dirección fijada</strong>
                  <span className="fp__badge-addr">{direccionCenter.address}</span>
                </div>
                <button type="button" className="fp__badge-clear" onClick={onClearDireccion}>×</button>
              </div>
            )}
            <div className="fp__field">
              <label className="fp__label">
                Radio de búsqueda
                <span className="fp__radio-val">{radioKm} km</span>
              </label>
              <input type="range" min="1" max="50" step="1" value={radioKm}
                onChange={e => onRadioChange(Number(e.target.value))} className="fp__slider" />
              <div className="fp__slider-labels"><span>1 km</span><span>25 km</span><span>50 km</span></div>
            </div>
          </>
        )}

        <button type="submit" className="fp__btn" disabled={isLoading || isLoadingZone || !canSearch}>
          {isLoading || isLoadingZone
            ? <span className="fp__spinner" />
            : selectedProfile?.giros.length > 1
              ? `Buscar ${selectedProfile.giros.length} giros`
              : 'Buscar'}
        </button>

        {/* Hint cuando el botón está deshabilitado */}
        {!isLoading && !isLoadingZone && searchHint && (
          <p className="fp__search-hint">{searchHint}</p>
        )}
      </form>
    </div>
  )
}
