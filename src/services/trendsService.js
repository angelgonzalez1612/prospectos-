import axios from 'axios'

export async function getTrendsByRegion(keyword = 'seguridad privada') {
  const { data } = await axios.get('/api/trends/regions', { params: { keyword } })
  return data // [{ nombre, valor }] ordenado por valor desc
}
