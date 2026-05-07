import { useEffect, useRef } from 'react'
import { Marker, useGoogleMap } from '@react-google-maps/api'

function getColor(radiusKm) {
  if (radiusKm <= 10) return '#22c55e'   // verde
  if (radiusKm <= 25) return '#f59e0b'   // ámbar
  return '#ef4444'                        // rojo
}

/**
 * Gestiona el google.maps.Circle directamente (en lugar del componente
 * wrapper de @react-google-maps/api) para garantizar que setMap(null)
 * se llame al desmontar o cuando el centro se elimina.
 */
export default function RadiusCircle({ center, radiusMeters, radiusKm }) {
  const map        = useGoogleMap()
  const circleRef  = useRef(null)
  const color      = getColor(radiusKm ?? 10)

  useEffect(() => {
    if (!map) return

    // Destruir círculo previo antes de crear uno nuevo
    if (circleRef.current) {
      circleRef.current.setMap(null)
      circleRef.current = null
    }

    if (center) {
      circleRef.current = new window.google.maps.Circle({
        map,
        center:        { lat: center.lat, lng: center.lng },
        radius:        radiusMeters,
        fillColor:     color,
        fillOpacity:   0.12,
        strokeColor:   color,
        strokeOpacity: 0.85,
        strokeWeight:  2.5,
        clickable:     false,
        zIndex:        1,
      })
    }

    // Cleanup garantizado al desmontar o al cambiar dependencias
    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null)
        circleRef.current = null
      }
    }
  }, [map, center, radiusMeters, color])

  if (!center || !window.google) return null

  const pinIcon = {
    path:        window.google.maps.SymbolPath.CIRCLE,
    fillColor:   color,
    fillOpacity: 1,
    strokeColor: 'white',
    strokeWeight: 2.5,
    scale:       8,
  }

  return <Marker position={center} icon={pinIcon} title="Centro de búsqueda" />
}
