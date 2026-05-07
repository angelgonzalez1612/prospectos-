const axios = require('axios')

const BASE    = 'https://nominatim.openstreetmap.org'
const HEADERS = { 'User-Agent': 'ProspectFinder/1.0 (contacto@ejemplo.mx)' }

async function reverseGeocode(lat, lng, zoom) {
  const { data } = await axios.get(`${BASE}/reverse`, {
    params: { lat, lon: lng, format: 'geojson', polygon_geojson: 1, zoom, addressdetails: 1 },
    headers: HEADERS,
  })
  return data.features?.[0] ?? null
}

function bboxToMeta(feature, defaultNombre) {
  const addr = feature.properties?.address ?? {}
  const [minLng, minLat, maxLng, maxLat] = feature.bbox
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2
  const radiusMeters = Math.round(
    Math.max(Math.abs(maxLat - minLat), Math.abs(maxLng - minLng)) * 111_000 / 2
  )
  return {
    nombre: addr.city || addr.town || addr.village || addr.county || addr.state || defaultNombre,
    estado: addr.state || '',
    geojson: feature.geometry,
    centroid: { lat: centerLat, lng: centerLng },
    radiusMeters: Math.min(radiusMeters, 50_000),
  }
}

// zoom=10 → municipio / alcaldía
async function getZoneBoundary(lat, lng) {
  const feature = await reverseGeocode(lat, lng, 10)
  if (!feature) throw new Error('No se encontró ninguna zona en esas coordenadas')

  const addr = feature.properties?.address ?? {}

  // Must be inside Mexico
  if (addr.country_code && addr.country_code !== 'mx') {
    throw new Error('El punto seleccionado está fuera de México')
  }

  // Must resolve to a municipality-level name (not just state or country)
  const municipioNombre = addr.city || addr.town || addr.village || addr.county || addr.municipality
  if (!municipioNombre) {
    throw new Error('No se pudo identificar un municipio en esa ubicación. Intenta hacer click en el centro de la localidad')
  }

  return bboxToMeta(feature, municipioNombre)
}

// zoom=5 → estado / entidad federativa
async function getStateBoundaryByCoords(lat, lng) {
  const feature = await reverseGeocode(lat, lng, 5)
  if (!feature) throw new Error('No se encontró el estado')
  const addr = feature.properties?.address ?? {}
  const [minLng, minLat, maxLng, maxLat] = feature.bbox
  const radiusMeters = Math.round(
    Math.max(Math.abs(maxLat - minLat), Math.abs(maxLng - minLng)) * 111_000 / 2
  )
  return {
    nombre: addr.state || 'Estado',
    estado: addr.state || '',
    geojson: feature.geometry,
    centroid: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
    radiusMeters: Math.min(radiusMeters, 50_000),
  }
}

module.exports = { getZoneBoundary, getStateBoundaryByCoords }
