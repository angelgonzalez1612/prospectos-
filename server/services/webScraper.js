const axios   = require('axios')
const cheerio = require('cheerio')

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

const BLOCKED_EMAIL_PARTS = [
  'noreply', 'no-reply', 'example', 'sentry', 'wixpress',
  'schema.org', '@2x', '.png', '.jpg', '.gif', '.svg',
]

const CONTACT_KEYWORDS = [
  'contacto', 'contact', 'contáctanos', 'contactanos',
  'ubicacion', 'ubicación', 'localizacion', 'localización', 'informacion',
]

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── Helpers ────────────────────────────────────────────────────────────────────

function isValidEmail(e) {
  if (!e || !e.includes('@') || e.length < 6) return false
  const domain = (e.split('@')[1] || '').toLowerCase()
  return (
    domain.includes('.') &&
    !BLOCKED_EMAIL_PARTS.some((b) => e.toLowerCase().includes(b))
  )
}

function extractData(html, $) {
  const out = { emails: [], whatsapp: null, facebook: null, instagram: null, linkedin: null }

  // Emails por mailto:
  $('a[href^="mailto:"]').each((_, el) => {
    const raw = ($(el).attr('href') || '').replace('mailto:', '').split('?')[0].trim().toLowerCase()
    if (isValidEmail(raw) && !out.emails.includes(raw)) out.emails.push(raw)
  })

  // Emails en texto
  const bodyText = $('body').text()
  const textMatches = (bodyText.match(EMAIL_REGEX) || []).map((e) => e.toLowerCase())
  textMatches.forEach((e) => {
    if (isValidEmail(e) && !out.emails.includes(e)) out.emails.push(e)
  })

  // Social / WhatsApp en links
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').toLowerCase()
    if ((href.includes('wa.me') || href.includes('api.whatsapp')) && !out.whatsapp) {
      const m = href.match(/wa\.me\/?(\d+)/)
      if (m) out.whatsapp = `+${m[1]}`
    }
    if (href.includes('facebook.com/') && !href.includes('sharer') && !out.facebook)
      out.facebook = $(el).attr('href')
    if (href.includes('instagram.com/') && !out.instagram)
      out.instagram = $(el).attr('href')
    if (href.includes('linkedin.com/') && !out.linkedin)
      out.linkedin = $(el).attr('href')
  })

  return out
}

async function fetchHtml(url, timeout = 6000) {
  const { data } = await axios.get(url, {
    timeout,
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    maxRedirects: 4,
    validateStatus: (s) => s < 400,
  })
  return typeof data === 'string' ? data : ''
}

function resolveUrl(href, base) {
  try {
    return href.startsWith('http') ? href : new URL(href, base).href
  } catch {
    return null
  }
}

async function findContactUrl($, baseUrl) {
  let found = null
  $('a[href]').each((_, el) => {
    if (found) return
    const href  = ($(el).attr('href') || '').toLowerCase()
    const text  = ($(el).text() || '').toLowerCase()
    const match = CONTACT_KEYWORDS.some((k) => href.includes(k) || text.includes(k))
    if (match) found = resolveUrl($(el).attr('href'), baseUrl)
  })
  return found
}

// ── Scraper principal ─────────────────────────────────────────────────────────

async function scrapeWebsite(rawUrl) {
  const empty = { email: null, emailsExtra: [], whatsapp: null, facebook: null, instagram: null, linkedin: null }

  let url = rawUrl
  if (!url.startsWith('http')) url = `https://${url}`

  try {
    const html = await fetchHtml(url)
    const $    = cheerio.load(html)
    const data = extractData(html, $)

    // Si no encontramos emails en el home, intentar la página de contacto
    if (data.emails.length === 0) {
      const contactUrl = await findContactUrl($, url)
      if (contactUrl && contactUrl !== url) {
        try {
          const html2 = await fetchHtml(contactUrl, 5000)
          const $2    = cheerio.load(html2)
          const d2    = extractData(html2, $2)
          data.emails.push(...d2.emails)
          data.whatsapp  = data.whatsapp  || d2.whatsapp
          data.facebook  = data.facebook  || d2.facebook
          data.instagram = data.instagram || d2.instagram
          data.linkedin  = data.linkedin  || d2.linkedin
        } catch {}
      }
    }

    return {
      email:       data.emails[0]        || null,
      emailsExtra: data.emails.slice(1, 3),
      whatsapp:    data.whatsapp,
      facebook:    data.facebook,
      instagram:   data.instagram,
      linkedin:    data.linkedin,
    }
  } catch {
    return empty
  }
}

module.exports = { scrapeWebsite }
