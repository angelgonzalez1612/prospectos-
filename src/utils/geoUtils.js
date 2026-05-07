// Ray-casting: devuelve true si (lat, lng) está dentro del anillo exterior del polígono
function pointInRing(lat, lng, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] // GeoJSON: [lng, lat]
    const [xj, yj] = ring[j]
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function isInGeojson(lat, lng, geojson) {
  if (!geojson) return true
  if (geojson.type === 'Polygon') {
    return pointInRing(lat, lng, geojson.coordinates[0])
  }
  if (geojson.type === 'MultiPolygon') {
    return geojson.coordinates.some((poly) => pointInRing(lat, lng, poly[0]))
  }
  return true
}
