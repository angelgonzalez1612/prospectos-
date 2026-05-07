const express  = require('express')
const axios    = require('axios')
const cheerio  = require('cheerio')
const router   = express.Router()

// In-memory cache: 30 minutos
const cache = {}
const TTL   = 30 * 60 * 1000

function cacheKey(type, estado) {
  return `${type}:${(estado || '').toLowerCase()}`
}

function isFresh(entry) {
  return entry && Date.now() - entry.ts < TTL
}

const JOB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  'Accept-Language': 'es-MX,es;q=0.9',
}

function parseRssJobs($, estado, limit) {
  const seen = new Set()
  const jobs = []
  $('item').each((_, el) => {
    const rawTitle   = $(el).find('title').first().text().trim()
    const link       = $(el).find('link').first().text().trim() || $(el).find('guid').first().text().trim()
    const pubDate    = $(el).find('pubDate').first().text().trim()
    const rawSnippet = $(el).find('description').first().text().trim()
    const parts  = rawTitle.split(' - ')
    const puesto  = parts[0]?.trim() || rawTitle
    const empresa = parts[1]?.trim() || 'Empresa'
    const ciudad  = parts[2]?.trim() || estado
    const key = empresa.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    const snippet = rawSnippet.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 180)
    jobs.push({ empresa, puesto, ciudad, url: link, fecha: pubDate, snippet })
  })
  return jobs.slice(0, limit)
}

// GET /api/intent/jobs?estado=Jalisco&limit=20
router.get('/jobs', async (req, res) => {
  const estado = (req.query.estado || '').trim()
  const limit  = Math.min(parseInt(req.query.limit, 10) || 20, 40)
  const key    = cacheKey('jobs', estado)

  if (isFresh(cache[key])) return res.json(cache[key].data)

  // Fuentes RSS de empleo en orden de preferencia
  const sources = [
    `https://mx.indeed.com/rss?q=guardia+de+seguridad&l=${encodeURIComponent(estado)}&sort=date`,
    `https://www.computrabajo.com.mx/rss/trabajo-de-guardia-de-seguridad-en-${encodeURIComponent(estado.toLowerCase().replace(/ /g,'-'))}.xml`,
  ]

  for (const url of sources) {
    try {
      const response = await axios.get(url, { headers: JOB_HEADERS, timeout: 10000 })
      // Si devuelve HTML (bloqueado) o está vacío, probar siguiente fuente
      const body = response.data || ''
      if (typeof body === 'string' && body.trim().startsWith('<html')) continue
      const $ = cheerio.load(body, { xmlMode: true })
      const jobs = parseRssJobs($, estado, limit)
      if (jobs.length > 0) {
        cache[key] = { data: jobs, ts: Date.now() }
        return res.json(jobs)
      }
    } catch (err) {
      console.warn(`[intent/jobs] ${url} → ${err.message}`)
    }
  }

  // Todas las fuentes fallaron o devolvieron vacío — responder array vacío sin error
  console.warn('[intent/jobs] Ninguna fuente disponible para:', estado)
  cache[key] = { data: [], ts: Date.now() }
  res.json([])
})

// GET /api/intent/news?estado=Jalisco&limit=8
router.get('/news', async (req, res) => {
  const estado = (req.query.estado || '').trim()
  const limit  = Math.min(parseInt(req.query.limit, 10) || 8, 20)
  const key    = cacheKey('news', estado)

  if (isFresh(cache[key])) {
    return res.json(cache[key].data)
  }

  try {
    const query = `seguridad+privada+robo+${encodeURIComponent(estado)}`
    const url   = `https://news.google.com/rss/search?q=${query}&hl=es-419&gl=MX&ceid=MX:es`
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 12000,
    })

    const $ = cheerio.load(response.data, { xmlMode: true })
    const news = []

    $('item').each((_, el) => {
      const titulo   = $(el).find('title').first().text().trim()
      const link     = $(el).find('link').first().text().trim() || $(el).find('guid').first().text().trim()
      const pubDate  = $(el).find('pubDate').first().text().trim()
      const source   = $(el).find('source').first().text().trim()
      const rawSnip  = $(el).find('description').first().text().trim()

      const snippet = rawSnip
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180)

      news.push({ titulo, url: link, fuente: source, fecha: pubDate, snippet })
    })

    const result = news.slice(0, limit)
    cache[key] = { data: result, ts: Date.now() }
    res.json(result)
  } catch (err) {
    console.error('[intent/news]', err.message)
    res.status(502).json({ error: err.message || 'No se pudieron obtener noticias' })
  }
})

module.exports = router
