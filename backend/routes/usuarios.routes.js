/**
 * routes/usuarios.routes.js
 * Rutas de la API relacionadas con usuarios.
 * Se montan en server.js bajo el prefijo /api
 */

const express = require('express');
const usuariosController = require('../controllers/usuarios.controller');

const router = express.Router();

// GET /api/usuarios
router.get('/usuarios', usuariosController.listarUsuarios);

// POST /api/sincronizar
router.post('/sincronizar', usuariosController.sincronizarUsuarios);

module.exports = router;
