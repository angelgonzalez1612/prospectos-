const axios = require('axios')
const { getSearchTerms }  = require('../constants/giroSynonyms')
const { scrapeWebsite }   = require('./webScraper')

const TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
const PLACE_DET_URL   = 'https://maps.googleapis.com/maps/api/place/details/json'
const GEOCODE_URL     = 'https://maps.googleapis.com/maps/api/geocode/json'
const DETAIL_FIELDS   = 'name,formatted_address,formatted_phone_number,website,geometry,international_phone_number,rating,user_ratings_total'

// ── Helpers ────────────────────────────────────────────────────────────────────

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function getPlaceDetails(placeId, apiKey) {
  try {
    const { data } = await axios.get(PLACE_DET_URL, {
      params: { place_id: placeId, fields: DETAIL_FIELDS, key: apiKey, language: 'es' },
    })
    return data.result || {}
  } catch { return {} }
}

// Paginación con next_page_token (Google requiere ~2 s de delay entre páginas)
async function fetchPages(params, apiKey, maxPages = 3) {
  const all = []
  let token = null

  for (let p = 0; p < maxPages; p++) {
    const req = { ...params, key: apiKey }
    if (token) {
      req.pagetoken = token
      await new Promise((r) => setTimeout(r, 2200))
    }
    try {
      const { data } = await axios.get(TEXT_SEARCH_URL, { params: req })
      all.push(...(data.results || []))
      token = data.next_page_token
      if (!token) break
    } catch (err) {
      console.error('[fetchPages] p=' + p, err.message)
      break
    }
  }
  return all
}

// Deduplicar por place_id
function dedup(places) {
  const seen = new Set()
  return places.filter((p) => {
    if (seen.has(p.place_id)) return false
    seen.add(p.place_id)
    return true
  })
}

// Enriquecer resultados con Place Details + scraping de sitios web
async function formatResults(places, apiKey) {
  // Place Details en paralelo (primeros 40)
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

  // Scraping de sitios web en paralelo (máx 25 con website)
  const withSite = base.filter((r) => r.sitioWeb).slice(0, 25)

  await Promise.all(
    withSite.map(async (r) => {
      const scraped = await scrapeWebsite(r.sitioWeb)
      const idx = base.findIndex((b) => b.id === r.id)
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

// ── Filtro estricto: solo resultados en México ─────────────────────────────────

function isMexicoResult(place) {
  const addr = (place.formatted_address || '').toLowerCase()
  if (!addr) return true  // sin dirección: no descartar (haversine ya limita)
  return addr.includes('méxico') || addr.includes('mexico')
}

// ── Búsqueda con sinónimos en paralelo ────────────────────────────────────────

async function searchWithSynonyms(baseQuery, locationParams, apiKey) {
  const terms = getSearchTerms(baseQuery)
  const allPages = await Promise.all(
    terms.map((term) =>
      fetchPages({ query: `${term} México`, language: 'es', region: 'mx', ...locationParams }, apiKey)
    )
  )
  return dedup(allPages.flat())
}

// ── Búsqueda por estado ────────────────────────────────────────────────────────
// centroid opcional: si se provee, evita re-geocodificar y lo usa como sesgo de ubicación

async function searchPlaces(giro, estado, radiusMeters = 50_000, centroid = null) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY no configurada')

  const center = centroid ?? await geocodeCenter(`${estado}, México`, apiKey)

  const locationParams = center
    ? { location: `${center.lat},${center.lng}`, radius: 50_000 }
    : {}

  // Incluir nombre del estado en la query para mayor cobertura geográfica
  const terms      = getSearchTerms(giro)
  const stateTerms = terms.map((t) => `${t} en ${estado} México`)

  const allPages = await Promise.all(
    stateTerms.map((query) =>
      fetchPages({ query, language: 'es', region: 'mx', ...locationParams }, apiKey)
    )
  )

  const places = dedup(allPages.flat()).filter(isMexicoResult)
  return formatResults(places.slice(0, 100), apiKey)
}

// ── Búsqueda por coordenadas (zona / radio) ───────────────────────────────────

async function searchPlacesByLocation(giro, centroid, radiusMeters = 10_000) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY no configurada')

  const locationParams = {
    location: `${centroid.lat},${centroid.lng}`,
    radius:   Math.min(radiusMeters, 50_000),
  }

  const places = await searchWithSynonyms(giro, locationParams, apiKey)

  // Filtro duro de distancia — el radius de Google es solo un sesgo, no un límite
  const inRange = places.filter((p) => {
    if (!isMexicoResult(p)) return false
    const lat = p.geometry?.location?.lat
    const lng = p.geometry?.location?.lng
    if (lat == null || lng == null) return false
    return distanceMeters(centroid.lat, centroid.lng, lat, lng) <= radiusMeters
  })

  return formatResults(inRange.slice(0, 100), apiKey)
}

module.exports = { searchPlaces, searchPlacesByLocation }
