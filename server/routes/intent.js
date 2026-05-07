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

// GET /api/intent/jobs?estado=Jalisco&limit=20
router.get('/jobs', async (req, res) => {
  const estado = (req.query.estado || '').trim()
  const limit  = Math.min(parseInt(req.query.limit, 10) || 20, 40)
  const key    = cacheKey('jobs', estado)

  if (isFresh(cache[key])) {
    return res.json(cache[key].data)
  }

  try {
    const url = `https://mx.indeed.com/rss?q=guardia+de+seguridad&l=${encodeURIComponent(estado)}&sort=date&limit=40`
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 12000,
    })

    const $ = cheerio.load(response.data, { xmlMode: true })
    const seen = new Set()
    const jobs = []

    $('item').each((_, el) => {
      const rawTitle   = $(el).find('title').first().text().trim()
      const link       = $(el).find('link').first().text().trim() || $(el).find('guid').first().text().trim()
      const pubDate    = $(el).find('pubDate').first().text().trim()
      const rawSnippet = $(el).find('description').first().text().trim()

      // Format: "Job Title - Company Name - City, State"
      const parts   = rawTitle.split(' - ')
      const puesto  = parts[0]?.trim() || rawTitle
      const empresa = parts[1]?.trim() || 'Empresa'
      const ciudad  = parts[2]?.trim() || estado

      const empresaKey = empresa.toLowerCase()
      if (seen.has(empresaKey)) return
      seen.add(empresaKey)

      // Strip HTML from snippet, max 180 chars
      const snippet = rawSnippet
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180)

      jobs.push({ empresa, puesto, ciudad, url: link, fecha: pubDate, snippet })
    })

    const result = jobs.slice(0, limit)
    cache[key] = { data: result, ts: Date.now() }
    res.json(result)
  } catch (err) {
    console.error('[intent/jobs]', err.message)
    res.status(502).json({ error: err.message || 'No se pudieron obtener vacantes' })
  }
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
