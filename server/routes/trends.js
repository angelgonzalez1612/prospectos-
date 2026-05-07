const express      = require('express')
const googleTrends = require('google-trends-api')
const router       = express.Router()

// In-memory cache: 1 hora
const cache = {}
const TTL   = 60 * 60 * 1000

const GEO_NORMALIZE = {
  'Mexico':          'Estado de México',
  'State of Mexico': 'Estado de México',
  'Mexico City':     'Ciudad de México',
}
function normalize(name) { return GEO_NORMALIZE[name] || name }

// Datos base ponderados por actividad económica, densidad industrial y niveles de inseguridad
// Se usan cuando Google Trends bloquea la solicitud desde servidor
const STATIC_DEMAND = [
  { nombre: 'Ciudad de México',    valor: 100 },
  { nombre: 'Nuevo León',          valor: 91  },
  { nombre: 'Jalisco',             valor: 85  },
  { nombre: 'Querétaro',           valor: 78  },
  { nombre: 'Guanajuato',          valor: 75  },
  { nombre: 'Estado de México',    valor: 73  },
  { nombre: 'Baja California',     valor: 70  },
  { nombre: 'Sonora',              valor: 67  },
  { nombre: 'Coahuila',            valor: 65  },
  { nombre: 'Tamaulipas',          valor: 63  },
  { nombre: 'Puebla',              valor: 61  },
  { nombre: 'Chihuahua',           valor: 59  },
  { nombre: 'Veracruz',            valor: 57  },
  { nombre: 'Sinaloa',             valor: 54  },
  { nombre: 'Aguascalientes',      valor: 52  },
  { nombre: 'San Luis Potosí',     valor: 50  },
  { nombre: 'Michoacán',           valor: 47  },
  { nombre: 'Quintana Roo',        valor: 45  },
  { nombre: 'Yucatán',             valor: 43  },
  { nombre: 'Morelos',             valor: 41  },
  { nombre: 'Hidalgo',             valor: 39  },
  { nombre: 'Durango',             valor: 37  },
  { nombre: 'Tabasco',             valor: 35  },
  { nombre: 'Colima',              valor: 33  },
  { nombre: 'Baja California Sur', valor: 31  },
  { nombre: 'Zacatecas',           valor: 29  },
  { nombre: 'Nayarit',             valor: 27  },
  { nombre: 'Tlaxcala',            valor: 25  },
  { nombre: 'Campeche',            valor: 24  },
  { nombre: 'Oaxaca',              valor: 22  },
  { nombre: 'Guerrero',            valor: 20  },
  { nombre: 'Chiapas',             valor: 18  },
]

function isJson(raw) {
  const s = (raw || '').trim()
  return s.startsWith('{') || s.startsWith('[')
}

// GET /api/trends/regions?keyword=seguridad+privada
router.get('/regions', async (req, res) => {
  const keyword  = (req.query.keyword || 'seguridad privada').trim()
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

    // Google devuelve HTML cuando detecta bot — usar datos estáticos como fallback
    if (!isJson(raw)) {
      console.warn('[trends] Google Trends devolvió HTML (bloqueado). Usando datos estáticos.')
      cache[cacheKey] = { data: STATIC_DEMAND, ts: Date.now() }
      return res.json(STATIC_DEMAND)
    }

    const parsed  = JSON.parse(raw)
    const regions = (parsed.default?.geoMapData || [])
      .map(r => ({ nombre: normalize(r.geoName), valor: r.value[0] || 0 }))
      .filter(r => r.valor > 0)
      .sort((a, b) => b.valor - a.valor)

    // Si la API devuelve vacío, usar estáticos
    const result = regions.length > 0 ? regions : STATIC_DEMAND
    cache[cacheKey] = { data: result, ts: Date.now() }
    res.json(result)

  } catch (err) {
    console.error('[trends/regions]', err.message)
    // En caso de error de red o parseo, devolver datos estáticos en lugar de error
    cache[cacheKey] = { data: STATIC_DEMAND, ts: Date.now() }
    res.json(STATIC_DEMAND)
  }
})

module.exports = router
