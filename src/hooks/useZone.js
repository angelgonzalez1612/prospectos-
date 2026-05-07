import { useState, useCallback } from 'react'
import { getZoneBoundary, getStateBoundary } from '../services/zoneService'

export function useZone() {
  const [zone, setZone]             = useState(null)
  const [isLoadingZone, setLoading] = useState(false)
  const [zoneError, setError]       = useState(null)

  const selectZone = useCallback(async (lat, lng) => {
    setLoading(true); setError(null)
    try {
      const data = await getZoneBoundary(lat, lng)
      setZone(data)
      return data
    } catch (err) {
      setError(err.response?.data?.error || err.message)
      return null
    } finally { setLoading(false) }
  }, [])

  const selectState = useCallback(async (estado) => {
    setLoading(true); setError(null)
    try {
      const data = await getStateBoundary(estado)
      setZone(data)
      return data
    } catch (err) {
      setError(err.response?.data?.error || err.message)
      return null
    } finally { setLoading(false) }
  }, [])

  const clearZone = useCallback(() => { setZone(null); setError(null) }, [])

  return { zone, isLoadingZone, zoneError, selectZone, selectState, clearZone }
}
