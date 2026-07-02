/**
 * utils/asyncHandler.js
 * Envuelve controladores async para no repetir try/catch en cada uno.
 * Cualquier error lanzado dentro del controlador se pasa a next(),
 * y de ahí lo recoge el middleware central de errores.
 */

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
