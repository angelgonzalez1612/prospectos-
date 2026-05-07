const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const express = require('express')
const cors = require('cors')
const prospectsRouter = require('./routes/prospects')
const zonesRouter = require('./routes/zones')
const exportRouter = require('./routes/export')
const trendsRouter  = require('./routes/trends')
const intentRouter  = require('./routes/intent')
const contactRouter = require('./routes/contact')

const app = express()
// PORT lo asigna Render en producción; en dev usa SERVER_PORT o 3001
const PORT = process.env.PORT || process.env.SERVER_PORT || 3001
const isProd = process.env.NODE_ENV === 'production'

// En dev permite cualquier puerto de localhost; en prod el frontend viene del mismo origen
app.use(cors({ origin: isProd ? false : /^http:\/\/localhost(:\d+)?$/ }))
app.use(express.json({ limit: '5mb' }))

app.use('/api/prospects', prospectsRouter)
app.use('/api/zones', zonesRouter)
app.use('/api/export', exportRouter)
app.use('/api/trends', trendsRouter)
app.use('/api/intent',  intentRouter)
app.use('/api/contact', contactRouter)

// En producción sirve el build de React y maneja el SPA routing
if (isProd) {
  const dist = path.join(__dirname, '../dist')
  app.use(express.static(dist))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)
})
