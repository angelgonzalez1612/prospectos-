const express      = require('express')
const googleTrends = require('google-trends-api')
const router       = express.Router()

// In-memory cache: 1 hora
const cache = {}
const TTL   = 60 * 60 * 1000

// Fallback map in case API returns English names without hl param
const GEO_NORMALIZE = {
  'Mexico':          'Estado de México',
  'State of Mexico': 'Estado de México',
  'Mexico City':     'Ciudad de México',
}

function normalize(name) { return GEO_NORMALIZE[name] || name }

// GET /api/trends/regions?keyword=seguridad+privada
router.get('/regions', async (req, res) => {
  const keyword = (req.query.keyword || 'seguridad privada').trim()
  const cacheKey = keyword.toLowerCase()

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    return res.json(cache[cacheKey].data)
  }

  try {
    const raw = await googleTrends.interestByRegion({
      keyword,
      geo: 'MX',
      resolution: 'REGION',
      hl: 'es',
    })

    const parsed  = JSON.parse(raw)
    const regions = (parsed.default?.geoMapData || [])
      .map(r => ({ nombre: normalize(r.geoName), valor: r.value[0] || 0 }))
      .filter(r => r.valor > 0)
      .sort((a, b) => b.valor - a.valor)

    cache[cacheKey] = { data: regions, ts: Date.now() }
    res.json(regions)
  } catch (err) {
    console.error('[trends/regions]', err.message)
    res.status(502).json({ error: 'No se pudo obtener datos de Google Trends. Intenta de nuevo.' })
  }
})

module.exports = router
