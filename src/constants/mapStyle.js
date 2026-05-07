// Estilo "Warm Professional" — base beige cálido, sin íconos POI,
// fronteras de estados visibles, agua azul con buen contraste.
// Los pines de colores resaltan mucho más que sobre fondo blanco puro.
export const MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#f0ebe4' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#5c5550' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f0ebe4' }] },

  // Divisiones administrativas — solo bordes, sin relleno
  { featureType: 'administrative',              elementType: 'geometry',        stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.country',      elementType: 'geometry.stroke', stylers: [{ color: '#9e9088', visibility: 'on', weight: 2 }] },
  { featureType: 'administrative.province',     elementType: 'geometry.stroke', stylers: [{ color: '#c0b8b0', visibility: 'on', weight: 1 }] },
  { featureType: 'administrative.locality',     elementType: 'labels.text',     stylers: [{ visibility: 'simplified' }] },

  // Sin íconos de negocios (compiten con marcadores)
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },

  // Calles — blancas sobre el beige, buen contraste
  { featureType: 'road',             elementType: 'geometry',        stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',             elementType: 'geometry.stroke', stylers: [{ color: '#ddd5cc' }] },
  { featureType: 'road.highway',     elementType: 'geometry',        stylers: [{ color: '#f5f0ea' }] },
  { featureType: 'road.highway',     elementType: 'geometry.stroke', stylers: [{ color: '#c8bfb5' }] },
  { featureType: 'road.arterial',    elementType: 'labels.text.fill', stylers: [{ color: '#7a7068' }] },
  { featureType: 'road.highway',     elementType: 'labels.text.fill', stylers: [{ color: '#5a5248' }] },
  { featureType: 'road.local',       elementType: 'labels',           stylers: [{ visibility: 'off' }] },

  // Sin transporte público
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // Agua — azul medio, buen contraste contra el beige
  { featureType: 'water', elementType: 'geometry',        stylers: [{ color: '#9dbdda' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#7898b8' }] },

  // Terreno natural ligeramente más oscuro que el base
  { featureType: 'landscape.natural',  elementType: 'geometry', stylers: [{ color: '#e4ddd6' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#eae4de' }] },
]
