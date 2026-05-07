import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'
import { MAP_STYLE } from '../../constants/mapStyle'
import FilterPanel       from '../FilterPanel/FilterPanel'
import CompanyInfoWindow from '../CompanyInfoWindow/CompanyInfoWindow'
import ZoneOverlay       from '../ZoneOverlay/ZoneOverlay'
import RadiusCircle      from '../RadiusCircle/RadiusCircle'
import ProspectsPanel    from '../ProspectsPanel/ProspectsPanel'
import TrendsWidget      from '../TrendsWidget/TrendsWidget'
import RoutePanel        from '../RoutePanel/RoutePanel'
import DemandBar         from '../DemandBar/DemandBar'
import { useProspects }  from '../../hooks/useProspects'
import { useZone }       from '../../hooks/useZone'
import { getStateBoundary } from '../../services/zoneService'
import { ESTADO_CENTROIDS } from '../../constants/estadoCentroids'
import './MapView.css'

const LIBRARIES     = ['places', 'visualization']  // must be stable (outside component) to avoid reload warnings

const HEATMAP_GRADIENT = [
  'rgba(0,0,0,0)',
  'rgba(0,0,0,0)',
  'rgba(34,197,94,0.5)',
  'rgba(132,204,22,0.75)',
  'rgba(234,179,8,0.85)',
  'rgba(249,115,22,0.92)',
  'rgba(239,68,68,1)',
  'rgba(220,38,38,1)',
]
const MEXICO_CENTER = { lat: 23.6345, lng: -102.5528 }
const MAP_OPTIONS = {
  zoomControl: true, streetViewControl: false,
  mapTypeControl: false, fullscreenControl: true,
  clickableIcons: false,
  styles: MAP_STYLE,
}

// ── Pines SVG personalizados ───────────────────────────────────────────────────
// Verde  🟢 = teléfono + web (prospecto completo)
// Naranja 🟠 = solo uno de los dos
// Rojo   🔴 = solo nombre/dirección  (era gris, no se veía)
const PIN_COLORS = {
  full:    { fill: '#16a34a', ring: '#14532d' }, // verde
  partial: { fill: '#f97316', ring: '#c2410c' }, // naranja
  minimal: { fill: '#ef4444', ring: '#991b1b' }, // rojo
}

function buildPinSvg(fill, ring) {
  // Gota clásica con círculo blanco interior y sombra sutil
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44">
    <defs>
      <filter id="s" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#00000055"/>
      </filter>
    </defs>
    <path filter="url(#s)"
      d="M16 2C9.37 2 4 7.37 4 14c0 10.5 12 28 12 28S28 24.5 28 14C28 7.37 22.63 2 16 2z"
      fill="${fill}" stroke="${ring}" stroke-width="1.5"/>
    <circle cx="16" cy="14" r="6" fill="white" opacity="0.92"/>
  </svg>`
}

function getMarkerIcon(prospect) {
  if (!window.google) return undefined

  const hasPhone = !!prospect.telefono
  const hasWeb   = !!prospect.sitioWeb
  const score    = (hasPhone ? 1 : 0) + (hasWeb ? 1 : 0)
  const key      = score === 2 ? 'full' : score === 1 ? 'partial' : 'minimal'
  const { fill, ring } = PIN_COLORS[key]

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildPinSvg(fill, ring))}`,
    scaledSize: new window.google.maps.Size(32, 44),
    anchor:     new window.google.maps.Point(16, 44),
  }
}

export default function MapView() {
  const [giro, setGiro]                       = useState('')
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [mode, setMode]                       = useState('estado')
  const [estado, setEstado]                   = useState('')
  const [estadoZone, setEstadoZone]           = useState(null)
  const [isLoadingEstado, setLoadingEstado]   = useState(false)
  const [estadoError, setEstadoError]         = useState(null)
  const [radioCenter, setRadioCenter]         = useState(null)
  const [radioKm, setRadioKm]                 = useState(10)
  const [direccionCenter, setDireccionCenter] = useState(null)
  const [trendsData, setTrendsData]           = useState([])
  const [showHeatmap, setShowHeatmap]         = useState(false)
  const [sidebarOpen, setSidebarOpen]         = useState(false)

  // Ref to cancel in-flight estado boundary requests when mode changes
  const estadoCallId = useRef(0)

  const { prospects, isLoading, error, search, clearProspects } = useProspects()
  // useZone is now exclusively for municipio mode
  const { zone: municipioZone, isLoadingZone, zoneError, selectZone, clearZone } = useZone()
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [activeRouteMode, setActiveRouteMode]   = useState('DRIVING')
  const [routeDurations, setRouteDurations]     = useState({})
  const [routeDistances, setRouteDistances]     = useState({})
  const mapRef                = useRef(null)
  const directionsServiceRef  = useRef(null)
  const directionsRendererRef = useRef(null)
  const infoWindowRef         = useRef(null)
  const iwContainerRef        = useRef(null)
  const routePairRef          = useRef('')
  const modeRef               = useRef(mode)
  const heatmapRef            = useRef(null)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  })

  const onMapLoad = useCallback((map) => {
    mapRef.current = map

    directionsServiceRef.current = new window.google.maps.DirectionsService()
    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#4f46e5', strokeWeight: 5, strokeOpacity: 0.85 },
    })

    // InfoWindow imperativo — evita el bug de portal vacío de @react-google-maps/api
    const container = document.createElement('div')
    iwContainerRef.current = container
    const iw = new window.google.maps.InfoWindow({ content: container })
    iw.addListener('closeclick', () => setSelectedProspect(null))
    infoWindowRef.current = iw
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  modeRef.current = mode   // keeps ref in sync on every render without causing extra effects

  const giroFinal = giro.trim()

  // Fit bounds a marcadores — saltar en modo radio/dirección (el círculo ya marca la zona)
  useEffect(() => {
    if (!mapRef.current || prospects.length === 0) return
    if (modeRef.current === 'radio' || modeRef.current === 'direccion') return
    const bounds = new window.google.maps.LatLngBounds()
    let n = 0
    prospects.forEach((p) => { if (p.lat && p.lng) { bounds.extend({ lat: p.lat, lng: p.lng }); n++ } })
    if (n > 0) mapRef.current.fitBounds(bounds)
  }, [prospects])

  // Helpers de zoom — mode se lee del closure, no como dep, para evitar
  // que un cambio de modo (sin datos nuevos) dispare el efecto
  function zoomToGeojson(geojson) {
    const bounds = new window.google.maps.LatLngBounds()
    const flat = (ring) => ring.forEach(([lng, lat]) => bounds.extend({ lat, lng }))
    if (geojson.type === 'Polygon')      flat(geojson.coordinates[0])
    if (geojson.type === 'MultiPolygon') geojson.coordinates.forEach((p) => flat(p[0]))
    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds)
  }

  function zoomToCircle(center) {
    const R = radioKm / 111
    const b = new window.google.maps.LatLngBounds()
    b.extend({ lat: center.lat + R, lng: center.lng + R })
    b.extend({ lat: center.lat - R, lng: center.lng - R })
    mapRef.current.fitBounds(b)
  }

  // Zoom al estado — solo dispara cuando estadoZone cambia (no cuando cambia mode)
  useEffect(() => {
    if (!mapRef.current || mode !== 'estado' || !estadoZone?.geojson) return
    zoomToGeojson(estadoZone.geojson)
  }, [estadoZone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom al municipio — solo dispara cuando municipioZone cambia
  useEffect(() => {
    if (!mapRef.current || mode !== 'municipio' || !municipioZone?.geojson) return
    zoomToGeojson(municipioZone.geojson)
  }, [municipioZone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom al radio — solo dispara cuando radioCenter o radioKm cambian
  useEffect(() => {
    if (!mapRef.current || mode !== 'radio' || !radioCenter) return
    zoomToCircle(radioCenter)
  }, [radioCenter, radioKm]) // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom a dirección — solo dispara cuando direccionCenter o radioKm cambian
  useEffect(() => {
    if (!mapRef.current || mode !== 'direccion' || !direccionCenter) return
    zoomToCircle(direccionCenter)
  }, [direccionCenter, radioKm]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup en unmount
  useEffect(() => () => {
    directionsRendererRef.current?.setMap(null)
    infoWindowRef.current?.close()
    heatmapRef.current?.setMap(null)
  }, [])

  // Rebuild heatmap: siempre basado en demanda por estado (trendsData), nunca en prospectos
  useEffect(() => {
    if (!window.google?.maps?.visualization || !mapRef.current) return
    heatmapRef.current?.setMap(null)
    heatmapRef.current = null

    if (trendsData.length === 0) return

    const points = trendsData
      .map(d => {
        const c = ESTADO_CENTROIDS[d.nombre]
        if (!c) return null
        return {
          location: new window.google.maps.LatLng(c.lat, c.lng),
          weight:   d.valor,
        }
      })
      .filter(Boolean)

    if (points.length === 0) return

    heatmapRef.current = new window.google.maps.visualization.HeatmapLayer({
      data:        points,
      map:         null,
      radius:      90,
      opacity:     0.82,
      dissipating: true,
      gradient:    HEATMAP_GRADIENT,
    })
    if (showHeatmap) heatmapRef.current.setMap(mapRef.current)
  }, [trendsData]) // eslint-disable-line

  // Toggle heatmap: centrar México para ver la demanda nacional completa
  useEffect(() => {
    if (!heatmapRef.current) return
    heatmapRef.current.setMap(showHeatmap ? mapRef.current : null)
    if (showHeatmap && mapRef.current) {
      setSelectedProspect(null)
      mapRef.current.setCenter(MEXICO_CENTER)
      mapRef.current.setZoom(5)
    }
  }, [showHeatmap]) // eslint-disable-line

  // Punto de origen de ruta: dirección fijada o centro de radio
  const routeOrigin = (mode === 'direccion' && direccionCenter) ? direccionCenter
                    : (mode === 'radio'     && radioCenter)     ? radioCenter
                    : null

  // Abrir/cerrar InfoWindow según prospecto seleccionado
  useEffect(() => {
    const iw = infoWindowRef.current
    if (!iw) return
    if (!selectedProspect?.lat || routeOrigin) { iw.close(); return }
    iw.setPosition({ lat: selectedProspect.lat, lng: selectedProspect.lng })
    iw.open(mapRef.current)
  }, [selectedProspect, routeOrigin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Obtener tiempos de todos los modos cuando cambia el par origen/destino
  useEffect(() => {
    const svc = directionsServiceRef.current
    if (!svc || !routeOrigin || !selectedProspect?.lat) {
      setRouteDurations({})
      setRouteDistances({})
      directionsRendererRef.current?.setMap(null)
      return
    }
    setRouteDurations({})
    setRouteDistances({})
    ;['DRIVING', 'WALKING', 'TRANSIT', 'BICYCLING'].forEach((mk) => {
      svc.route({
        origin:      { lat: routeOrigin.lat,           lng: routeOrigin.lng           },
        destination: { lat: selectedProspect.lat,      lng: selectedProspect.lng      },
        travelMode:  window.google.maps.TravelMode[mk],
      }, (result, status) => {
        if (status !== 'OK') return
        const leg = result.routes[0].legs[0]
        setRouteDurations((p) => ({ ...p, [mk]: leg.duration.text }))
        setRouteDistances((p) => ({ ...p, [mk]: leg.distance.text }))
      })
    })
  }, [routeOrigin, selectedProspect]) // eslint-disable-line

  // Dibujar ruta en el mapa según el tab activo; fitBounds solo al cambiar el par
  useEffect(() => {
    const svc = directionsServiceRef.current
    const rdr = directionsRendererRef.current
    if (!svc || !rdr || !routeOrigin || !selectedProspect?.lat) return

    const pairKey = `${routeOrigin.lat},${routeOrigin.lng}|${selectedProspect.lat},${selectedProspect.lng}`
    const isNewPair = routePairRef.current !== pairKey
    routePairRef.current = pairKey

    svc.route({
      origin:      { lat: routeOrigin.lat,      lng: routeOrigin.lng      },
      destination: { lat: selectedProspect.lat, lng: selectedProspect.lng },
      travelMode:  window.google.maps.TravelMode[activeRouteMode],
    }, (result, status) => {
      if (status !== 'OK') return
      rdr.setMap(mapRef.current)
      rdr.setDirections(result)
      // Ajustar zoom para mostrar la ruta completa solo al seleccionar nuevo destino
      if (isNewPair && mapRef.current && result.routes[0]?.bounds) {
        mapRef.current.fitBounds(result.routes[0].bounds, {
          top: 100, left: 340, right: 60, bottom: 80,
        })
      }
    })
  }, [routeOrigin, selectedProspect, activeRouteMode]) // eslint-disable-line

  const handleModeChange = useCallback((m) => {
    estadoCallId.current += 1
    setMode(m); setSelectedProspect(null); clearProspects()
    if (m !== 'estado')    { setEstado(''); setEstadoZone(null); setEstadoError(null); setLoadingEstado(false) }
    if (m !== 'municipio') clearZone()
    if (m !== 'radio')     setRadioCenter(null)
    if (m !== 'direccion') setDireccionCenter(null)
  }, [clearProspects, clearZone])

  const handleEstadoChange = useCallback(async (e) => {
    setEstado(e); setEstadoZone(null); setEstadoError(null); clearProspects(); setSelectedProspect(null)
    if (!e) return
    const callId = ++estadoCallId.current
    setLoadingEstado(true)
    try {
      const data = await getStateBoundary(e)
      // Discard result if the user already switched mode or selected another estado
      if (estadoCallId.current !== callId) return
      setEstadoZone(data)
    } catch (err) {
      if (estadoCallId.current !== callId) return
      setEstadoError(err.response?.data?.error || err.message)
    } finally {
      if (estadoCallId.current === callId) setLoadingEstado(false)
    }
  }, [clearProspects])

  const handleMapClick = useCallback(async (ev) => {
    if (isLoadingZone || isLoading) return
    const lat = ev.latLng.lat()
    const lng = ev.latLng.lng()
    setSelectedProspect(null)
    if (mode === 'municipio') { clearProspects(); await selectZone(lat, lng) }
    else if (mode === 'radio') setRadioCenter({ lat, lng })
  }, [mode, isLoadingZone, isLoading, selectZone, clearProspects])

  const handleSearch = useCallback(async (g) => {
    setSelectedProspect(null)
    setSidebarOpen(false) // close drawer on mobile when search starts
    const giros = selectedProfile?.giros ?? [g]
    if (mode === 'estado')         await search(giros, 'estado',    { estado, estadoZone,      radiusKm: 50      })
    else if (mode === 'municipio') await search(giros, 'municipio', { zone: municipioZone,     radiusKm: radioKm })
    else if (mode === 'radio')     await search(giros, 'radio',     { center: radioCenter,     radiusKm: radioKm })
    else if (mode === 'direccion') await search(giros, 'direccion', { center: direccionCenter, radiusKm: radioKm })
    setPanelOpen(true)
  }, [mode, estado, estadoZone, municipioZone, radioCenter, direccionCenter, radioKm, search, selectedProfile])

  const handleTrendsSelect = useCallback((estadoName) => {
    estadoCallId.current += 1  // cancel any pending estado fetch before switching
    setMode('estado'); setSelectedProspect(null); clearProspects(); clearZone(); setRadioCenter(null)
    handleEstadoChange(estadoName)
  }, [clearProspects, clearZone, handleEstadoChange])

  const handleFocusProspect = useCallback((p) => {
    setSelectedProspect(p)
    if (mapRef.current && p.lat && p.lng) {
      mapRef.current.panTo({ lat: p.lat, lng: p.lng })
      mapRef.current.setZoom(16)
    }
  }, [])

  if (loadError) return <div className="map-state">Error al cargar Google Maps. Verifica tu API Key.</div>
  if (!isLoaded)  return <div className="map-state">Cargando mapa…</div>

  const activeGeojson = mode === 'estado' ? estadoZone?.geojson : mode === 'municipio' ? municipioZone?.geojson : null
  const zoneName      = mode === 'estado' ? estadoZone?.nombre  : mode === 'municipio' ? municipioZone?.nombre  : null
  const giroFinalLabel = giro.trim()

  const trendZone = mode === 'estado' ? estado
                  : mode === 'municipio' ? municipioZone?.estado
                  : null

  const zoneDemand = (() => {
    if (!trendsData.length || !trendZone) return null
    const lower = trendZone.toLowerCase()
    const entry = trendsData.find(d =>
      d.nombre.toLowerCase() === lower ||
      d.nombre.toLowerCase().startsWith(lower) ||
      lower.startsWith(d.nombre.toLowerCase())
    )
    if (!entry) return null
    const level = entry.valor >= 75 ? 'high' : entry.valor >= 40 ? 'mid' : 'low'
    const rank  = trendsData.indexOf(entry) + 1
    return { score: entry.valor, level, rank, total: trendsData.length }
  })()

  // Conteo por calidad de datos
  const full    = prospects.filter((p) =>  p.telefono &&  p.sitioWeb).length
  const partial = prospects.filter((p) => (p.telefono ||  p.sitioWeb) && !(p.telefono && p.sitioWeb)).length
  const minimal = prospects.filter((p) => !p.telefono && !p.sitioWeb).length

  return (
    <div className={`map-wrapper${panelOpen ? ' panel-open' : ''}`}>
      {/* Mobile: sidebar backdrop */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile: toggle FAB */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label="Abrir panel de filtros"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* ── Left sidebar: search + trends ─────────────────────────────── */}
      <div className={`left-sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <FilterPanel
          selectedProfile={selectedProfile}     onProfileChange={setSelectedProfile}
          giro={giro}                           onGiroChange={setGiro}
          mode={mode}                           onModeChange={handleModeChange}
          estado={estado}                       onEstadoChange={handleEstadoChange}
          estadoZone={estadoZone}
          municipioZone={municipioZone}         onClearMunicipio={() => { clearZone(); clearProspects() }}
          radioCenter={radioCenter}             onClearRadioCenter={() => { setRadioCenter(null); clearProspects() }}
          radioKm={radioKm}                     onRadioChange={setRadioKm}
          direccionCenter={direccionCenter}
          onDireccionSelect={(d) => { setDireccionCenter(d); clearProspects() }}
          onClearDireccion={() => { setDireccionCenter(null); clearProspects() }}
          onSearch={handleSearch}
          isLoading={isLoading}
          isLoadingZone={isLoadingZone || isLoadingEstado}
        />
        <TrendsWidget
          selectedEstado={trendZone}
          onSelectEstado={handleTrendsSelect}
          onDemandData={setTrendsData}
        />
      </div>

      {(error || zoneError || estadoError) && (
        <div className="map-toast map-toast--error">{error || zoneError || estadoError}</div>
      )}
      {(isLoadingZone || isLoadingEstado) && !isLoading && (
        <div className="map-toast map-toast--info">
          {mode === 'estado' ? 'Cargando límite del estado…' : 'Detectando municipio…'}
        </div>
      )}

      {/* Botón heatmap + contador + leyenda */}
      {(trendsData.length > 0 || prospects.length > 0) && (
        <div className="map-bottom-info">
          <button
            className={`map-heatmap-btn${showHeatmap ? ' map-heatmap-btn--active' : ''}`}
            onClick={() => setShowHeatmap(h => !h)}
            title={prospects.length === 0 ? 'Ver demanda nacional por estado' : 'Ver densidad de prospectos'}
          >
            🔥 {showHeatmap ? 'Ocultar mapa de calor' : 'Mapa de calor'}
          </button>

          {prospects.length > 0 && !isLoading && !isLoadingZone && !isLoadingEstado && (
            <div className="map-counter">
              {prospects.length} prospecto{prospects.length !== 1 ? 's' : ''}
              {zoneName && <> en <strong>{zoneName}</strong></>}
            </div>
          )}

          {showHeatmap ? (
            <div className="map-legend">
              <span className="map-legend__heat-bar" />
              <span>Demanda baja</span>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>→ Alta demanda</span>
            </div>
          ) : prospects.length > 0 ? (
            <div className="map-legend">
              <span className="map-legend__dot map-legend__dot--full" />
              <span>Completo ({full})</span>
              <span className="map-legend__dot map-legend__dot--partial" />
              <span>Parcial ({partial})</span>
              <span className="map-legend__dot map-legend__dot--minimal" />
              <span>Básico ({minimal})</span>
            </div>
          ) : null}
        </div>
      )}

      {isLoading && (
        <div className="map-overlay">
          <div className="map-overlay__box">
            <div className="map-overlay__spinner" />
            <p className="map-overlay__text">Buscando prospectos…</p>
            <p className="map-overlay__sub">puede tardar hasta 30 s por giro</p>
          </div>
        </div>
      )}

      <GoogleMap
        mapContainerClassName="map-container"
        center={MEXICO_CENTER}
        zoom={5}
        onLoad={onMapLoad}
        options={MAP_OPTIONS}
        onClick={handleMapClick}
      >
        <ZoneOverlay geojson={activeGeojson ?? null} />

        {mode === 'radio' && (
          <RadiusCircle center={radioCenter}     radiusMeters={radioKm * 1000} radiusKm={radioKm} />
        )}
        {mode === 'direccion' && (
          <RadiusCircle center={direccionCenter} radiusMeters={radioKm * 1000} radiusKm={radioKm} />
        )}

        {!showHeatmap && prospects.map((p, i) =>
          p.lat && p.lng ? (
            <Marker
              key={p.id || i}
              position={{ lat: p.lat, lng: p.lng }}
              title={p.nombre}
              icon={getMarkerIcon(p)}
              onClick={() => setSelectedProspect(p)}
            />
          ) : null
        )}

      </GoogleMap>

      {/* Portal de contenido del InfoWindow nativo */}
      {!showHeatmap && selectedProspect && !routeOrigin && iwContainerRef.current &&
        createPortal(<CompanyInfoWindow company={selectedProspect} />, iwContainerRef.current)
      }

      {/* Barra de demanda — top center cuando hay estado/municipio seleccionado */}
      {trendZone && zoneDemand && !routeOrigin && (
        <DemandBar
          estado={trendZone}
          score={zoneDemand.score}
          level={zoneDemand.level}
          rank={zoneDemand.rank}
          total={zoneDemand.total}
        />
      )}

      {!showHeatmap && routeOrigin && selectedProspect?.lat && selectedProspect?.lng && (
        <RoutePanel
          origin={routeOrigin}
          destination={selectedProspect}
          durations={routeDurations}
          distances={routeDistances}
          activeMode={activeRouteMode}
          onModeChange={setActiveRouteMode}
          onClose={() => setSelectedProspect(null)}
        />
      )}

      {prospects.length > 0 && (
        <ProspectsPanel
          prospects={prospects}
          isOpen={panelOpen}
          onOpen={() => setPanelOpen(true)}
          onClose={() => setPanelOpen(false)}
          onFocusProspect={handleFocusProspect}
          meta={{ giro: giroFinalLabel, zona: zoneName }}
          zoneDemand={zoneDemand}
        />
      )}
    </div>
  )
}
