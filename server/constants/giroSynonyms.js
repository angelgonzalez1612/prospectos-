// Por cada giro, lista de términos de búsqueda que se ejecutan en paralelo.
// El primero es el término principal; los siguientes son sinónimos.
const GIRO_SYNONYMS = {
  'parques industriales': [
    'parque industrial',
    'zona industrial',
    'parque logístico',
    'nave industrial',
  ],
  'plazas comerciales': [
    'plaza comercial',
    'centro comercial',
    'mall',
    'galería comercial',
  ],
  'fraccionamientos residenciales': [
    'fraccionamiento residencial',
    'residencial privada',
    'condominio residencial',
    'conjunto habitacional privado',
  ],
  'hospitales privados': [
    'hospital privado',
    'clínica privada',
    'sanatorio privado',
    'centro médico privado',
  ],
  'colegios y universidades': [
    'colegio privado',
    'universidad privada',
    'escuela privada',
    'instituto educativo privado',
  ],
  'edificios corporativos': [
    'edificio corporativo',
    'torre de oficinas',
    'parque empresarial',
    'oficinas corporativas',
  ],
  'hoteles': [
    'hotel',
    'hotel boutique',
    'centro de convenciones',
    'gran hotel',
  ],
  'bodegas y almacenes': [
    'bodega',
    'almacén',
    'centro de distribución',
    'nave logística',
  ],
  'bancos': [
    'banco',
    'sucursal bancaria',
    'institución financiera',
    'casa de bolsa',
  ],
  'dependencias de gobierno': [
    'palacio municipal',
    'dependencia federal',
    'oficina gubernamental',
    'secretaría de gobierno',
  ],
}

function getSearchTerms(giro) {
  const key = giro.toLowerCase().trim()
  return GIRO_SYNONYMS[key] ?? [giro]
}

module.exports = { getSearchTerms }
