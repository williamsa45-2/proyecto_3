/**
 * middlewares/errorHandler.js
 * Manejador central de errores. Debe montarse SIEMPRE al final,
 * después de las rutas y del middleware notFound (4 parámetros
 * obligatorios para que Express lo reconozca como error handler).
 *
 * Cualquier controlador envuelto en asyncHandler que lance un error,
 * o cualquier código que llame a next(error), termina aquí.
 *
 * Los errores "esperados" (validaciones, negocio) pueden crearse con:
 *   const error = new Error('mensaje para el cliente');
 *   error.status = 400;
 *   throw error;
 */

function errorHandler(err, req, res, next) {
  console.error('Error no controlado:', err);

  const status = err.status || 500;
  const mensaje = status === 500
    ? 'Error interno del servidor.'
    : (err.mensaje || err.message);

  res.status(status).json({ ok: false, mensaje });
}

module.exports = errorHandler;
