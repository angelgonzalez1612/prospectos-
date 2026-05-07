const express = require('express')
const ExcelJS = require('exceljs')
const router  = express.Router()

function calcScore(p) {
  let s = 0
  if (p.telefono) s += 10; if (p.email) s += 10; if (p.sitioWeb) s += 10; if (p.whatsapp) s += 10
  const rev = p.reviewCount || 0
  if      (rev > 200) s += 25; else if (rev > 100) s += 20; else if (rev > 50) s += 15
  else if (rev > 20)  s += 10; else if (rev > 5)   s += 5
  const rat = p.rating || 0
  if      (rat >= 4.5) s += 20; else if (rat >= 4.0) s += 15
  else if (rat >= 3.5) s += 10; else if (rat >= 3.0) s += 5
  if (p.facebook) s += 5; if (p.instagram) s += 5; if (p.linkedin) s += 5
  return Math.min(s, 100)
}

function scoreLabel(s) {
  if (s >= 80) return 'Alto'; if (s >= 60) return 'Medio-alto'
  if (s >= 40) return 'Medio'; if (s >= 20) return 'Bajo'; return 'Mínimo'
}

const SCORE_COLORS = {
  'Alto':       { fg: '166534', bg: 'DCFCE7' },
  'Medio-alto': { fg: '3F6212', bg: 'ECFCCB' },
  'Medio':      { fg: '9A3412', bg: 'FFEDD5' },
  'Bajo':       { fg: '991B1B', bg: 'FEF2F2' },
  'Mínimo':     { fg: '6B7280', bg: 'F3F4F6' },
}

const PURPLE = '0D9488'
const PURPLE_LIGHT = 'F0FDFA'
const GREEN  = '16A34A'
const GREEN_BG = 'DCFCE7'
const ORANGE = 'F97316'
const ORANGE_BG = 'FEF9C3'
const RED    = 'DC2626'
const RED_BG = 'FEF2F2'
const GRAY_ROW = 'F9FAFB'

const COLUMNS = [
  { header: 'Nombre',             key: 'nombre',          width: 36 },
  { header: 'Dirección',          key: 'direccion',        width: 42 },
  { header: 'Teléfono',           key: 'telefono',         width: 18 },
  { header: 'Email',              key: 'email',            width: 32 },
  { header: 'Sitio Web',          key: 'sitioWeb',         width: 30 },
  { header: 'WhatsApp',           key: 'whatsapp',         width: 18 },
  { header: 'Facebook',           key: 'facebook',         width: 30 },
  { header: 'Instagram',          key: 'instagram',        width: 30 },
  { header: 'LinkedIn',           key: 'linkedin',         width: 30 },
  { header: 'Calificación',       key: 'rating',           width: 14 },
  { header: 'Reseñas',            key: 'reviewCount',      width: 12 },
  { header: 'Calidad',            key: 'calidad',          width: 16 },
  { header: 'Potencial',          key: 'potencial',        width: 16 },
  { header: 'Contacto (Nombre)',  key: 'contactoNombre',   width: 28 },
  { header: 'Contacto (Email)',   key: 'contactoEmail',    width: 32 },
]

function getQuality(p) {
  const pts = [p.telefono, p.email, p.sitioWeb, p.whatsapp].filter(Boolean).length
  if (pts >= 3) return { label: 'Completo',  fgColor: GREEN,  bgColor: GREEN_BG }
  if (pts >= 1) return { label: 'Parcial',   fgColor: ORANGE, bgColor: ORANGE_BG }
  return               { label: 'Básico',    fgColor: RED,    bgColor: RED_BG }
}

function applyHeaderStyle(cell) {
  cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PURPLE } }
  cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
  cell.border = {
    bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
  }
}

router.post('/excel', async (req, res) => {
  const { prospects = [], meta = {} } = req.body

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Prospect Finder – Seguridad Privada'
  wb.created = new Date()

  const ws = wb.addWorksheet('Prospectos', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', ySplit: 4 }],
  })

  ws.columns = COLUMNS

  // ── Fila 1: Título ─────────────────────────────────────────────────────────
  ws.mergeCells('A1:O1')
  const titleCell = ws.getCell('A1')
  titleCell.value = '📋  REPORTE DE PROSPECTOS'
  titleCell.font  = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } }
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PURPLE } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(1).height = 36

  // ── Fila 2: Metadatos ───────────────────────────────────────────────────────
  ws.mergeCells('A2:O2')
  const metaCell = ws.getCell('A2')
  const parts = []
  if (meta.giro)  parts.push(`Giro: ${meta.giro}`)
  if (meta.zona)  parts.push(`Zona: ${meta.zona}`)
  parts.push(`Total: ${prospects.length}`)
  parts.push(`Generado: ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}`)
  metaCell.value = parts.join('   |   ')
  metaCell.font  = { italic: true, size: 10, color: { argb: 'FF' + PURPLE } }
  metaCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PURPLE_LIGHT } }
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' }
  ws.getRow(2).height = 22

  // ── Fila 3: Spacer ──────────────────────────────────────────────────────────
  ws.mergeCells('A3:O3')
  ws.getCell('A3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
  ws.getRow(3).height = 6

  // ── Fila 4: Encabezados de columna ─────────────────────────────────────────
  const headerRow = ws.getRow(4)
  COLUMNS.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = col.header
    applyHeaderStyle(cell)
  })
  headerRow.height = 28

  ws.autoFilter = { from: 'A4', to: 'O4' }

  // ── Filas de datos ─────────────────────────────────────────────────────────
  prospects.forEach((p, i) => {
    const isEven   = i % 2 === 1
    const quality  = getQuality(p)
    const score    = calcScore(p)
    const potLabel = scoreLabel(score)
    const potColor = SCORE_COLORS[potLabel] || SCORE_COLORS['Mínimo']

    const row = ws.addRow({
      nombre:          p.nombre          || '',
      direccion:       p.direccion       || '',
      telefono:        p.telefono        || '',
      email:           p.email           || '',
      sitioWeb:        p.sitioWeb        || '',
      whatsapp:        p.whatsapp        || '',
      facebook:        p.facebook        || '',
      instagram:       p.instagram       || '',
      linkedin:        p.linkedin        || '',
      rating:          p.rating          ?? '',
      reviewCount:     p.reviewCount     ?? '',
      calidad:         quality.label,
      potencial:       `${potLabel} (${score}/100)`,
      contactoNombre:  p.contactoNombre  || '',
      contactoEmail:   p.contactoEmail   || '',
    })
    row.height = 20

    const bgFill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
    const rowBg  = isEven ? 'FF' + GRAY_ROW : 'FFFFFFFF'

    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.alignment = { vertical: 'middle', wrapText: false }
      cell.font      = { size: 10 }

      const colKey = COLUMNS[colNum - 1]?.key

      // Calidad column
      if (colKey === 'calidad') {
        cell.fill = bgFill('FF' + quality.bgColor)
        cell.font = { bold: true, size: 10, color: { argb: 'FF' + quality.fgColor } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      // Potencial column
      } else if (colKey === 'potencial') {
        cell.fill = bgFill('FF' + potColor.bg)
        cell.font = { bold: true, size: 10, color: { argb: 'FF' + potColor.fg } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      // Rating column
      } else if (colKey === 'rating') {
        cell.fill = bgFill(rowBg)
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (colKey === 'reviewCount') {
        cell.fill = bgFill(rowBg)
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      } else {
        cell.fill = bgFill(rowBg)
      }

      // Hyperlinks
      if (colKey === 'sitioWeb' && p.sitioWeb) {
        cell.value  = { text: p.sitioWeb.replace(/^https?:\/\//, '').split('/')[0], hyperlink: p.sitioWeb }
        cell.font   = { size: 10, color: { argb: 'FF0D9488' }, underline: true }
      }
      if (colKey === 'email' && p.email) {
        cell.value  = { text: p.email, hyperlink: `mailto:${p.email}` }
        cell.font   = { size: 10, color: { argb: 'FF0D9488' }, underline: true }
      }
      if (colKey === 'facebook' && p.facebook) {
        cell.value  = { text: 'Facebook', hyperlink: p.facebook }
        cell.font   = { size: 10, color: { argb: 'FF1877F2' }, underline: true }
      }
      if (colKey === 'instagram' && p.instagram) {
        cell.value  = { text: 'Instagram', hyperlink: p.instagram }
        cell.font   = { size: 10, color: { argb: 'FFE1306C' }, underline: true }
      }
      if (colKey === 'linkedin' && p.linkedin) {
        cell.value  = { text: 'LinkedIn', hyperlink: p.linkedin }
        cell.font   = { size: 10, color: { argb: 'FF0077B5' }, underline: true }
      }
      if (colKey === 'contactoNombre' && p.contactoNombre) {
        cell.fill = bgFill('FF' + GREEN_BG)
        cell.font = { bold: true, size: 10, color: { argb: 'FF' + GREEN } }
      }
      if (colKey === 'contactoEmail' && p.contactoEmail) {
        cell.value = { text: p.contactoEmail, hyperlink: `mailto:${p.contactoEmail}` }
        cell.fill  = bgFill('FF' + GREEN_BG)
        cell.font  = { size: 10, color: { argb: 'FF' + GREEN }, underline: true }
      }

      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right:  { style: 'thin', color: { argb: 'FFE5E7EB' } },
      }
    })

  })

  // ── Respuesta ───────────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="prospectos.xlsx"')
  await wb.xlsx.write(res)
  res.end()
})

module.exports = router
