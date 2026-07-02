/**
 * routes/index.js
 * Punto único de entrada para todas las rutas de la API.
 * server.js solo conoce este archivo; aquí se agregan los routers
 * de cada recurso (usuarios, y los que se sumen a futuro).
 *
 * Para agregar un nuevo recurso:
 *   1. Crear routes/<recurso>.routes.js
 *   2. Importarlo aquí abajo
 *   3. Montarlo con router.use('/<recurso>', <recurso>Routes)
 */

const express = require('express');

const usuariosRoutes = require('./usuarios.routes');

const router = express.Router();

// Ping de salud de la API (antes vivía en server.js)
router.get('/', (req, res) => {
  res.json({ ok: true, mensaje: 'API de usuarios funcionando correctamente.' });
});

// Recursos
router.use('/', usuariosRoutes); // expone /usuarios y /sincronizar

module.exports = router;
