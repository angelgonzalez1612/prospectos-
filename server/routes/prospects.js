const express = require('express')
const router = express.Router()
const { searchPlaces } = require('../services/placesService')

router.post('/search', async (req, res) => {
  const { giro, estado, radiusMeters, centroid } = req.body
  if (!giro || !estado) {
    return res.status(400).json({ error: 'Giro y estado son requeridos' })
  }
  try {
    const results = await searchPlaces(giro, estado, radiusMeters, centroid ?? null)
    res.json(results)
  } catch (err) {
    console.error('[prospects/search]', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
