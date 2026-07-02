/**
 * controllers/usuarios.controller.js
 * Lógica de negocio expuesta a través de las rutas de la API.
 */

const usuariosModel = require('../models/usuarios.model');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/v1/usuarios
const listarUsuarios = asyncHandler(async (req, res) => {
  const usuarios = await usuariosModel.listarUsuarios();
  res.json({ ok: true, usuarios });
});

/**
 * POST /api/v1/sincronizar
 * Espera: { registros: [ { cc, nombre, apellido, contacto, correo,
 *                           direccion, fecha_nacimiento, profesion }, ... ] }
 *
 * Nota: los errores por registro individual NO se propagan al
 * errorHandler central; se devuelven en el arreglo "resultados" para
 * que el cliente sepa exactamente qué registro falló y por qué,
 * y pueda marcar en SQLite local cuáles quedaron sincronizados.
 */
const sincronizarUsuarios = asyncHandler(async (req, res) => {
  const registros = req.body.registros;

  if (!Array.isArray(registros) || registros.length === 0) {
    return res.status(400).json({
      ok: false,
      mensaje: 'No se recibieron registros para sincronizar.'
    });
  }

  const resultados = [];

  for (const registro of registros) {
    const { cc, nombre, apellido } = registro;

    if (!cc || !nombre || !apellido) {
      resultados.push({
        cc: cc || null,
        estado: 'error',
        mensaje: 'Los campos cc, nombre y apellido son obligatorios.'
      });
      continue;
    }

    try {
      const resultado = await usuariosModel.sincronizarUnRegistro(registro);
      resultados.push(resultado);
    } catch (error) {
      console.error(`Error sincronizando cc=${cc}:`, error);
      resultados.push({ cc, estado: 'error', mensaje: error.message });
    }
  }

  // 200 con el detalle de cada registro; el cliente usa esto para marcar
  // en SQLite local cuáles quedaron "sincronizado = 1".
  res.status(200).json({ ok: true, resultados });
});

module.exports = {
  listarUsuarios,
  sincronizarUsuarios
};
