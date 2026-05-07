import { useRef, useEffect } from 'react'

/**
 * Wraps window.google.maps.places.Autocomplete en un input plano.
 * Solo debe renderizarse después de que la API de Maps (con 'places') esté cargada.
 */
export default function AddressSearch({ onSelect }) {
  const inputRef    = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const input = inputRef.current
    if (!input || !window.google?.maps?.places) return

    const ac = new window.google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: 'mx' },
      fields: ['geometry', 'formatted_address', 'name'],
    })

    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place?.geometry?.location) return
      onSelectRef.current({
        lat:     place.geometry.location.lat(),
        lng:     place.geometry.location.lng(),
        address: place.formatted_address || place.name || '',
      })
    })

    return () => window.google.maps.event.removeListener(listener)
  }, [])

  return (
    <input
      ref={inputRef}
      className="fp__input fp__address-input"
      type="text"
      placeholder="Escribe una dirección o lugar…"
      autoComplete="off"
      // Evita que Enter envíe el formulario mientras el autocomplete está abierto
      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
    />
  )
}
