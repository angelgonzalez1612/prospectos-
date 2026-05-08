# Prospect Finder

Herramienta B2B para encontrar prospectos de seguridad privada en México usando Google Places API. Busca negocios por giro y zona geográfica (estado, municipio, radio o dirección).

---

## Stack

- **Frontend:** React + Vite → desplegado en Render (Static Site)
- **Backend:** Node.js + Express → desplegado en Render (Web Service)
- **APIs:** Google Places API, OpenStreetMap / Overpass (límites municipales)

---

## Desarrollo local

### Requisitos

- Node.js 18+
- Cuenta de Google Cloud con Places API habilitada

### Instalación

```bash
# Clonar el repo
git clone https://github.com/angelgonzalez1612/prospectos-.git
cd prospectos-

# Instalar dependencias del frontend
npm install

# Instalar dependencias del backend
cd server
npm install
cd ..
```

### Variables de entorno

Crea un archivo `server/.env`:

```env
GOOGLE_PLACES_API_KEY=tu_api_key_aqui
PORT=3001
```

### Levantar en local

```bash
# Terminal 1 — Backend
cd server
node index.js

# Terminal 2 — Frontend
npm run dev
```

El frontend corre en `http://localhost:5173` y el backend en `http://localhost:3001`.

---

## Deploy a producción (Render)

El proyecto tiene dos servicios en [Render](https://render.com): un **Web Service** (backend) y un **Static Site** (frontend). El deploy se dispara automáticamente al hacer push a la rama `main`.

### Flujo normal

```bash
# 1. Asegúrate de estar en main y tener todo commiteado
git status

# 2. Commit de tus cambios
git add <archivos>
git commit -m "feat: descripción del cambio"

# 3. Push — esto dispara el auto-deploy en Render
git push origin main
```

Render detecta el push y despliega ambos servicios automáticamente (backend primero, luego frontend). El proceso tarda ~2-4 minutos.

### Variables de entorno en Render

El backend necesita tener configurada la variable en el dashboard de Render:

| Variable | Valor |
|---|---|
| `GOOGLE_PLACES_API_KEY` | Tu API key de Google Cloud |

Ve a **Render → Web Service → Environment** para agregarla o actualizarla. **Nunca subas el `.env` al repo.**

### Build commands configurados en Render

**Backend (Web Service)**
- Build command: `npm install`
- Start command: `node index.js`
- Root directory: `server`

**Frontend (Static Site)**
- Build command: `npm install && npm run build`
- Publish directory: `dist`

### Verificar el deploy

1. Entra a [dashboard.render.com](https://dashboard.render.com)
2. Revisa que ambos servicios estén en estado **Live**
3. Si alguno falla, revisa los logs en la pestaña **Logs** del servicio

### Rollback

Si el deploy rompe algo en producción:

```bash
# Ver commits recientes
git log --oneline -10

# Revertir al commit anterior (reemplaza <hash> con el commit bueno)
git revert <hash>
git push origin main
```

Esto crea un nuevo commit que deshace los cambios y dispara un nuevo deploy limpio.

---

## Estructura del proyecto

```
prospect-finder/
├── src/                        # Frontend React
│   ├── components/
│   │   ├── MapView/            # Mapa principal + overlay de carga
│   │   ├── FilterPanel/        # Panel de filtros (giro, modo, zona)
│   │   ├── ProspectsPanel/     # Lista lateral de resultados
│   │   ├── ProfileEditorModal/ # Modal para personalizar perfiles
│   │   ├── TrendsWidget/       # Widget de tendencias
│   │   ├── DemandBar/          # Barra de demanda por zona
│   │   └── AddressSearch/      # Autocomplete de dirección
│   ├── constants/
│   │   ├── giros.js            # Catálogo de giros de negocio
│   │   └── profiles.js         # Perfiles predefinidos de cliente
│   └── hooks/
│       └── useProfiles.js      # Sobreescrituras de perfiles en localStorage
├── server/                     # Backend Express
│   ├── index.js                # Entry point + rutas
│   ├── services/
│   │   └── placesService.js    # Lógica de búsqueda en Google Places
│   └── constants/
│       └── giroSynonyms.js     # Sinónimos por giro para ampliar búsquedas
└── README.md
```
