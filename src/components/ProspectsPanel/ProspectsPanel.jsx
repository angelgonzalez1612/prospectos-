import { useState, useMemo } from 'react'
import { calcScore, scoreLabel, scoreColor, scoreStars } from '../../utils/prospectScore'
import './ProspectsPanel.css'

const QUALITY_FILTERS = [
  { key: 'all',     label: 'Todos'    },
  { key: 'full',    label: 'Completo' },
  { key: 'partial', label: 'Parcial'  },
  { key: 'minimal', label: 'Básico'   },
]

const SORT_OPTIONS = [
  { key: 'default',   label: 'Orden original'        },
  { key: 'name',      label: 'Nombre A–Z'             },
  { key: 'quality',   label: 'Mejor calidad primero'  },
  { key: 'potential', label: 'Mayor potencial primero' },
  { key: 'demand',    label: '🔥 Zona + potencial'    },
]

const REVIEW_OPTIONS = [
  { value: 0,   label: 'Cualquiera' },
  { value: 10,  label: '+10'        },
  { value: 50,  label: '+50'        },
  { value: 100, label: '+100'       },
]

const CONTACT_OPTIONS = [
  { key: 'all',   label: 'Todos'      },
  { key: 'phone', label: '📞 Tel'     },
  { key: 'email', label: '✉ Email'   },
  { key: 'both',  label: '📞+✉ Ambos' },
]

const POTENTIAL_OPTIONS = [
  { value: 0,  label: 'Cualquiera' },
  { value: 40, label: 'Medio+'     },
  { value: 60, label: 'Alto+'      },
]

function getQuality(p) {
  const pts = [p.telefono, p.email, p.sitioWeb, p.whatsapp].filter(Boolean).length
  if (pts >= 3) return 'full'
  if (pts >= 1) return 'partial'
  return 'minimal'
}

function ProspectCard({ p, onFocus }) {
  const q     = getQuality(p)
  const score = calcScore(p)
  const color = scoreColor(score)
  return (
    <div className={`pp-card pp-card--${q}`} onClick={() => onFocus(p)}>
      <div className="pp-card__header">
        <span className="pp-card__name">{p.nombre}</span>
        <div className="pp-card__badges">
          <span className={`pp-card__badge pp-card__badge--${q}`}>
            {q === 'full' ? 'Completo' : q === 'partial' ? 'Parcial' : 'Básico'}
          </span>
        </div>
      </div>

      <div className="pp-card__score" title={`Potencial: ${score}/100`}>
        <span className="pp-card__stars" style={{ color }}>{scoreStars(score)}</span>
        <span className="pp-card__score-label" style={{ color }}>{scoreLabel(score)}</span>
        <div className="pp-card__score-bar">
          <div className="pp-card__score-fill" style={{ width: `${score}%`, background: color }} />
        </div>
        {p.reviewCount > 0 && (
          <span className="pp-card__reviews" title="Reseñas en Google">
            ★{p.rating?.toFixed(1)} ({p.reviewCount})
          </span>
        )}
      </div>

      <div className="pp-card__rows">
        {p.direccion && <div className="pp-card__row"><span className="pp-card__icon">📍</span><span>{p.direccion}</span></div>}
        {p.telefono  && <div className="pp-card__row"><span className="pp-card__icon">📞</span><a href={`tel:${p.telefono}`} className="pp-card__link" onClick={e => e.stopPropagation()}>{p.telefono}</a></div>}
        {p.email     && <div className="pp-card__row"><span className="pp-card__icon">✉️</span><a href={`mailto:${p.email}`} className="pp-card__link" onClick={e => e.stopPropagation()}>{p.email}</a></div>}
        {p.sitioWeb  && <div className="pp-card__row"><span className="pp-card__icon">🌐</span><a href={p.sitioWeb} target="_blank" rel="noreferrer" className="pp-card__link" onClick={e => e.stopPropagation()}>{p.sitioWeb.replace(/^https?:\/\//, '').split('/')[0]}</a></div>}
      </div>

      {p.whatsapp && (
        <div className="pp-card__actions">
          <a
            href={`https://wa.me/52${p.whatsapp.replace(/\D/g, '').slice(-10)}`}
            target="_blank" rel="noreferrer"
            className="pp-card__btn pp-card__btn--wa"
            onClick={e => e.stopPropagation()}
          >WhatsApp</a>
        </div>
      )}
    </div>
  )
}

export default function ProspectsPanel({ prospects, isOpen, onClose, onOpen, onFocusProspect, meta, zoneDemand }) {
  const [search, setSearch]           = useState('')
  const [quality, setQuality]         = useState('all')
  const [sort, setSort]               = useState('default')
  const [exporting, setExp]           = useState(false)

  // Filtros avanzados
  const [advOpen, setAdvOpen]         = useState(false)
  const [minReviews, setMinReviews]   = useState(0)
  const [contactFilter, setContact]   = useState('all')
  const [minPotential, setMinPot]     = useState(0)

  const hasAdvFilters = minReviews > 0 || contactFilter !== 'all' || minPotential > 0

  const filtered = useMemo(() => {
    let list = [...prospects]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(p =>
        p.nombre?.toLowerCase().includes(q) ||
        p.direccion?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
      )
    }

    if (quality !== 'all')    list = list.filter(p => getQuality(p) === quality)
    if (minReviews > 0)       list = list.filter(p => (p.reviewCount || 0) >= minReviews)
    if (contactFilter === 'phone') list = list.filter(p => !!p.telefono)
    if (contactFilter === 'email') list = list.filter(p => !!p.email)
    if (contactFilter === 'both')  list = list.filter(p => !!p.telefono && !!p.email)
    if (minPotential > 0)     list = list.filter(p => calcScore(p) >= minPotential)

    if (sort === 'name')      list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
    if (sort === 'quality')   list.sort((a, b) => {
      const o = { full: 0, partial: 1, minimal: 2 }
      return o[getQuality(a)] - o[getQuality(b)]
    })
    if (sort === 'potential') list.sort((a, b) => calcScore(b) - calcScore(a))
    if (sort === 'demand') list.sort((a, b) => {
      const boost = (zoneDemand?.score ?? 50) / 100
      const sa = calcScore(a) * (1 + boost * 0.3)
      const sb = calcScore(b) * (1 + boost * 0.3)
      return sb - sa
    })

    return list
  }, [prospects, search, quality, sort, minReviews, contactFilter, minPotential, zoneDemand])

  function resetAdvFilters() {
    setMinReviews(0); setContact('all'); setMinPot(0)
  }

  async function handleExport() {
    setExp(true)
    try {
      const res = await fetch('/api/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospects: filtered, meta }),
      })
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'prospectos.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('No se pudo generar el Excel: ' + e.message)
    } finally { setExp(false) }
  }

  const full    = prospects.filter(p => getQuality(p) === 'full').length
  const partial = prospects.filter(p => getQuality(p) === 'partial').length
  const minimal = prospects.filter(p => getQuality(p) === 'minimal').length

  return (
    <div className={`pp ${isOpen ? 'pp--open' : ''}`}>
      <button className="pp__tab" onClick={isOpen ? onClose : onOpen} title={isOpen ? 'Cerrar lista' : 'Ver lista'}>
        {isOpen ? '›' : '‹'}
      </button>

      <div className="pp__inner">
        <div className="pp__head">
          {/* Título */}
          <div className="pp__title-row">
            <h2 className="pp__title">
              Prospectos <span className="pp__count">{prospects.length}</span>
            </h2>
            <button className="pp__close" onClick={onClose}>✕</button>
          </div>

          {/* Resumen de calidad */}
          <div className="pp__summary">
            <span className="pp__sum-pill pp__sum-pill--full">🟢 {full}</span>
            <span className="pp__sum-pill pp__sum-pill--partial">🟠 {partial}</span>
            <span className="pp__sum-pill pp__sum-pill--minimal">🔴 {minimal}</span>
          </div>

          {/* Demand badge */}
          {zoneDemand && (
            <div className={`pp__demand pp__demand--${zoneDemand.level}`}>
              {zoneDemand.level === 'high' ? '🔥' : zoneDemand.level === 'mid' ? '📈' : '📉'}
              {' '}Demanda {zoneDemand.level === 'high' ? 'alta' : zoneDemand.level === 'mid' ? 'media' : 'baja'}
              <span className="pp__demand-score">{zoneDemand.score}/100</span>
            </div>
          )}

          {/* Búsqueda de texto */}
          <input
            className="pp__search"
            placeholder="Buscar por nombre, email o dirección…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {/* Filtro calidad + orden */}
          <div className="pp__filters">
            <div className="pp__quality-pills">
              {QUALITY_FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`pp__qpill pp__qpill--${f.key} ${quality === f.key ? 'pp__qpill--active' : ''}`}
                  onClick={() => setQuality(f.key)}
                >{f.label}</button>
              ))}
            </div>
            <select className="pp__sort" value={sort} onChange={e => setSort(e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>

          {/* ── Filtros avanzados ──────────────────────────────── */}
          <div className="pp__adv">
            <button
              className={`pp__adv-toggle ${hasAdvFilters ? 'pp__adv-toggle--active' : ''}`}
              onClick={() => setAdvOpen(o => !o)}
            >
              <span>{advOpen ? '▲' : '▼'} Filtros avanzados</span>
              {hasAdvFilters && <span className="pp__adv-badge">activos</span>}
            </button>

            {advOpen && (
              <div className="pp__adv-body">

                {/* Min reseñas */}
                <div className="pp__adv-row">
                  <span className="pp__adv-label">Reseñas Google mínimas</span>
                  <div className="pp__adv-chips">
                    {REVIEW_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        className={`pp__adv-chip ${minReviews === o.value ? 'pp__adv-chip--active' : ''}`}
                        onClick={() => setMinReviews(o.value)}
                      >{o.label}</button>
                    ))}
                  </div>
                </div>

                {/* Contacto */}
                <div className="pp__adv-row">
                  <span className="pp__adv-label">Datos de contacto</span>
                  <div className="pp__adv-chips">
                    {CONTACT_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        className={`pp__adv-chip ${contactFilter === o.key ? 'pp__adv-chip--active' : ''}`}
                        onClick={() => setContact(o.key)}
                      >{o.label}</button>
                    ))}
                  </div>
                </div>

                {/* Potencial mínimo */}
                <div className="pp__adv-row">
                  <span className="pp__adv-label">Potencial mínimo</span>
                  <div className="pp__adv-chips">
                    {POTENTIAL_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        className={`pp__adv-chip ${minPotential === o.value ? 'pp__adv-chip--active' : ''}`}
                        onClick={() => setMinPot(o.value)}
                      >{o.label}</button>
                    ))}
                  </div>
                </div>

                {hasAdvFilters && (
                  <button className="pp__adv-reset" onClick={resetAdvFilters}>
                    ✕ Limpiar filtros avanzados
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Exportar */}
          <button className="pp__export" onClick={handleExport} disabled={exporting || filtered.length === 0}>
            {exporting ? '⏳ Generando…' : `⬇ Exportar Excel (${filtered.length})`}
          </button>
        </div>

        {/* Lista */}
        <div className="pp__list">
          {filtered.length === 0 ? (
            <p className="pp__empty">
              Sin resultados para los filtros aplicados.
              {hasAdvFilters && (
                <button className="pp__empty-reset" onClick={resetAdvFilters}>
                  Limpiar filtros avanzados
                </button>
              )}
            </p>
          ) : (
            filtered.map((p, i) => (
              <ProspectCard key={p.id || i} p={p} onFocus={onFocusProspect} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
