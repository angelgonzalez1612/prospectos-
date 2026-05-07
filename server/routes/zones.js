const express = require('express')
const axios   = require('axios')
const router  = express.Router()
const { getZoneBoundary, getStateBoundaryByCoords } = require('../services/nominatimService')
const { searchPlaces, searchPlacesByLocation }       = require('../services/placesService')

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

// ── Límite de municipio al hacer click en el mapa ─────────────────────────────
router.post('/boundary', async (req, res) => {
  const { lat, lng } = req.body
  if (lat == null || lng == null) return res.status(400).json({ error: 'lat y lng requeridos' })
  try {
    res.json(await getZoneBoundary(lat, lng))
  } catch (err) {
    console.error('[zones/boundary]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Límite de estado (geocodifica primero con Google, luego Nominatim) ─────────
router.post('/state-boundary', async (req, res) => {
  const { estado } = req.body
  if (!estado) return res.status(400).json({ error: 'estado requerido' })

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  try {
    const geoRes = await axios.get(GEOCODE_URL, {
      params: { address: `${estado}, México`, key: apiKey, language: 'es', region: 'mx' },
    })
    const center = geoRes.data.results?.[0]?.geometry?.location
    if (!center) throw new Error(`No se pudo geocodificar: ${estado}`)

    const boundary = await getStateBoundaryByCoords(center.lat, center.lng)
    res.json(boundary)
  } catch (err) {
    console.error('[zones/state-boundary]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Búsqueda por zona / radio ─────────────────────────────────────────────────
router.post('/search', async (req, res) => {
  const { giro, centroid, radiusMeters } = req.body
  if (!giro || !centroid) return res.status(400).json({ error: 'giro y centroid requeridos' })
  try {
    res.json(await searchPlacesByLocation(giro, centroid, radiusMeters))
  } catch (err) {
    console.error('[zones/search]', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
