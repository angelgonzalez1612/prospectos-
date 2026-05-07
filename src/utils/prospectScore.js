// Calcula un score de potencial de venta 0-100
export function calcScore(p) {
  let score = 0

  // Riqueza de contacto (40 pts)
  if (p.telefono) score += 10
  if (p.email)    score += 10
  if (p.sitioWeb) score += 10
  if (p.whatsapp) score += 10

  // Presencia en Google — reseñas (25 pts)
  const rev = p.reviewCount || 0
  if      (rev > 200) score += 25
  else if (rev > 100) score += 20
  else if (rev > 50)  score += 15
  else if (rev > 20)  score += 10
  else if (rev > 5)   score += 5

  // Presencia en Google — calificación (20 pts)
  const rat = p.rating || 0
  if      (rat >= 4.5) score += 20
  else if (rat >= 4.0) score += 15
  else if (rat >= 3.5) score += 10
  else if (rat >= 3.0) score += 5

  // Redes sociales (15 pts)
  if (p.facebook)  score += 5
  if (p.instagram) score += 5
  if (p.linkedin)  score += 5

  return Math.min(score, 100)
}

export function scoreLabel(score) {
  if (score >= 80) return 'Alto'
  if (score >= 60) return 'Medio-alto'
  if (score >= 40) return 'Medio'
  if (score >= 20) return 'Bajo'
  return 'Mínimo'
}

export function scoreColor(score) {
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#65a30d'
  if (score >= 40) return '#f97316'
  if (score >= 20) return '#ef4444'
  return '#9ca3af'
}

export function scoreStars(score) {
  const n = Math.round(score / 20)   // 0-5
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}
