import { useState, useEffect, useCallback, useRef } from 'react'
import { getTrendsByRegion } from '../../services/trendsService'
import { getJobPostings, getSecurityNews } from '../../services/intentService'
import { ESTADOS } from '../../constants/estados'
import './TrendsWidget.css'

const KEYWORD_GROUPS = [
  {
    group: 'General',
    icon: '🛡️',
    items: [
      { label: 'Seguridad privada',     value: 'seguridad privada'     },
      { label: 'Vigilancia privada',    value: 'vigilancia privada'    },
      { label: 'Empresas de seguridad', value: 'empresas de seguridad' },
      { label: 'Seguridad corporativa', value: 'seguridad corporativa' },
    ],
  },
  {
    group: 'Personal',
    icon: '👤',
    items: [
      { label: 'Guardias de seguridad', value: 'guardias de seguridad' },
      { label: 'Protección ejecutiva',  value: 'protección ejecutiva'  },
      { label: 'Escoltas personales',   value: 'escoltas personales'   },
      { label: 'Custodia de valores',   value: 'custodia de valores'   },
    ],
  },
  {
    group: 'Tecnología',
    icon: '📷',
    items: [
      { label: 'Control de acceso',     value: 'control de acceso'     },
      { label: 'Monitoreo de alarmas',  value: 'monitoreo de alarmas'  },
      { label: 'Alarmas de seguridad',  value: 'alarmas de seguridad'  },
      { label: 'Sistemas de seguridad', value: 'sistemas de seguridad' },
      { label: 'Seguridad electrónica', value: 'seguridad electrónica' },
      { label: 'CCTV circuito cerrado', value: 'CCTV circuito cerrado' },
      { label: 'Cámaras de seguridad',  value: 'cámaras de seguridad'  },
    ],
  },
  {
    group: 'Operativo',
    icon: '🚔',
    items: [
      { label: 'Patrullaje privado',    value: 'patrullaje privado'    },
      { label: 'Portería y vigilancia', value: 'portería y vigilancia' },
      { label: 'Seguridad industrial',  value: 'seguridad industrial'  },
      { label: 'Seguridad para eventos',value: 'seguridad para eventos'},
    ],
  },
  {
    group: 'Riesgo / Demanda',
    icon: '⚠️',
    items: [
      { label: 'Robo a negocio',        value: 'robo a negocio'        },
      { label: 'Robo con violencia',    value: 'robo con violencia'    },
      { label: 'Extorsión a empresa',   value: 'extorsión a empresa'   },
      { label: 'Inseguridad empresas',  value: 'inseguridad empresas'  },
    ],
  },
]


// Map Trends names to our ESTADOS list (Trends sometimes uses full official names)
const TRENDS_TO_ESTADO = {
  'Michoacán de Ocampo':                 'Michoacán',
  'Coahuila de Zaragoza':                'Coahuila',
  'Veracruz de Ignacio de la Llave':     'Veracruz',
}

function resolveEstado(trendsName) {
  // Direct match
  if (ESTADOS.includes(trendsName)) return trendsName
  // Known aliases
  if (TRENDS_TO_ESTADO[trendsName])  return TRENDS_TO_ESTADO[trendsName]
  // Fuzzy: find an ESTADO that the trends name starts with
  const found = ESTADOS.find(e => trendsName.startsWith(e) || e.startsWith(trendsName))
  return found || null
}

function intensityClass(val) {
  if (val >= 75) return 'high'
  if (val >= 40) return 'mid'
  return 'low'
}

function Bar({ nombre, valor, rank, isSelected, onSelect }) {
  const est = resolveEstado(nombre)
  const cls = intensityClass(valor)
  return (
    <div
      className={`tw-bar ${isSelected ? 'tw-bar--selected' : ''} ${est ? 'tw-bar--clickable' : ''}`}
      onClick={() => est && onSelect(est)}
      title={est ? `Buscar en ${nombre}` : nombre}
    >
      <span className={`tw-bar__rank tw-bar__rank--${cls}`}>#{rank}</span>
      <div className="tw-bar__main">
        <div className="tw-bar__top">
          <span className="tw-bar__name">{nombre}</span>
          <span className={`tw-bar__score tw-bar__score--${cls}`}>{valor}</span>
        </div>
        <div className="tw-bar__track">
          <div className={`tw-bar__fill tw-bar__fill--${cls}`} style={{ width: `${valor}%` }} />
        </div>
      </div>
      {est && <span className="tw-bar__arrow">›</span>}
    </div>
  )
}

export default function TrendsWidget({ selectedEstado, onSelectEstado, onDemandData }) {
  const [keyword, setKeyword]     = useState(KEYWORD_GROUPS[0].items[0].value)
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  // Tab state
  const [tab, setTab] = useState('demand')

  // Jobs state
  const [jobsData, setJobsData]       = useState(null)
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError]     = useState(null)

  // News state
  const [newsData, setNewsData]       = useState(null)
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError]     = useState(null)

  // Refs to track last fetched estado per intent tab
  const lastJobsEstado = useRef(null)
  const lastNewsEstado = useRef(null)

  const load = useCallback(async (kw) => {
    setLoading(true); setError(null)
    try {
      const result = await getTrendsByRegion(kw)
      setData(result)
      setUpdatedAt(new Date())
      if (onDemandData) onDemandData(result)
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudieron cargar las tendencias')
    } finally {
      setLoading(false)
    }
  }, [onDemandData])

  const loadJobs = useCallback(async (estado) => {
    setJobsLoading(true); setJobsError(null)
    try {
      const result = await getJobPostings(estado, 20)
      setJobsData(result)
      lastJobsEstado.current = estado
    } catch (e) {
      setJobsError(e.response?.data?.error || 'No se pudieron obtener vacantes')
    } finally {
      setJobsLoading(false)
    }
  }, [])

  const loadNews = useCallback(async (estado) => {
    setNewsLoading(true); setNewsError(null)
    try {
      const result = await getSecurityNews(estado, 8)
      setNewsData(result)
      lastNewsEstado.current = estado
    } catch (e) {
      setNewsError(e.response?.data?.error || 'No se pudieron obtener noticias')
    } finally {
      setNewsLoading(false)
    }
  }, [])

  // Auto-fetch intent tabs when tab changes or selectedEstado changes
  useEffect(() => {
    if (!selectedEstado) return
    if (tab === 'jobs' && lastJobsEstado.current !== selectedEstado) {
      loadJobs(selectedEstado)
    }
    if (tab === 'news' && lastNewsEstado.current !== selectedEstado) {
      loadNews(selectedEstado)
    }
  }, [tab, selectedEstado, loadJobs, loadNews])

  // Auto-load on mount and on keyword change
  useEffect(() => { load(keyword) }, [keyword, load])

  const handleKeyword = (kw) => { setKeyword(kw); setData(null) }

  const selectedEntry = data?.find(d =>
    d.nombre.toLowerCase() === (selectedEstado || '').toLowerCase() ||
    resolveEstado(d.nombre)?.toLowerCase() === (selectedEstado || '').toLowerCase()
  )
  const selectedRank = selectedEntry ? data.indexOf(selectedEntry) + 1 : null

  return (
    <div className="tw">
      {/* Header */}
      <div className="tw__header">
        <div>
          <h3 className="tw__title">📊 Demanda por zona</h3>
          <p className="tw__subtitle">Interés de búsqueda en México</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tw__tabs">
        <button
          className={`tw__tab ${tab === 'demand' ? 'tw__tab--active' : ''}`}
          onClick={() => setTab('demand')}
        >📊 Demanda</button>
        <button
          className={`tw__tab ${tab === 'jobs' ? 'tw__tab--active' : ''}`}
          onClick={() => setTab('jobs')}
        >💼 Vacantes</button>
        <button
          className={`tw__tab ${tab === 'news' ? 'tw__tab--active' : ''}`}
          onClick={() => setTab('news')}
        >📰 Noticias</button>
      </div>

      {/* ── Demand tab ── */}
      {tab === 'demand' && (
        <>
          {/* Selector compacto: una fila con categorías como optgroup */}
          <div className="tw__ksel-row">
            <span className="tw__ksel-label">🔍</span>
            <select
              className="tw__ksel"
              value={keyword}
              onChange={e => handleKeyword(e.target.value)}
            >
              {KEYWORD_GROUPS.map(g => (
                <optgroup key={g.group} label={`${g.icon} ${g.group}`}>
                  {g.items.map(k => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {updatedAt && (
              <button className="tw__refresh" onClick={() => load(keyword)} title="Actualizar">↻</button>
            )}
          </div>

          {/* Card de estado seleccionado */}
          {selectedEstado && selectedEntry && (
            <div className={`tw__sel-card tw__sel-card--${intensityClass(selectedEntry.valor)}`}>
              <div className="tw__sel-card__left">
                <span className="tw__sel-card__pin">📍</span>
                <div>
                  <p className="tw__sel-card__name">{selectedEstado}</p>
                  <p className="tw__sel-card__kw">{keyword}</p>
                </div>
              </div>
              <div className="tw__sel-card__right">
                <span className="tw__sel-card__score">{selectedEntry.valor}</span>
                <span className="tw__sel-card__rank">#{selectedRank} / {data.length}</span>
              </div>
            </div>
          )}
          {selectedEstado && data && !selectedEntry && (
            <div className="tw__sel-card tw__sel-card--none">
              📍 <strong>{selectedEstado}</strong> — sin datos para este término
            </div>
          )}

          {/* States list */}
          <div className="tw__body">
            {loading && (
              <div className="tw__loading">
                <span className="tw__spinner" />
                Consultando Google Trends…
              </div>
            )}
            {error && (
              <div className="tw__error">
                {error}
                <button className="tw__retry" onClick={() => load(keyword)}>Reintentar</button>
              </div>
            )}
            {data && !loading && (
              <div className="tw__list">
                {data.map((d, i) => (
                  <Bar
                    key={d.nombre}
                    nombre={d.nombre}
                    valor={d.valor}
                    rank={i + 1}
                    isSelected={
                      d.nombre.toLowerCase() === (selectedEstado || '').toLowerCase() ||
                      resolveEstado(d.nombre)?.toLowerCase() === (selectedEstado || '').toLowerCase()
                    }
                    onSelect={onSelectEstado}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Jobs tab ── */}
      {tab === 'jobs' && (
        <div className="tw__body">
          <div className="tw__intent">
            {!selectedEstado && (
              <p className="tw__intent-hint">Selecciona un estado para ver empresas buscando guardias</p>
            )}
            {selectedEstado && jobsLoading && (
              <div className="tw__intent-loading">
                <span className="tw__spinner" />
                Consultando vacantes…
              </div>
            )}
            {selectedEstado && jobsError && !jobsLoading && (
              <div className="tw__intent-error">
                {jobsError}
                <br />
                <button className="tw__intent-retry" onClick={() => { lastJobsEstado.current = null; loadJobs(selectedEstado) }}>
                  Reintentar
                </button>
              </div>
            )}
            {selectedEstado && jobsData && !jobsLoading && !jobsError && jobsData.length === 0 && (
              <p className="tw__intent-hint">No se encontraron vacantes activas en esta zona</p>
            )}
            {selectedEstado && jobsData && !jobsLoading && !jobsError && jobsData.length > 0 && jobsData.map((job, i) => (
              <div key={i} className="tw__job-card">
                <span className="tw__job-empresa">{job.empresa}</span>
                <div className="tw__job-meta">
                  <span>{job.puesto} · {job.ciudad}</span>
                  <span>{job.fecha ? new Date(job.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : ''}</span>
                </div>
                <div className="tw__job-footer">
                  <span className="tw__job-badge">Prospecto activo 🎯</span>
                  <a href={job.url} target="_blank" rel="noreferrer" className="tw__job-link">Ver vacante →</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── News tab ── */}
      {tab === 'news' && (
        <div className="tw__body">
          <div className="tw__intent">
            {!selectedEstado && (
              <p className="tw__intent-hint">Selecciona un estado para ver noticias de seguridad</p>
            )}
            {selectedEstado && newsLoading && (
              <div className="tw__intent-loading">
                <span className="tw__spinner" />
                Consultando noticias…
              </div>
            )}
            {selectedEstado && newsError && !newsLoading && (
              <div className="tw__intent-error">
                {newsError}
                <br />
                <button className="tw__intent-retry" onClick={() => { lastNewsEstado.current = null; loadNews(selectedEstado) }}>
                  Reintentar
                </button>
              </div>
            )}
            {selectedEstado && newsData && !newsLoading && !newsError && newsData.length === 0 && (
              <p className="tw__intent-hint">No se encontraron noticias recientes para esta zona</p>
            )}
            {selectedEstado && newsData && !newsLoading && !newsError && newsData.length > 0 && newsData.map((item, i) => (
              <div key={i} className="tw__news-card">
                <span className="tw__news-title">{item.titulo}</span>
                <div className="tw__news-meta">
                  <span>{item.fuente}</span>
                  <span>{item.fecha ? new Date(item.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : ''}</span>
                </div>
                {item.snippet && <span className="tw__news-snippet">{item.snippet}</span>}
                <a href={item.url} target="_blank" rel="noreferrer" className="tw__news-link">Leer nota →</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
