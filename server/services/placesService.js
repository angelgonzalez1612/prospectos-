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

  const { points, dim } = buildGrid(center, 60_000)
  const cRadius = calcCellRadius(60_000, dim)

  const allSearches = [
    // A) Texto desde el centro — todos los términos con nombre del estado
    ...terms.map(term =>
      fetchPages({
        query: `${term} en ${estado} México`, language: 'es', region: 'mx',
        location: `${center.lat},${center.lng}`, radius: 50_000,
      }, apiKey)
    ),

    // B) Texto desde cada celda del grid — término principal
    ...points.map(pt =>
      fetchPages({
        query: `${terms[0]} en ${estado} México`, language: 'es', region: 'mx',
        location: `${pt.lat},${pt.lng}`, radius: cRadius,
      }, apiKey)
    ),

    // C) Nearby por tipo desde cada celda
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
  const all = dedup(results.flat()).filter(isMexicoResult)
  console.log(`[estado] raw:${results.flat().length} dedup:${all.length}`)
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
