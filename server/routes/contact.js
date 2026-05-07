const express = require('express')
const axios   = require('axios')
const cheerio = require('cheerio')
const router  = express.Router()

const cache = {}
const TTL   = 30 * 60 * 1000

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
}

// Pages most likely to contain contact person info
const CONTACT_PATHS = ['', '/contacto', '/contact', '/nosotros', '/about', '/contactanos', '/equipo']

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi

// Spanish/English role keywords followed by a capitalized name
const ROLE_NAME_RE = new RegExp(
  '(?:gerente general|gerente|director general|director|encargado|propietario|' +
  'administrador|responsable|manager|ceo|dueño|titular|coordinador|jefe)' +
  '\\s*:?\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,}(?:\\s+(?:de|del|la|el\\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,}){1,3})',
  'gi'
)

function normalizeUrl(raw) {
  let url = raw.trim()
  if (!url.match(/^https?:\/\//i)) url = 'https://' + url
  const { hostname } = new URL(url)
  // Block private/local addresses
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return null
  return url.replace(/\/+$/, '')
}

function extract($) {
  $('script, style, nav, footer').remove()

  let nombre = null
  const emails = new Set()

  // Emails + person name from mailto links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const mail = href.replace('mailto:', '').split('?')[0].trim().toLowerCase()
    if (mail && !mail.includes(' ') && mail.includes('@')) emails.add(mail)

    // Link text is often the person's name
    const text = $(el).text().trim()
    if (!nombre && text && !text.includes('@') && /^[A-ZÁÉÍÓÚÑA-Z][a-z]/.test(text) && text.length < 60) {
      nombre = text
    }
  })

  // Emails from body text
  const bodyText = $('body').text().replace(/\s+/g, ' ')
  const textEmails = bodyText.match(EMAIL_RE) || []
  textEmails
    .filter(e => !e.match(/\.(png|jpg|gif|svg|css|js)$/i) && !e.includes('example') && !e.startsWith('user@'))
    .forEach(e => emails.add(e.toLowerCase()))

  // Names from role keyword patterns
  const reCopy = new RegExp(ROLE_NAME_RE.source, 'gi')
  let m
  while ((m = reCopy.exec(bodyText)) !== null) {
    if (!nombre) nombre = m[1].trim()
  }

  // Schema.org Person microdata
  $('[itemtype*="Person"]').each((_, el) => {
    if (nombre) return
    const name = $(el).find('[itemprop="name"]').first().text().trim()
    if (name) nombre = name
  })

  // JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    if (nombre) return
    try {
      const walk = (obj) => {
        if (!obj || typeof obj !== 'object') return
        if (obj['@type'] === 'Person' && obj.name) { nombre = obj.name; return }
        if (obj['@type'] === 'Organization' && obj.contactPoint) {
          const cp = Array.isArray(obj.contactPoint) ? obj.contactPoint[0] : obj.contactPoint
          if (cp?.name) nombre = cp.name
        }
        Object.values(obj).forEach(walk)
      }
      walk(JSON.parse($(el).html()))
    } catch { /* ignore malformed JSON-LD */ }
  })

  return { nombre, email: [...emails][0] || null }
}

// GET /api/contact?url=https://empresa.com
router.get('/', async (req, res) => {
  const rawUrl = (req.query.url || '').trim()
  if (!rawUrl) return res.json({ nombre: null, email: null })

  let base
  try { base = normalizeUrl(rawUrl) } catch { return res.json({ nombre: null, email: null }) }
  if (!base) return res.json({ nombre: null, email: null })

  const cacheKey = base.toLowerCase()
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    return res.json(cache[cacheKey].data)
  }

  let result = { nombre: null, email: null }

  for (const path of CONTACT_PATHS) {
    try {
      const resp = await axios.get(base + path, {
        headers: HEADERS,
        timeout: 8000,
        maxRedirects: 4,
        responseType: 'text',
      })
      if (typeof resp.data !== 'string') continue
      const found = extract(cheerio.load(resp.data))
      if (found.nombre || found.email) { result = found; break }
    } catch { /* try next path */ }
  }

  cache[cacheKey] = { data: result, ts: Date.now() }
  res.json(result)
})

module.exports = router
