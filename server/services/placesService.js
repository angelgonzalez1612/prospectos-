const axios = require('axios')
const { getSearchTerms }  = require('../constants/giroSynonyms')
const { scrapeWebsite }   = require('./webScraper')

const TEXT_SEARCH_URL   = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
const NEARBY_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
const PLACE_DET_URL     = 'https://maps.googleapis.com/maps/api/place/details/json'
const GEOCODE_URL       = 'https://maps.googleapis.com/maps/api/geocode/json'
const DETAIL_FIELDS     = 'name,formatted_address,formatted_phone_number,website,geometry,international_phone_number,rating,user_ratings_total'

// ── Mapeo giro → tipos de Google Places ───────────────────────────────────────
// La búsqueda por tipo encuentra TODOS los lugares de esa categoría
// independientemente de cómo se llamen (ej. "Galerías" = shopping_mall)
const GIRO_PLACE_TYPES = {
  'plazas comerciales':             ['shopping_mall'],
  'hoteles':                        ['lodging'],
  'hospitales privados':            ['hospital'],
  'colegios y universidades':       ['school', 'university'],
  'bancos':                         ['bank'],
  'gasolineras':                    ['gas_station'],
  'supermercados':                  ['supermarket', 'grocery_or_supermarket'],
  'concesionarias':                 ['car_dealer'],
  'joyerías':                       ['jewelry_store'],
  'clubes y gimnasios':             ['gym'],
  'dependencias de gobierno':       ['local_government_office', 'city_hall'],
  'bodegas y almacenes':            ['storage'],
  'transporte y logística':         ['moving_company'],
  // Sin tipo exacto — solo text search
  'parques industriales':           [],
  'fábricas y plantas':             [],
  'edificios corporativos':         [],
  'fraccionamientos residenciales': [],
  'centros de datos':               [],
}

function getGiroTypes(giro) {
  const key = giro.toLowerCase().trim()
  if (GIRO_PLACE_TYPES[key] !== undefined) return GIRO_PLACE_TYPES[key]
  const match = Object.keys(GIRO_PLACE_TYPES).find(k => key.includes(k) || k.includes(key))
  return match ? GIRO_PLACE_TYPES[match] : []
}

// ── Ciudades secundarias por estado (para estados grandes) ────────────────────
// Se añaden como anclas adicionales de búsqueda cuando el centroide no cubre todo
const ESTADO_EXTRA_ANCHORS = {
  'Sonora':              [{ lat: 27.4863, lng: -109.9298 }, { lat: 31.2974, lng: -110.9371 }, { lat: 27.9203, lng: -110.8981 }], // Obregón, Nogales, Guaymas
  'Chihuahua':           [{ lat: 31.7360, lng: -106.4870 }, { lat: 27.0782, lng: -104.8987 }], // Juárez, Hidalgo del Parral
  'Coahuila':            [{ lat: 25.4232, lng: -100.9963 }, { lat: 29.0553, lng: -100.9353 }, { lat: 28.7066, lng: -100.5100 }], // Saltillo, Piedras Negras, Acuña
  'Coahuila de Zaragoza':[{ lat: 25.4232, lng: -100.9963 }, { lat: 29.0553, lng: -100.9353 }],
  'Baja California':     [{ lat: 32.5030, lng: -117.0040 }, { lat: 31.8686, lng: -116.5965 }, { lat: 32.6245, lng: -115.4523 }], // Tijuana, Ensenada, Mexicali
  'Baja California Sur': [{ lat: 23.2494, lng: -109.6842 }, { lat: 24.1426, lng: -110.3128 }], // Los Cabos, La Paz
  'Sinaloa':             [{ lat: 24.8018, lng: -107.3939 }, { lat: 23.2494, lng: -106.4111 }, { lat: 25.7942, lng: -108.9877 }], // Culiacán, Mazatlán, Los Mochis
  'Durango':             [{ lat: 23.6236, lng: -104.2963 }], // Durango city
  'Jalisco':             [{ lat: 20.6595, lng: -103.3494 }, { lat: 21.1237, lng: -101.6762 }], // Guadalajara, Lagos de Moreno
  'Veracruz':            [{ lat: 19.5438, lng:  -96.9269 }, { lat: 20.9672, lng:  -97.4114 }, { lat: 18.9242, lng:  -96.9269 }], // Jalapa, Poza Rica, Veracruz puerto
  'Veracruz de Ignacio de la Llave': [{ lat: 19.5438, lng: -96.9269 }, { lat: 20.9672, lng: -97.4114 }],
  'Tamaulipas':          [{ lat: 25.8701, lng:  -97.5026 }, { lat: 26.0374, lng:  -98.2933 }, { lat: 22.9917, lng:  -98.9949 }], // Matamoros, Reynosa, Tampico
  'Guerrero':            [{ lat: 16.8631, lng:  -99.8826 }, { lat: 17.6388, lng: -101.5530 }], // Acapulco, Zihuatanejo
  'Oaxaca':              [{ lat: 16.8583, lng:  -99.8883 }, { lat: 16.3268, lng:  -95.2296 }], // ciudad, Tehuantepec
  'Quintana Roo':        [{ lat: 21.1743, lng:  -86.8466 }, { lat: 18.5036, lng:  -88.2961 }], // Cancún, Chetumal
  'Michoacán':           [{ lat: 19.7060, lng: -101.1950 }, { lat: 19.1030, lng: -102.0688 }], // Morelia, Lázaro Cárdenas
  'Michoacán de Ocampo': [{ lat: 19.7060, lng: -101.1950 }, { lat: 19.1030, lng: -102.0688 }],
  'Zacatecas':           [{ lat: 22.7709, lng: -102.5832 }, { lat: 22.4487, lng: -102.9878 }], // capital, Guadalupe
  'San Luis Potosí':     [{ lat: 22.1547, lng: -100.9757 }, { lat: 22.0000, lng:  -99.0160 }], // SLP, Valles
  'Campeche':            [{ lat: 18.6519, lng:  -91.8271 }], // Campeche ciudad
  'Yucatán':             [{ lat: 20.9674, lng:  -89.6237 }, { lat: 21.0381, lng:  -86.8761 }], // Mérida, Cancún side
  'Chiapas':             [{ lat: 16.7569, lng:  -93.1292 }, { lat: 14.9102, lng:  -92.1521 }, { lat: 16.3005, lng:  -92.1179 }], // Tuxtla, Tapachula, San Cristóbal
}

// ── Helpers geométricos ────────────────────────────────────────────────────────

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Cuadrícula dim×dim para la búsqueda por tipo (Nearby Search).
 * Cubre el área con solapado para no dejar huecos entre celdas.
 */
function buildGrid(centroid, radiusMeters) {
  const { lat, lng } = centroid
  const dim = radiusMeters < 10_000 ? 2
            : radiusMeters < 25_000 ? 3
            : 4

  const LAT_PER_M = 1 / 111_000
  const LNG_PER_M = 1 / (111_000 * Math.cos(lat * Math.PI / 180))
  const latHalf   = radiusMeters * 0.9 * LAT_PER_M
  const lngHalf   = radiusMeters * 0.9 * LNG_PER_M

  const points = []
  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      points.push({
        lat: lat - latHalf + (2 * latHalf / dim) * (r + 0.5),
        lng: lng - lngHalf + (2 * lngHalf / dim) * (c + 0.5),
      })
    }
  }
  return { points, dim }
}

// Radio por celda: mitad de la diagonal de cada celda + 30% de solapado
function calcCellRadius(radiusMeters, dim) {
  const cellSide = (radiusMeters * 2) / dim
  return Math.min(Math.round(cellSide * Math.SQRT2 / 2 * 1.3), 50_000)
}

// ── Places API helpers ─────────────────────────────────────────────────────────

async function getPlaceDetails(placeId, apiKey) {
  try {
    const { data } = await axios.get(PLACE_DET_URL, {
      params: { place_id: placeId, fields: DETAIL_FIELDS, key: apiKey, language: 'es' },
    })
    return data.result || {}
  } catch { return {} }
}

async function fetchPages(params, apiKey, maxPages = 3) {
  const all = []
  let token = null
  for (let p = 0; p < maxPages; p++) {
    const req = { ...params, key: apiKey }
    if (token) { req.pagetoken = token; await new Promise(r => setTimeout(r, 2200)) }
    try {
      const { data } = await axios.get(TEXT_SEARCH_URL, { params: req })
      all.push(...(data.results || []))
      token = data.next_page_token
      if (!token) break
    } catch (err) { console.error('[fetchPages]', err.message); break }
  }
  return all
}

async function fetchNearbyPages(params, apiKey, maxPages = 3) {
  const all = []
  let token = null
  for (let p = 0; p < maxPages; p++) {
    const req = { ...params, key: apiKey }
    if (token) { req.pagetoken = token; await new Promise(r => setTimeout(r, 2200)) }
    try {
      const { data } = await axios.get(NEARBY_SEARCH_URL, { params: req })
      all.push(...(data.results || []))
      token = data.next_page_token
      if (!token) break
    } catch (err) { console.error('[fetchNearbyPages]', err.message); break }
  }
  return all
}

function dedup(places) {
  const seen = new Set()
  return places.filter(p => { if (seen.has(p.place_id)) return false; seen.add(p.place_id); return true })
}

function isMexicoResult(place) {
  const addr = (place.formatted_address || '').toLowerCase()
  if (!addr) return true
  return addr.includes('méxico') || addr.includes('mexico')
}

async function formatResults(places, apiKey) {
  const base = await Promise.all(
    places.map(async (place, i) => {
      const d = i < 40 ? await getPlaceDetails(place.place_id, apiKey) : {}
      return {
        id:          place.place_id,
        nombre:      d.name                   || place.name,
        direccion:   d.formatted_address      || place.formatted_address   || null,
        telefono:    d.formatted_phone_number || d.international_phone_number || null,
        sitioWeb:    d.website                || null,
        email:       null,
        emailsExtra: [],
        whatsapp:    null,
        facebook:    null,
        instagram:   null,
        linkedin:    null,
        rating:      d.rating                 ?? place.rating              ?? null,
        reviewCount: d.user_ratings_total     ?? place.user_ratings_total  ?? 0,
        lat: d.geometry?.location?.lat ?? place.geometry?.location?.lat ?? null,
        lng: d.geometry?.location?.lng ?? place.geometry?.location?.lng ?? null,
      }
    })
  )

  const withSite = base.filter(r => r.sitioWeb).slice(0, 25)
  await Promise.all(
    withSite.map(async r => {
      const scraped = await scrapeWebsite(r.sitioWeb)
      const idx = base.findIndex(b => b.id === r.id)
      if (idx !== -1) {
        base[idx].email       = scraped.email       || base[idx].email
        base[idx].emailsExtra = scraped.emailsExtra || []
        base[idx].whatsapp    = scraped.whatsapp
        base[idx].facebook    = scraped.facebook
        base[idx].instagram   = scraped.instagram
        base[idx].linkedin    = scraped.linkedin
      }
    })
  )
  return base
}

async function geocodeCenter(query, apiKey) {
  try {
    const { data } = await axios.get(GEOCODE_URL, {
      params: { address: query, key: apiKey, language: 'es', region: 'mx' },
    })
    return data.results?.[0]?.geometry?.location ?? null
  } catch { return null }
}

// ── Búsqueda por estado ────────────────────────────────────────────────────────

async function searchPlaces(giro, estado, radiusMeters = 50_000, centroid = null) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY no configurada')

  const center = centroid ?? await geocodeCenter(`${estado}, México`, apiKey)
  if (!center) throw new Error('No se pudo ubicar el estado')

  const terms = getSearchTerms(giro)
  const types = getGiroTypes(giro)

  // Anclas: centroide + ciudades secundarias del estado (cubre estados grandes)
  const extraAnchors = ESTADO_EXTRA_ANCHORS[estado] || []
  const allAnchors   = [center, ...extraAnchors]

  // Grid de 60km alrededor de cada ancla
  const GRID_R = 60_000
  const { points: centerPoints, dim } = buildGrid(center, GRID_R)
  const cRadius = calcCellRadius(GRID_R, dim)

  // Puntos de grid de ciudades secundarias (3×3 o 2×2 según distancia)
  const extraPoints = extraAnchors.flatMap(a => buildGrid(a, GRID_R).points)

  const allSearches = [
    // A) Texto desde CADA ancla — todos los términos con nombre del estado
    ...allAnchors.flatMap(anchor =>
      terms.map(term =>
        fetchPages({
          query: `${term} en ${estado} México`, language: 'es', region: 'mx',
          location: `${anchor.lat},${anchor.lng}`, radius: 50_000,
        }, apiKey)
      )
    ),

    // B) Texto desde cada celda del grid completo — término principal
    ...[...centerPoints, ...extraPoints].map(pt =>
      fetchPages({
        query: `${terms[0]} en ${estado} México`, language: 'es', region: 'mx',
        location: `${pt.lat},${pt.lng}`, radius: cRadius,
      }, apiKey)
    ),

    // C) Nearby por tipo desde cada celda del grid
    ...types.flatMap(type =>
      [...centerPoints, ...extraPoints].map(pt =>
        fetchNearbyPages({
          location: `${pt.lat},${pt.lng}`,
          radius: cRadius, type, language: 'es',
        }, apiKey)
      )
    ),
  ]

  const results = await Promise.all(allSearches)
  const all = dedup(results.flat()).filter(isMexicoResult)
  console.log(`[estado] anchors:${allAnchors.length} raw:${results.flat().length} dedup:${all.length}`)
  return formatResults(all.slice(0, 150), apiKey)
}

// ── Búsqueda por coordenadas (municipio / radio / dirección) ──────────────────

async function searchPlacesByLocation(giro, centroid, radiusMeters = 10_000) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY no configurada')

  const terms = getSearchTerms(giro)
  const types = getGiroTypes(giro)
  const searchRadius = Math.max(radiusMeters, 20_000)
  const { points, dim } = buildGrid(centroid, searchRadius)
  const cRadius = calcCellRadius(searchRadius, dim)

  const allSearches = [
    // A) Texto desde el centro — todos los términos, radio amplio
    //    Base igual que antes, sin regresión
    ...terms.map(term =>
      fetchPages({
        query: `${term} México`, language: 'es', region: 'mx',
        location: `${centroid.lat},${centroid.lng}`,
        radius: Math.min(searchRadius, 50_000),
      }, apiKey)
    ),

    // B) Texto desde cada celda del grid — término principal
    //    Captura resultados locales que el centro no ve (Google cap 60/búsqueda)
    //    Beneficia a TODOS los giros, incluso sin tipo de Google
    ...points.map(pt =>
      fetchPages({
        query: `${terms[0]} México`, language: 'es', region: 'mx',
        location: `${pt.lat},${pt.lng}`,
        radius: cRadius,
      }, apiKey)
    ),

    // C) Nearby por tipo desde cada celda
    //    Captura lugares cuyo nombre no coincide con el término (ej. "Galerías" = shopping_mall)
    ...types.flatMap(type =>
      points.map(pt =>
        fetchNearbyPages({
          location: `${pt.lat},${pt.lng}`,
          radius: cRadius, type, language: 'es',
        }, apiKey)
      )
    ),
  ]

  const results = await Promise.all(allSearches)
  const raw = dedup(results.flat()).filter(isMexicoResult)
  console.log(`[municipio] raw:${results.flat().length} dedup:${raw.length}`)
  return formatResults(raw.slice(0, 150), apiKey)
}

module.exports = { searchPlaces, searchPlacesByLocation }
