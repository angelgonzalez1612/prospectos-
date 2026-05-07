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

// ── Ciudades ancla por estado ─────────────────────────────────────────────────
// TODOS los estados tienen anclas. El centroide ya se agrega automáticamente;
// aquí van las ciudades adicionales (3-6 por estado según su tamaño y dispersión).
const ESTADO_EXTRA_ANCHORS = {
  // ── Norte grande ──────────────────────────────────────────────────────────
  'Sonora': [
    { lat: 29.0795, lng: -110.9346 }, // Hermosillo (capital, ya es centroide)
    { lat: 27.4863, lng: -109.9298 }, // Ciudad Obregón
    { lat: 31.2974, lng: -110.9371 }, // Nogales
    { lat: 27.9203, lng: -110.8981 }, // Guaymas
    { lat: 30.7167, lng: -111.0500 }, // Caborca
    { lat: 31.3308, lng: -113.5584 }, // Puerto Peñasco
  ],
  'Chihuahua': [
    { lat: 28.6330, lng: -106.0691 }, // Chihuahua capital
    { lat: 31.7360, lng: -106.4870 }, // Ciudad Juárez
    { lat: 26.9225, lng: -101.4508 }, // Delicias
    { lat: 27.0782, lng: -104.8987 }, // Hidalgo del Parral
    { lat: 28.2000, lng: -105.4700 }, // Cuauhtémoc
  ],
  'Coahuila': [
    { lat: 25.4232, lng: -100.9963 }, // Saltillo
    { lat: 25.5694, lng: -103.4363 }, // Torreón (centroide aprox)
    { lat: 29.0553, lng: -100.9353 }, // Piedras Negras
    { lat: 28.7066, lng: -100.5100 }, // Ciudad Acuña
    { lat: 27.8693, lng: -101.0075 }, // Monclova
    { lat: 26.5081, lng: -104.0527 }, // Gómez Palacio (Durango/Coah)
  ],
  'Coahuila de Zaragoza': [
    { lat: 25.4232, lng: -100.9963 }, { lat: 25.5694, lng: -103.4363 },
    { lat: 29.0553, lng: -100.9353 }, { lat: 27.8693, lng: -101.0075 },
  ],
  'Baja California': [
    { lat: 32.5030, lng: -117.0040 }, // Tijuana
    { lat: 32.6245, lng: -115.4523 }, // Mexicali (capital)
    { lat: 31.8686, lng: -116.5965 }, // Ensenada
    { lat: 31.3460, lng: -116.3530 }, // Valle de Guadalupe / Tecate area
  ],
  'Baja California Sur': [
    { lat: 24.1426, lng: -110.3128 }, // La Paz (capital)
    { lat: 23.2494, lng: -109.6842 }, // Los Cabos / Cabo San Lucas
    { lat: 25.8784, lng: -111.6768 }, // Santa Rosalía
  ],
  'Sinaloa': [
    { lat: 24.8018, lng: -107.3939 }, // Culiacán (capital)
    { lat: 23.2494, lng: -106.4111 }, // Mazatlán
    { lat: 25.7942, lng: -108.9877 }, // Los Mochis
    { lat: 25.4395, lng: -108.0038 }, // Guasave
  ],
  'Durango': [
    { lat: 24.0277, lng: -104.6532 }, // Durango capital
    { lat: 25.5694, lng: -103.4363 }, // Gómez Palacio / Lerdo
    { lat: 23.1846, lng: -104.3254 }, // Vicente Guerrero area
  ],
  // ── Noreste ───────────────────────────────────────────────────────────────
  'Nuevo León': [
    { lat: 25.6866, lng:  -100.3161 }, // Monterrey (capital)
    { lat: 25.7260, lng:  -100.2523 }, // San Nicolás de los Garza
    { lat: 25.6751, lng:  -100.4668 }, // San Pedro Garza García
    { lat: 25.7464, lng:  -100.4656 }, // Santa Catarina
    { lat: 25.5792, lng:   -99.9962 }, // Apodaca / Escobedo
    { lat: 25.4305, lng:  -100.9852 }, // Linares
  ],
  'Tamaulipas': [
    { lat: 22.9917, lng:  -98.9949 }, // Tampico
    { lat: 25.8701, lng:  -97.5026 }, // Matamoros
    { lat: 26.0374, lng:  -98.2933 }, // Reynosa
    { lat: 27.4993, lng:  -99.5075 }, // Nuevo Laredo
    { lat: 23.7369, lng:  -98.0711 }, // Ciudad Victoria (capital)
  ],
  // ── Occidente ─────────────────────────────────────────────────────────────
  'Jalisco': [
    { lat: 20.6595, lng: -103.3494 }, // Guadalajara (capital)
    { lat: 20.6597, lng: -103.2494 }, // Zapopan / Tlaquepaque
    { lat: 20.5203, lng: -103.0164 }, // Tonalá / El Salto
    { lat: 20.9167, lng: -104.8833 }, // Puerto Vallarta
    { lat: 20.6168, lng: -101.1889 }, // Lagos de Moreno
    { lat: 20.3636, lng: -102.7344 }, // Ocotlán
  ],
  'Michoacán': [
    { lat: 19.7060, lng: -101.1950 }, // Morelia (capital)
    { lat: 19.1030, lng: -102.0688 }, // Lázaro Cárdenas
    { lat: 19.4320, lng: -102.0591 }, // Uruapan
    { lat: 20.0270, lng: -102.3218 }, // Zamora
  ],
  'Michoacán de Ocampo': [
    { lat: 19.7060, lng: -101.1950 }, { lat: 19.4320, lng: -102.0591 },
    { lat: 19.1030, lng: -102.0688 }, { lat: 20.0270, lng: -102.3218 },
  ],
  'Nayarit': [
    { lat: 21.5085, lng: -104.8950 }, // Tepic (capital)
    { lat: 21.0578, lng: -105.2275 }, // Bahía de Banderas / Nuevo Vallarta
    { lat: 21.8853, lng: -105.3735 }, // Santiago Ixcuintla
  ],
  'Colima': [
    { lat: 19.2452, lng: -103.7241 }, // Colima capital
    { lat: 19.1000, lng: -104.3167 }, // Manzanillo
  ],
  // ── Centro-norte ──────────────────────────────────────────────────────────
  'Zacatecas': [
    { lat: 22.7709, lng: -102.5832 }, // Zacatecas capital
    { lat: 22.4487, lng: -102.9878 }, // Guadalupe
    { lat: 22.8816, lng: -103.0328 }, // Jerez
    { lat: 24.0148, lng: -104.6625 }, // Fresnillo
  ],
  'San Luis Potosí': [
    { lat: 22.1547, lng: -100.9757 }, // SLP capital
    { lat: 22.0000, lng:  -98.9700 }, // Ciudad Valles
    { lat: 23.2940, lng: -101.0200 }, // Matehuala
    { lat: 21.1545, lng:  -98.7508 }, // Tamazunchale
  ],
  'Aguascalientes': [
    { lat: 21.8818, lng: -102.2916 }, // Aguascalientes capital
    { lat: 22.0000, lng: -102.3500 }, // Jesús María / Calvillo
  ],
  'Guanajuato': [
    { lat: 21.0190, lng: -101.2574 }, // Guanajuato capital
    { lat: 21.1237, lng: -101.6762 }, // León
    { lat: 20.9173, lng: -101.0178 }, // Irapuato
    { lat: 20.5500, lng: -100.8167 }, // Celaya
    { lat: 20.8830, lng: -101.5566 }, // Salamanca
    { lat: 21.3704, lng: -101.9279 }, // Lagos de Moreno lado Gto
  ],
  'Querétaro': [
    { lat: 20.5888, lng: -100.3899 }, // Querétaro capital
    { lat: 20.5600, lng: -100.4400 }, // San Juan del Río
    { lat: 20.7900, lng: -100.4400 }, // El Marqués / Parque industrial
  ],
  // ── Centro ────────────────────────────────────────────────────────────────
  'Ciudad de México': [
    { lat: 19.4326, lng:  -99.1332 }, // Centro
    { lat: 19.3600, lng:  -99.1700 }, // Sur (Coyoacán / Tlalpan)
    { lat: 19.4900, lng:  -99.1500 }, // Norte (Gustavo A. Madero)
    { lat: 19.4000, lng:  -99.0700 }, // Oriente (Iztapalapa)
    { lat: 19.4600, lng:  -99.2200 }, // Poniente (Álvaro Obregón)
  ],
  'México': [
    { lat: 19.2936, lng:  -99.6554 }, // Toluca
    { lat: 19.5438, lng:  -99.0170 }, // Tlalnepantla / Naucalpan
    { lat: 19.5680, lng:  -98.9290 }, // Ecatepec
    { lat: 19.4978, lng:  -99.2295 }, // Naucalpan
    { lat: 19.3752, lng:  -98.9107 }, // Nezahualcóyotl
    { lat: 19.1617, lng:  -99.4978 }, // Metepec
  ],
  'Estado de México': [
    { lat: 19.2936, lng:  -99.6554 }, { lat: 19.5438, lng:  -99.0170 },
    { lat: 19.5680, lng:  -98.9290 }, { lat: 19.3752, lng:  -98.9107 },
    { lat: 19.1617, lng:  -99.4978 },
  ],
  'Morelos': [
    { lat: 18.9261, lng:  -99.2306 }, // Cuernavaca (capital)
    { lat: 18.8061, lng:  -99.2306 }, // Jiutepec
    { lat: 18.6530, lng:  -99.1600 }, // Cuautla
  ],
  'Hidalgo': [
    { lat: 20.0911, lng:  -98.7624 }, // Pachuca (capital)
    { lat: 19.9966, lng:  -98.9187 }, // Tizayuca / Tepeji
    { lat: 20.5761, lng:  -99.1609 }, // Tula de Allende
    { lat: 21.1564, lng:  -98.4091 }, // Huejutla
  ],
  'Tlaxcala': [
    { lat: 19.3182, lng:  -98.2375 }, // Tlaxcala capital
    { lat: 19.3000, lng:  -98.1800 }, // Apizaco
  ],
  'Puebla': [
    { lat: 19.0414, lng:  -98.2063 }, // Puebla capital
    { lat: 18.4515, lng:  -97.3910 }, // Tehuacán
    { lat: 19.1150, lng:  -98.2800 }, // San Andrés Cholula / Cuautlancingo
    { lat: 19.2170, lng:  -98.4000 }, // Atlixco
  ],
  // ── Occidente-Sur ─────────────────────────────────────────────────────────
  'Guerrero': [
    { lat: 16.8631, lng:  -99.8826 }, // Acapulco
    { lat: 17.5506, lng:  -99.5009 }, // Chilpancingo (capital)
    { lat: 17.6388, lng: -101.5530 }, // Zihuatanejo
    { lat: 18.4111, lng:  -99.6900 }, // Iguala
  ],
  'Oaxaca': [
    { lat: 17.0732, lng:  -96.7266 }, // Oaxaca capital
    { lat: 16.1700, lng:  -95.2000 }, // Salina Cruz / Tehuantepec
    { lat: 16.0030, lng:  -97.0740 }, // Puerto Escondido
    { lat: 16.8583, lng:  -99.8883 }, // Pinotepa Nacional
  ],
  'Chiapas': [
    { lat: 16.7569, lng:  -93.1292 }, // Tuxtla Gutiérrez (capital)
    { lat: 14.9102, lng:  -92.1521 }, // Tapachula
    { lat: 16.7374, lng:  -92.6376 }, // San Cristóbal de las Casas
    { lat: 17.4617, lng:  -93.0022 }, // Ocosingo / Palenque
  ],
  // ── Golfo y Sur ───────────────────────────────────────────────────────────
  'Veracruz': [
    { lat: 19.1738, lng:  -96.1342 }, // Veracruz puerto
    { lat: 19.5438, lng:  -96.9269 }, // Xalapa (capital)
    { lat: 20.9672, lng:  -97.4114 }, // Poza Rica
    { lat: 17.9936, lng:  -94.5132 }, // Coatzacoalcos
    { lat: 18.0047, lng:  -93.5498 }, // Minatitlán
    { lat: 19.8152, lng:  -97.3626 }, // Tuxpan
  ],
  'Veracruz de Ignacio de la Llave': [
    { lat: 19.1738, lng:  -96.1342 }, { lat: 19.5438, lng:  -96.9269 },
    { lat: 20.9672, lng:  -97.4114 }, { lat: 17.9936, lng:  -94.5132 },
  ],
  'Tabasco': [
    { lat: 17.9869, lng:  -92.9303 }, // Villahermosa (capital)
    { lat: 18.0000, lng:  -94.0000 }, // Cárdenas
    { lat: 18.4500, lng:  -92.7500 }, // Jonuta / Tenosique area
  ],
  // ── Sureste ───────────────────────────────────────────────────────────────
  'Campeche': [
    { lat: 19.8301, lng:  -90.5349 }, // Campeche capital
    { lat: 18.6519, lng:  -91.8271 }, // Ciudad del Carmen
    { lat: 18.8533, lng:  -90.5293 }, // Champotón
  ],
  'Yucatán': [
    { lat: 20.9674, lng:  -89.6237 }, // Mérida (capital)
    { lat: 20.5100, lng:  -88.3000 }, // Valladolid
    { lat: 20.1310, lng:  -90.0000 }, // Ticul / Oxkutzcab
    { lat: 21.1800, lng:  -89.3400 }, // Motul / Izamal
  ],
  'Quintana Roo': [
    { lat: 21.1743, lng:  -86.8466 }, // Cancún
    { lat: 20.5082, lng:  -87.1964 }, // Playa del Carmen
    { lat: 18.5036, lng:  -88.2961 }, // Chetumal (capital)
    { lat: 20.2121, lng:  -87.4654 }, // Tulum
    { lat: 21.0667, lng:  -86.7667 }, // Isla Mujeres / Pto Morelos
  ],
  // ── Sinaloa ──────────────────────────────────────────────────────────────
  'Sinaloa': [
    { lat: 24.8018, lng: -107.3939 }, // Culiacán (capital)
    { lat: 23.2494, lng: -106.4111 }, // Mazatlán
    { lat: 25.7942, lng: -108.9877 }, // Los Mochis
    { lat: 25.4395, lng: -108.0038 }, // Guasave
    { lat: 24.7883, lng: -107.4001 }, // Navolato
  ],
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
      const d = i < 60 ? await getPlaceDetails(place.place_id, apiKey) : {}
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

  // Anclas: ciudades del estado (sin duplicar el centroide si ya está en la lista)
  const extraAnchors = ESTADO_EXTRA_ANCHORS[estado] || []
  // Dedup anclas por proximidad (evita grids solapados de la misma ciudad)
  const allAnchors = [center, ...extraAnchors].filter((a, i, arr) =>
    i === 0 || arr.slice(0, i).every(prev => distanceMeters(prev.lat, prev.lng, a.lat, a.lng) > 15_000)
  )

  // Top 3 términos para el canal B (máxima cobertura textual)
  const topTerms = terms.slice(0, 3)

  // Grid 60km alrededor de cada ancla
  const GRID_R = 60_000
  const allGridPoints = allAnchors.flatMap(a => buildGrid(a, GRID_R).points)
  const cRadius = calcCellRadius(GRID_R, 4) // siempre celda de 4×4

  // Dedup grid points por proximidad también
  const gridPoints = allGridPoints.filter((pt, i, arr) =>
    i === 0 || arr.slice(0, i).every(prev => distanceMeters(prev.lat, prev.lng, pt.lat, pt.lng) > 8_000)
  )

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

    // B) Grid texto — top 3 términos desde cada celda
    ...gridPoints.flatMap(pt =>
      topTerms.map(term =>
        fetchPages({
          query: `${term} en ${estado} México`, language: 'es', region: 'mx',
          location: `${pt.lat},${pt.lng}`, radius: cRadius,
        }, apiKey)
      )
    ),

    // C) Nearby por tipo desde cada celda del grid
    ...types.flatMap(type =>
      gridPoints.map(pt =>
        fetchNearbyPages({
          location: `${pt.lat},${pt.lng}`,
          radius: cRadius, type, language: 'es',
        }, apiKey)
      )
    ),
  ]

  const results = await Promise.all(allSearches)
  const all = dedup(results.flat()).filter(isMexicoResult)
  console.log(`[estado] anchors:${allAnchors.length} gridPts:${gridPoints.length} raw:${results.flat().length} dedup:${all.length}`)
  return formatResults(all.slice(0, 200), apiKey)
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
  return formatResults(raw.slice(0, 200), apiKey)
}

module.exports = { searchPlaces, searchPlacesByLocation }
