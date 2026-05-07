import { useState, useCallback } from 'react'
import { searchProspects } from '../services/prospectService'
import { searchInZone }    from '../services/zoneService'
import { isInGeojson }     from '../utils/geoUtils'

function dedupById(list) {
  const seen = new Set()
  return list.filter(p => {
    if (!p.id || seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })
}

async function fetchForGiro(giro, modo, payload) {
  const radiusMeters = (payload.radiusKm ?? 10) * 1000

  if (modo === 'municipio') {
    const { zone } = payload
    const municipioRadius = zone.radiusMeters ?? radiusMeters
    let data = await searchInZone(giro, zone.centroid, municipioRadius)
    if (zone.geojson) {
      data = data.filter(p => p.lat != null && p.lng != null && isInGeojson(p.lat, p.lng, zone.geojson))
    }
    return data
  }

  if (modo === 'radio' || modo === 'direccion') {
    return searchInZone(giro, payload.center, radiusMeters)
  }

  // modo 'estado' — pass centroid from estadoZone to avoid re-geocoding server-side
  const { estadoZone } = payload
  let data = await searchProspects(
    giro,
    payload.estado,
    radiusMeters,
    estadoZone?.centroid ?? null
  )
  // Filter by state polygon so results outside the state boundary are removed
  if (estadoZone?.geojson) {
    data = data.filter(p => p.lat != null && p.lng != null && isInGeojson(p.lat, p.lng, estadoZone.geojson))
  }
  return data
}

export function useProspects() {
  const [prospects, setProspects] = useState([])
  const [isLoading, setLoading]   = useState(false)
  const [error, setError]         = useState(null)

  /**
   * search(giros, modo, payload)
   *   giros  — string | string[]
   *   modo   — 'estado' | 'municipio' | 'radio'
   *   payload — depende del modo
   */
  const search = useCallback(async (giros, modo, payload) => {
    const giroList = Array.isArray(giros) ? giros : [giros]
    setLoading(true); setError(null)
    try {
      const allResults = await Promise.all(
        giroList.map(g => fetchForGiro(g, modo, payload))
      )
      setProspects(dedupById(allResults.flat()))
    } catch (err) {
      setError(err.response?.data?.error || err.message)
      setProspects([])
    } finally {
      setLoading(false)
    }
  }, [])

  const clearProspects = useCallback(() => setProspects([]), [])

  return { prospects, isLoading, error, search, clearProspects }
}
