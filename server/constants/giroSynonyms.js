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

  /* ── Restaurantes y bares ── */
  'restaurantes y bares': [
    'restaurante',
    'bar',
    'marisquería',
    'cervecería',
    'steakhouse',
    'antojitos',
    'fonda',
    'cadena de restaurantes',
  ],

  /* ── Salud complementaria ── */
  'clínicas y consultorios': [
    'clínica médica',
    'consultorio médico',
    'laboratorio clínico',
    'centro de salud privado',
    'clínica de especialidades',
    'consultorio dental',
    'clínica estética',
  ],
  'farmacias': [
    'farmacia',
    'farmacia de especialidades',
    'droguería',
    'cadena farmacéutica',
    'botica',
    'farmacia de turno',
  ],

  /* ── Despachos profesionales ── */
  'despachos profesionales': [
    'despacho de abogados',
    'notaría',
    'despacho contable',
    'firma de contadores',
    'despacho jurídico',
    'firma de auditoría',
    'despacho fiscal',
  ],

  /* ── Construcción / infraestructura ── */
  'constructoras': [
    'constructora',
    'empresa constructora',
    'inmobiliaria',
    'desarrolladora inmobiliaria',
    'empresa de construcción',
  ],
  'empresas constructoras': [
    'constructora',
    'empresa constructora',
    'desarrolladora inmobiliaria',
    'contratista de obra',
    'inmobiliaria',
    'empresa de construcción',
  ],

  /* ── Estadios y recintos culturales ── */
  'estadios y recintos': [
    'estadio',
    'arena',
    'auditorio',
    'teatro',
    'foro cultural',
    'recinto ferial',
    'centro de convenciones',
    'palenque',
  ],

  /* ── Aeropuertos y terminales ── */
  'aeropuertos y terminales': [
    'aeropuerto',
    'terminal aérea',
    'terminal de autobuses',
    'central camionera',
    'hangar',
    'aeródromo',
  ],

  /* ── Plantas y subestaciones ── */
  'plantas y subestaciones': [
    'planta eléctrica',
    'subestación eléctrica',
    'planta de tratamiento de agua',
    'planta de gas',
    'subestación de energía',
    'planta potabilizadora',
    'central eléctrica',
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
