/**
 * server.js
 * API REST (Express + PostgreSQL) para el sistema de usuarios Offline-First.
 *
 * Este backend ÚNICAMENTE responde JSON. El frontend (PWA/APK con
 * Capacitor) es un proyecto totalmente independiente que consume
 * esta API mediante fetch/axios.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const apiRoutes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// ------------------------------------------------------------------
// Middlewares
// ------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '2mb' })); // por si llegan muchos registros pendientes de una vez

// ------------------------------------------------------------------
// Rutas de la API (versionadas)
// ------------------------------------------------------------------
app.use('/api/v1', apiRoutes);

// ------------------------------------------------------------------
// Manejo de rutas no encontradas y de errores (SIEMPRE al final,
// después de montar todas las rutas)
// ------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

// ------------------------------------------------------------------
const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => {
  console.log(`API escuchando en http://localhost:${PUERTO}`);
});
