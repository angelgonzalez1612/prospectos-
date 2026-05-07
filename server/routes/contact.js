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

const CONTACT_PATHS = [
  '', '/contacto', '/contact', '/nosotros', '/about',
  '/contactanos', '/equipo', '/quienes-somos', '/empresa',
  '/team', '/staff', '/personal', '/directorio',
]

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi

const ROLE_KEYWORDS = [
  'gerente general', 'gerente comercial', 'gerente de ventas', 'gerente',
  'director general', 'director comercial', 'director de ventas', 'director',
  'encargado general', 'encargado', 'encargada', 'propietario', 'propietaria',
  'administrador general', 'administrador', 'administradora', 'responsable',
  'representante legal', 'representante comercial', 'representante',
  'manager', 'ceo', 'dueño', 'dueña', 'titular', 'presidente', 'vicepresidente',
  'coordinador de ventas', 'coordinador', 'coordinadora',
  'jefe de ventas', 'jefe de operaciones', 'jefe', 'jefa',
  'ejecutivo de ventas', 'ejecutivo de cuenta', 'ejecutivo', 'ejecutiva',
  'asesor comercial', 'asesor', 'asesora',
  'socio', 'socia', 'fundador', 'fundadora',
]

// Captures group 1 = role, group 2 = name
const ROLE_CAPTURE_RE = new RegExp(
  '(' + ROLE_KEYWORDS.join('|') + ')' +
  '\\s*:?\\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,}(?:\\s+(?:de|del|la|el|los|las)?\\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,}){1,4})',
  'gi'
)

const TITLE_NAME_RE = /(?:Ing\.|Lic\.|Dr\.|Dra\.|Mtro\.|Mtra\.|Arq\.|C\.P\.)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})/g

const GENERIC_EMAIL_LOCALS = /^(info|contact|ventas|sales|admin|hola|hello|support|ayuda|gerencia|direccion|general|oficina|recepcion|atencion|contacto|correo|no-reply|noreply)$/i

function normalizeUrl(raw) {
  let url = raw.trim()
  if (!url.match(/^https?:\/\//i)) url = 'https://' + url
  const { hostname } = new URL(url)
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return null
  return url.replace(/\/+$/, '')
}

function capitalize(str) {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function nameFromEmail(email) {
  if (!email) return null
  const local = email.split('@')[0]
  if (GENERIC_EMAIL_LOCALS.test(local)) return null
  const parts = local.split(/[._-]/).filter(p => p.length > 1 && /^[a-z]/i.test(p))
  if (parts.length < 2) return null
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
}

function isLikelyName(text) {
  return text &&
    text.length > 3 &&
    text.length < 65 &&
    /^[A-ZÁÉÍÓÚÑA-Z]/.test(text) &&
    !/^\d/.test(text) &&
    !/[<>{}/\\@]/.test(text)
}

function extract($) {
  $('script, style, nav, footer').remove()

  let nombre = null
  let cargo  = null
  const emails = new Set()

  // ── 1. mailto links ──────────────────────────────────────────────────────────
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const mail = href.replace('mailto:', '').split('?')[0].trim().toLowerCase()
    if (mail && !mail.includes(' ') && mail.includes('@')) emails.add(mail)

    if (!nombre) {
      const text = $(el).text().trim()
      if (text && !text.includes('@') && isLikelyName(text)) nombre = text
    }
  })

  // ── 2. Body text emails ─────────────────────────────────────────────────────
  const bodyText = $('body').text().replace(/\s+/g, ' ')
  ;(bodyText.match(EMAIL_RE) || [])
    .filter(e => !e.match(/\.(png|jpg|gif|svg|css|js)$/i) && !e.includes('example') && !e.startsWith('user@'))
    .forEach(e => emails.add(e.toLowerCase()))

  // ── 3. Schema.org Person ────────────────────────────────────────────────────
  $('[itemtype*="Person"]').each((_, el) => {
    if (nombre && cargo) return
    const $el = $(el)
    const name  = $el.find('[itemprop="name"]').first().text().trim()
    const title = $el.find('[itemprop="jobTitle"]').first().text().trim()
    if (!nombre && isLikelyName(name)) nombre = name
    if (!cargo  && title)               cargo  = title
  })

  // ── 4. hCard / vCard (.fn) ──────────────────────────────────────────────────
  if (!nombre) {
    const fn = $('.vcard .fn, .hcard .fn, [class*="vcard"] .fn, [class*="hcard"] .fn').first().text().trim()
    if (isLikelyName(fn)) nombre = fn
  }
  if (!nombre) {
    const fn = $('.fn').first().text().trim()
    if (isLikelyName(fn)) nombre = fn
  }

  // ── 5. <meta name="author"> ─────────────────────────────────────────────────
  if (!nombre) {
    const author = ($('meta[name="author"]').attr('content') || '').trim()
    if (isLikelyName(author) && !/\b(s\.?a\.?|llc|inc|s\.?r\.?l|srl|corp|empresa)\b/i.test(author)) {
      nombre = author
    }
  }

  // ── 6. JSON-LD ───────────────────────────────────────────────────────────────
  $('script[type="application/ld+json"]').each((_, el) => {
    if (nombre && cargo) return
    try {
      const walk = (obj) => {
        if (!obj || typeof obj !== 'object') return
        if (Array.isArray(obj)) { obj.forEach(walk); return }
        if (obj['@type'] === 'Person') {
          if (!nombre && obj.name)     nombre = obj.name
          if (!cargo  && obj.jobTitle) cargo  = obj.jobTitle
          return
        }
        if (obj['@type'] === 'Organization') {
          if (obj.contactPoint) {
            const cp = Array.isArray(obj.contactPoint) ? obj.contactPoint[0] : obj.contactPoint
            if (!nombre && cp?.name) nombre = cp.name
          }
          if (obj.employee) {
            const emp = Array.isArray(obj.employee) ? obj.employee[0] : obj.employee
            if (!nombre && emp?.name)     nombre = emp.name
            if (!cargo  && emp?.jobTitle) cargo  = emp.jobTitle
          }
        }
        Object.values(obj).forEach(v => typeof v === 'object' && walk(v))
      }
      walk(JSON.parse($(el).html()))
    } catch { /* ignore */ }
  })

  // ── 7. DOM label proximity (<dt>/<th> role → <dd>/<td>) ─────────────────────
  if (!nombre) {
    const roleRx = new RegExp(ROLE_KEYWORDS.join('|'), 'i')
    $('dt, th').each((_, el) => {
      if (nombre) return
      const label = $(el).text().trim()
      if (!roleRx.test(label)) return
      const val = $(el).next('dd, td').text().trim()
      if (isLikelyName(val)) {
        nombre = val
        if (!cargo) cargo = label.replace(/:$/, '').trim()
        cargo = cargo ? capitalize(cargo) : cargo
      }
    })
  }

  // ── 8. Team / staff card containers ─────────────────────────────────────────
  if (!nombre) {
    const roleRx = new RegExp(ROLE_KEYWORDS.join('|'), 'i')
    const cardSel = [
      '[class*="team"]', '[class*="equipo"]', '[class*="staff"]',
      '[class*="member"]', '[class*="miembro"]', '[class*="persona"]',
      'figure', '[class*="card"]',
    ].join(', ')

    $(cardSel).each((_, container) => {
      if (nombre) return
      const $c = $(container)
      const text = $c.text()
      if (!roleRx.test(text)) return

      const heading = $c.find('h1,h2,h3,h4,h5,figcaption,strong,b,[class*="name"],[class*="nombre"]')
        .first().text().trim()

      // Find role text in a non-heading element inside the card
      let roleText = null
      $c.find('[class*="title"],[class*="cargo"],[class*="role"],[class*="position"],[class*="puesto"],[class*="subtitle"],p,span').each((_, el) => {
        if (roleText) return
        const t = $(el).text().trim()
        if (t && t !== heading && roleRx.test(t) && t.length < 80) roleText = t
      })

      if (isLikelyName(heading)) {
        nombre = heading
        if (!cargo && roleText) cargo = roleText.slice(0, 60)
      }
    })
  }

  // ── 9. Role keyword + name in body text ──────────────────────────────────────
  if (!nombre || !cargo) {
    const reCopy = new RegExp(ROLE_CAPTURE_RE.source, 'gi')
    let m
    while ((m = reCopy.exec(bodyText)) !== null) {
      if (!nombre) nombre = m[2].trim()
      if (!cargo)  cargo  = capitalize(m[1].trim())
    }
  }

  // ── 10. Professional title prefixes (Ing., Lic., Dr.) ───────────────────────
  if (!nombre) {
    const titleRe = new RegExp(TITLE_NAME_RE.source, 'g')
    const m = titleRe.exec(bodyText)
    if (m) nombre = m[1].trim()
  }

  return {
    nombre,
    cargo:  cargo ? cargo.charAt(0).toUpperCase() + cargo.slice(1) : null,
    email:  [...emails][0] || null,
  }
}

// GET /api/contact?url=https://empresa.com
router.get('/', async (req, res) => {
  const rawUrl = (req.query.url || '').trim()
  if (!rawUrl) return res.json({ nombre: null, cargo: null, email: null })

  let base
  try { base = normalizeUrl(rawUrl) } catch { return res.json({ nombre: null, cargo: null, email: null }) }
  if (!base) return res.json({ nombre: null, cargo: null, email: null })

  const cacheKey = base.toLowerCase()
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    return res.json(cache[cacheKey].data)
  }

  const merged = { nombre: null, cargo: null, email: null }

  for (const path of CONTACT_PATHS) {
    if (merged.nombre && merged.cargo && merged.email) break
    try {
      const resp = await axios.get(base + path, {
        headers: HEADERS,
        timeout: 8000,
        maxRedirects: 4,
        responseType: 'text',
      })
      if (typeof resp.data !== 'string') continue
      const found = extract(cheerio.load(resp.data))
      if (!merged.nombre && found.nombre) merged.nombre = found.nombre
      if (!merged.cargo  && found.cargo)  merged.cargo  = found.cargo
      if (!merged.email  && found.email)  merged.email  = found.email
    } catch { /* try next path */ }
  }

  // Last resort: guess name from email local part
  if (!merged.nombre && merged.email) {
    merged.nombre = nameFromEmail(merged.email)
  }

  cache[cacheKey] = { data: merged, ts: Date.now() }
  res.json(merged)
})

// Patrón inverso: "Juan García, gerente" (frecuente en prensa y directorios)
const REVERSE_CAPTURE_RE = new RegExp(
  '([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,}(?:\\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{1,}){1,3})' +
  '\\s*,\\s*' +
  '(' + ROLE_KEYWORDS.join('|') + ')',
  'gi'
)

const BING_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
}

function extractContacts(text, href, seenNames, contacts, maxContacts = 6) {
  const fuente = (() => { try { return new URL(href).hostname.replace(/^www\./, '') } catch { return '' } })()

  function push(nombre, cargo) {
    const key = nombre.toLowerCase()
    if (!seenNames.has(key) && nombre.length > 3 && nombre.length < 65) {
      seenNames.add(key)
      contacts.push({ nombre, cargo, fuente, url: href })
    }
  }

  if (contacts.length < maxContacts) {
    const reF = new RegExp(ROLE_CAPTURE_RE.source, 'gi')
    let m
    while ((m = reF.exec(text)) !== null && contacts.length < maxContacts) {
      push(m[2].trim(), capitalize(m[1].trim()))
    }
  }
  if (contacts.length < maxContacts) {
    const reR = new RegExp(REVERSE_CAPTURE_RE.source, 'gi')
    let m
    while ((m = reR.exec(text)) !== null && contacts.length < maxContacts) {
      push(m[1].trim(), capitalize(m[2].trim()))
    }
  }
}

// ── Búsqueda Bing: extrae contactos de snippets + links manuales ─────────────
// GET /api/contact/web?name=Empresa+ABC
router.get('/web', async (req, res) => {
  const companyName = (req.query.name || '').trim().slice(0, 120)
  if (!companyName) return res.json({ contacts: [], links: [] })

  const enc = encodeURIComponent

  const cacheKey = 'web2:' + companyName.toLowerCase()
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 60 * 60 * 1000) {
    return res.json(cache[cacheKey].data)
  }

  // ── A) Bing News — artículos mencionan directivos por nombre y cargo ────────
  const newsQueries = [
    `"${companyName}" gerente OR director OR propietario OR representante`,
    `"${companyName}" representante legal`,
  ]

  const seenNames = new Set()
  const contacts  = []

  for (const q of newsQueries) {
    if (contacts.length >= 6) break
    try {
      const url  = `https://www.bing.com/news/search?q=${enc(q)}&mkt=es-MX&cc=MX&setlang=es&count=10&format=json`
      const resp = await axios.get(url, { headers: BING_HEADERS, timeout: 10000 })
      if (typeof resp.data !== 'string') continue

      const $ = cheerio.load(resp.data)

      // Selectores de Bing News
      $('div.news-card, div[class*="newsitem"], article, .t_t').each((_, el) => {
        if (contacts.length >= 6) return
        const $el     = $(el)
        const title   = $el.find('a, h3, h4, [class*="title"]').first().text().trim()
        const snippet = $el.find('p, [class*="snippet"], [class*="desc"], [class*="abstract"]').first().text().trim()
        const href    = $el.find('a[href]').first().attr('href') || ''

        const combined = title + ' ' + snippet
        const hasSpanish = /[áéíóúñüÁÉÍÓÚÑÜ]|\b(de|en|con|por|para|del|los|las|que|es|su)\b/i.test(combined)
        if (!hasSpanish || combined.length < 20) return

        extractContacts(combined, href, seenNames, contacts)
      })
    } catch (err) {
      console.error('[web/news]', err.message)
    }
  }


  // ── B) Links manuales como respaldo ───────────────────────────────────────
  const links = [
    {
      title: 'Google — gerente / director / representante',
      url: `https://www.google.com/search?q=${enc(`"${companyName}" (gerente OR director OR propietario OR representante) México contacto`)}&hl=es-419`,
    },
    {
      title: 'Google — contacto directo',
      url: `https://www.google.com/search?q=${enc(`"${companyName}" contacto teléfono email México`)}&hl=es-419`,
    },
    {
      title: 'LinkedIn — empleados clave',
      url: `https://www.linkedin.com/search/results/people/?keywords=${enc(companyName + ' gerente OR director OR representante')}`,
    },
    {
      title: 'Bing Noticias — prensa local',
      url: `https://www.bing.com/news/search?q=${enc(`"${companyName}" director OR gerente OR representante México`)}&mkt=es-MX`,
    },
  ]

  const data = { contacts, links }
  cache[cacheKey] = { data, ts: Date.now() }
  res.json(data)
})

// ── LinkedIn search via Bing HTML ───────────────────────────────────────────
// GET /api/contact/linkedin?name=Empresa+ABC
router.get('/linkedin', async (req, res) => {
  const companyName = (req.query.name || '').trim().slice(0, 120)
  if (!companyName) return res.json({ results: [] })

  const cacheKey = 'li:' + companyName.toLowerCase()
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 60 * 60 * 1000) {
    return res.json(cache[cacheKey].data)
  }

  // Bing es más tolerante que Google/DDG para scraping de este tipo
  const queries = [
    `site:linkedin.com/in "${companyName}"`,
    `"${companyName}" site:linkedin.com/in gerente OR director OR CEO OR representante OR administrador OR propietario`,
    `"${companyName}" linkedin.com gerente OR director OR representante`,
  ]

  const seen    = new Set()
  const results = []

  const BING_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  }

  for (const q of queries) {
    if (results.length >= 5) break
    try {
      const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}&mkt=es-MX&count=10&setlang=es`
      const resp = await axios.get(url, { headers: BING_HEADERS, timeout: 10000 })
      if (typeof resp.data !== 'string') continue

      const $ = cheerio.load(resp.data)

      // Bing result structure: li.b_algo h2 a → direct href (not redirect)
      $('li.b_algo h2 a').each((_, el) => {
        if (results.length >= 5) return

        // Bing devuelve el href directo (no redirect)
        const href = $(el).attr('href') || ''
        if (!href.includes('linkedin.com/in/')) return
        if (seen.has(href)) return
        seen.add(href)

        const title = $(el).text().trim()

        // Formato LinkedIn: "Nombre - Cargo | Empresa | LinkedIn"
        //                o: "Nombre - Cargo - Empresa | LinkedIn"
        const clean  = title.replace(/\s*\|\s*LinkedIn\s*$/i, '').replace(/\s*-\s*LinkedIn\s*$/i, '')
        const parts  = clean.split(/\s*[-–|]\s*/)
        const nombre = parts[0]?.trim()
        const cargoRaw = parts.slice(1).find(p => p.length > 1 && p.length < 80 && !/linkedin/i.test(p))?.trim()

        if (!nombre || nombre.length < 3 || nombre.length > 65) return
        if (/^\d|[<>{}/\\@]/.test(nombre)) return

        results.push({
          nombre,
          cargo: cargoRaw || null,
          url:   href,
        })
      })
    } catch (err) {
      console.error('[linkedin search]', err.message)
    }
  }

  const data = { results }
  cache[cacheKey] = { data, ts: Date.now() }
  res.json(data)
})

module.exports = router
