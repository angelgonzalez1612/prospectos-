import { Polygon } from '@react-google-maps/api'

const POLYGON_OPTIONS = {
  fillColor: '#4f46e5',
  fillOpacity: 0.12,
  strokeColor: '#4f46e5',
  strokeOpacity: 0.9,
  strokeWeight: 2.5,
  clickable: false,
  zIndex: 1,
}

function geojsonToPaths(geojson) {
  if (geojson.type === 'Polygon') {
    // coordinates[0] = exterior ring, rest = holes
    return geojson.coordinates.map((ring) =>
      ring.map(([lng, lat]) => ({ lat, lng }))
    )
  }
  if (geojson.type === 'MultiPolygon') {
    // each sub-polygon is rendered separately
    return geojson.coordinates.map((polygon) =>
      polygon[0].map(([lng, lat]) => ({ lat, lng }))
    )
  }
  return []
}

export default function ZoneOverlay({ geojson }) {
  if (!geojson) return null

  if (geojson.type === 'MultiPolygon') {
    const paths = geojsonToPaths(geojson)
    return paths.map((path, i) => (
      <Polygon key={i} paths={path} options={POLYGON_OPTIONS} />
    ))
  }

  const paths = geojsonToPaths(geojson)
  return <Polygon paths={paths} options={POLYGON_OPTIONS} />
}
