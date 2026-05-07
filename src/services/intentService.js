import axios from 'axios'

export async function getJobPostings(estado, limit = 20) {
  const { data } = await axios.get('/api/intent/jobs', { params: { estado, limit } })
  return data
}

export async function getSecurityNews(estado, limit = 8) {
  const { data } = await axios.get('/api/intent/news', { params: { estado, limit } })
  return data
}
