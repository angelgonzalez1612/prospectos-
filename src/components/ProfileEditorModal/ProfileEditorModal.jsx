import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { GIROS } from '../../constants/giros'
import './ProfileEditorModal.css'

const PREDEFINED = new Set(GIROS.map(g => g.value))

export default function ProfileEditorModal({ profiles, onUpdateGiros, onResetProfile, onClose }) {
  const [editing, setEditing]   = useState(null)
  const [selected, setSelected] = useState([])
  const [newGiro, setNewGiro]   = useState('')
  const inputRef                = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') editing ? setEditing(null) : onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editing, onClose])

  function openEdit(p) {
    setSelected([...p.giros])
    setNewGiro('')
    setEditing(p)
  }

  function toggleGiro(val) {
    setSelected(prev =>
      prev.includes(val) ? prev.filter(g => g !== val) : [...prev, val]
    )
  }

  function addCustomGiro() {
    const val = newGiro.trim().toLowerCase()
    if (!val || selected.includes(val)) { setNewGiro(''); return }
    setSelected(prev => [...prev, val])
    setNewGiro('')
    inputRef.current?.focus()
  }

  function removeCustomGiro(val) {
    setSelected(prev => prev.filter(g => g !== val))
  }

  function handleSave() {
    if (selected.length === 0) return
    onUpdateGiros(editing.key, selected)
    setEditing(null)
  }

  function handleReset() {
    onResetProfile(editing.key)
    setEditing(null)
  }

  // Custom giros = selected ones NOT in the predefined list
  const customGiros = selected.filter(g => !PREDEFINED.has(g))
  const canSave = selected.length > 0

  const modal = (
    <div
      className="pem-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="pem">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="pem__header">
          {editing && (
            <button className="pem__back" onClick={() => setEditing(null)}>← Volver</button>
          )}
          <h2 className="pem__title">
            {editing
              ? <><span style={{ marginRight: 6 }}>{editing.icon}</span>{editing.label}</>
              : 'Personalizar perfiles'}
          </h2>
          <button className="pem__close" onClick={onClose}>×</button>
        </div>

        {/* ── Lista de perfiles ───────────────────────────────────────── */}
        {!editing && (
          <div className="pem__body">
            <p className="pem__hint-text">Toca ✏️ para agregar o quitar giros de cualquier perfil.</p>
            <div className="pem__profile-list">
              {profiles.map(p => (
                <div key={p.key} className="pem__row-item" style={{ borderLeftColor: p.color }}>
                  <span className="pem__row-icon" style={{ background: p.bg }}>{p.icon}</span>
                  <div className="pem__row-info">
                    <span className="pem__row-label">
                      {p.label}
                      {p.modified && <span className="pem__modified-dot" style={{ background: p.color }} />}
                    </span>
                    <span className="pem__row-giros">{p.giros.join(' · ')}</span>
                  </div>
                  <button className="pem__edit-btn" onClick={() => openEdit(p)} title="Editar giros">
                    ✏️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Editor de giros ─────────────────────────────────────────── */}
        {editing && (
          <div className="pem__body">

            {/* Giros personalizados ya agregados (tags) */}
            {customGiros.length > 0 && (
              <div className="pem__custom-tags">
                <span className="pem__tags-label">Giros personalizados:</span>
                <div className="pem__tags-row">
                  {customGiros.map(g => (
                    <span key={g} className="pem__tag" style={{ borderColor: editing.color, color: editing.color }}>
                      {g}
                      <button className="pem__tag-remove" onClick={() => removeCustomGiro(g)}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de giros predefinidos */}
            <div className="pem__giros-list">
              {GIROS.map(g => (
                <label
                  key={g.value}
                  className={`pem__giro-check${selected.includes(g.value) ? ' pem__giro-check--active' : ''}`}
                  style={selected.includes(g.value) ? { borderLeftColor: editing.color } : {}}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(g.value)}
                    onChange={() => toggleGiro(g.value)}
                  />
                  <span>{g.label}</span>
                </label>
              ))}
            </div>

            {/* Input para giro libre */}
            <div className="pem__add-giro">
              <input
                ref={inputRef}
                className="pem__add-giro-input"
                placeholder="Agregar giro… ej: talleres mecánicos"
                value={newGiro}
                onChange={e => setNewGiro(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomGiro() } }}
              />
              <button
                className="pem__add-giro-btn"
                onClick={addCustomGiro}
                disabled={!newGiro.trim()}
              >
                + Agregar
              </button>
            </div>

            <div className="pem__count-badge">
              {selected.length} giro{selected.length !== 1 ? 's' : ''} seleccionado{selected.length !== 1 ? 's' : ''}
            </div>

            <div className="pem__form-actions">
              {editing.modified && (
                <button className="pem__btn pem__btn--reset" onClick={handleReset}>
                  Restaurar
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button className="pem__btn pem__btn--cancel" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button className="pem__btn pem__btn--save" disabled={!canSave} onClick={handleSave}>
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
