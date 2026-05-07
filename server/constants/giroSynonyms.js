// Por cada giro, lista de términos de búsqueda en paralelo.
// El primero es el más específico; los siguientes amplían cobertura.
const GIRO_SYNONYMS = {
  /* ── Infraestructura industrial / logística ── */
  'parques industriales': [
    'parque industrial',
    'zona industrial',
    'corredor industrial',
    'nave industrial',
    'parque logístico',
    'parque manufacturero',
    'complejo industrial',
  ],
  'bodegas y almacenes': [
    'bodega',
    'almacén',
    'centro de distribución',
    'nave logística',
    'nave de almacenamiento',
    'bodega industrial',
  ],
  'fábricas y plantas': [
    'fábrica',
    'planta de producción',
    'planta industrial',
    'manufactura',
    'planta manufacturera',
    'ensambladora',
    'maquiladora',
  ],

  /* ── Inmuebles comerciales ── */
  'plazas comerciales': [
    'plaza comercial',
    'centro comercial',
    'mall',
    'galería comercial',
    'pasaje comercial',
    'local comercial',
    'tianguis comercial',
  ],
  'edificios corporativos': [
    'edificio corporativo',
    'torre de oficinas',
    'parque empresarial',
    'oficinas corporativas',
    'torre corporativa',
    'campus corporativo',
    'edificio de oficinas',
  ],
  'fraccionamientos residenciales': [
    'fraccionamiento residencial',
    'residencial privada',
    'condominio residencial',
    'privada residencial',
    'conjunto habitacional privado',
    'unidad habitacional',
    'residencial',
  ],

  /* ── Salud ── */
  'hospitales privados': [
    'hospital privado',
    'clínica privada',
    'sanatorio privado',
    'centro médico privado',
    'hospital',
    'clínica',
    'sanatorio',
  ],

  /* ── Educación ── */
  'colegios y universidades': [
    'colegio privado',
    'universidad privada',
    'escuela privada',
    'instituto educativo',
    'preparatoria privada',
    'bachillerato privado',
    'tecnológico privado',
    'jardín de niños privado',
  ],

  /* ── Hotelería ── */
  'hoteles': [
    'hotel',
    'hotel boutique',
    'gran hotel',
    'centro de convenciones',
    'resort',
    'posada',
    'hotel de negocios',
  ],

  /* ── Servicios financieros ── */
  'bancos': [
    'banco',
    'sucursal bancaria',
    'institución financiera',
    'casa de bolsa',
    'caja popular',
    'cooperativa de ahorro',
    'casa de cambio',
  ],

  /* ── Gobierno ── */
  'dependencias de gobierno': [
    'palacio municipal',
    'dependencia federal',
    'oficina gubernamental',
    'secretaría de gobierno',
    'presidencia municipal',
    'oficina de gobierno',
    'juzgado',
    'tribunal',
    'fiscalía',
  ],

  /* ── Combustibles ── */
  'gasolineras': [
    'gasolinera',
    'estación de servicio',
    'gasolinera PEMEX',
    'servicio de combustible',
  ],

  /* ── Automotriz ── */
  'concesionarias': [
    'agencia automotriz',
    'concesionaria',
    'agencia de autos',
    'distribuidora de vehículos',
    'agencia de automóviles',
  ],

  /* ── Centros de datos / tecnología ── */
  'centros de datos': [
    'centro de datos',
    'data center',
    'centro de procesamiento de datos',
    'colocation',
    'nube corporativa',
  ],

  /* ── Retail / alimentos ── */
  'supermercados': [
    'supermercado',
    'tienda de autoservicio',
    'abarrotes',
    'minisuper',
    'cadena de supermercados',
    'tienda de conveniencia',
  ],

  /* ── Entretenimiento / deporte ── */
  'clubes y gimnasios': [
    'club deportivo',
    'gimnasio',
    'club de golf',
    'campo de golf',
    'club de tenis',
    'spa',
    'centro deportivo',
  ],

  /* ── Joyería / valores ── */
  'joyerías': [
    'joyería',
    'joyería fina',
    'relojería',
    'platería',
    'tienda de lujo',
  ],

  /* ── Construcción / infraestructura ── */
  'constructoras': [
    'constructora',
    'empresa constructora',
    'inmobiliaria',
    'desarrolladora inmobiliaria',
    'empresa de construcción',
  ],

  /* ── Transporte ── */
  'transporte y logística': [
    'empresa de transporte',
    'transportista',
    'flota de transporte',
    'empresa logística',
    'paquetería',
    'mensajería',
  ],
}

function getSearchTerms(giro) {
  const key = giro.toLowerCase().trim()

  // Match exacto
  if (GIRO_SYNONYMS[key]) return GIRO_SYNONYMS[key]

  // Match parcial — sirve para giros personalizados que contengan palabras clave
  const matchKey = Object.keys(GIRO_SYNONYMS).find(k => key.includes(k) || k.includes(key))
  if (matchKey) return GIRO_SYNONYMS[matchKey]

  return [giro]
}

module.exports = { getSearchTerms, GIRO_SYNONYMS }
