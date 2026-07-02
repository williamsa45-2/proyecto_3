/**
 * middlewares/notFound.js
 * Se ejecuta cuando ninguna ruta registrada coincide con la petición.
 * Debe montarse DESPUÉS de todas las rutas y ANTES del errorHandler.
 */

function notFound(req, res, next) {
  res.status(404).json({
    ok: false,
    mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
}

module.exports = notFound;
