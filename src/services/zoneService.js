import axios from 'axios'

export async function getZoneBoundary(lat, lng) {
  const { data } = await axios.post('/api/zones/boundary', { lat, lng })
  return data
}

export async function getStateBoundary(estado) {
  const { data } = await axios.post('/api/zones/state-boundary', { estado })
  return data
}

export async function searchInZone(giro, centroid, radiusMeters) {
  const { data } = await axios.post('/api/zones/search', { giro, centroid, radiusMeters })
  return data
}
