import './CompanyInfoWindow.css'

function dataScore(company) {
  const pts = [company.telefono, company.email, company.sitioWeb, company.whatsapp].filter(Boolean).length
  if (pts >= 3) return { label: 'Prospecto completo', cls: 'iw__badge--full' }
  if (pts >= 1) return { label: 'Info parcial',       cls: 'iw__badge--partial' }
  return           { label: 'Info básica',             cls: 'iw__badge--minimal' }
}

export default function CompanyInfoWindow({ company }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    company.direccion || company.nombre
  )}`

  const waNumber  = company.whatsapp ? company.whatsapp.replace(/\D/g, '').slice(-10) : null
  const waUrl     = waNumber ? `https://wa.me/52${waNumber}` : null
  const emailHref = company.email
    ? `mailto:${company.email}?subject=Contacto%20Comercial%20-%20Seguridad%20Privada`
    : null

  const score = dataScore(company)

  return (
    <div className="iw">
      {/* Encabezado */}
      <div className="iw__header">
        <h3 className="iw__name">{company.nombre}</h3>
        <span className={`iw__badge ${score.cls}`}>{score.label}</span>
      </div>

      {/* Datos de contacto */}
      <div className="iw__rows">
        {company.direccion && (
          <div className="iw__row">
            <span className="iw__icon">📍</span>
            <span>{company.direccion}</span>
          </div>
        )}
        {company.telefono && (
          <div className="iw__row">
            <span className="iw__icon">📞</span>
            <a href={`tel:${company.telefono}`} className="iw__link">{company.telefono}</a>
          </div>
        )}
        {company.email && (
          <div className="iw__row">
            <span className="iw__icon">✉️</span>
            <a href={emailHref} className="iw__link">{company.email}</a>
          </div>
        )}
        {company.emailsExtra?.map((e, i) => (
          <div key={i} className="iw__row iw__row--extra">
            <span className="iw__icon">✉️</span>
            <a href={`mailto:${e}`} className="iw__link">{e}</a>
          </div>
        ))}
        {company.sitioWeb && (
          <div className="iw__row">
            <span className="iw__icon">🌐</span>
            <a href={company.sitioWeb} target="_blank" rel="noreferrer" className="iw__link">
              {company.sitioWeb.replace(/^https?:\/\//, '').split('/')[0]}
            </a>
          </div>
        )}
      </div>

      {/* Redes sociales */}
      {(company.facebook || company.instagram || company.linkedin) && (
        <div className="iw__social">
          {company.facebook && (
            <a href={company.facebook} target="_blank" rel="noreferrer" className="iw__social-btn iw__social-btn--fb" title="Facebook">f</a>
          )}
          {company.instagram && (
            <a href={company.instagram} target="_blank" rel="noreferrer" className="iw__social-btn iw__social-btn--ig" title="Instagram">ig</a>
          )}
          {company.linkedin && (
            <a href={company.linkedin} target="_blank" rel="noreferrer" className="iw__social-btn iw__social-btn--li" title="LinkedIn">in</a>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="iw__actions">
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="iw__btn">
          Ver en Maps
        </a>
        {waUrl && (
          <a href={waUrl} target="_blank" rel="noreferrer" className="iw__btn iw__btn--wa">
            WhatsApp
          </a>
        )}
        {emailHref && (
          <a href={emailHref} className="iw__btn iw__btn--email">
            Email
          </a>
        )}
      </div>
    </div>
  )
}
