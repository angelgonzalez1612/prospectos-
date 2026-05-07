import axios from 'axios'

export async function searchProspects(giro, estado, radiusMeters, centroid = null) {
  const { data } = await axios.post('/api/prospects/search', { giro, estado, radiusMeters, centroid })
  return data
}
