/**
 * models/usuarios.model.js
 * Acceso a datos de la tabla "usuarios" en PostgreSQL.
 */

const { Pool } = require('pg');

const poolConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'usuarios_db',
  password: process.env.DB_PASS || 'postgres',
  port: Number(process.env.DB_PORT) || 5432
};

// Soporte opcional para conexiones SSL (útil para DB remotas en la nube)
if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = {
    // Por seguridad, por defecto verificamos el certificado a menos que
    // se indique lo contrario con DB_SSL_REJECT_UNAUTHORIZED=false
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

async function listarUsuarios() {
  const resultado = await pool.query(
    'SELECT * FROM usuarios ORDER BY creado_en DESC LIMIT 200'
  );
  return resultado.rows;
}

/**
 * Aplica la regla de negocio de sincronización para UN registro:
 *  - Si el "cc" no existe -> INSERT.
 *  - Si el "cc" ya existe  -> solo actualiza correo_secundario y
 *    telefono_secundario, sin tocar los datos principales.
 *
 * Se ejecuta dentro de una transacción propia por registro para no
 * perder el resto del lote si uno falla.
 */
async function sincronizarUnRegistro(registro) {
  const {
    cc,
    nombre,
    apellido,
    contacto,
    correo,
    direccion,
    fecha_nacimiento,
    profesion
  } = registro;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existente = await client.query(
      'SELECT id FROM usuarios WHERE cc = $1 FOR UPDATE',
      [cc]
    );

    let resultado;

    if (existente.rows.length === 0) {
      const insertado = await client.query(
        `INSERT INTO usuarios
           (cc, nombre, apellido, contacto, correo, direccion,
            fecha_nacimiento, profesion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          cc,
          nombre,
          apellido,
          contacto || null,
          correo || null,
          direccion || null,
          fecha_nacimiento || null,
          profesion || null
        ]
      );

      resultado = { cc, estado: 'insertado', id: insertado.rows[0].id };
    } else {
      const idExistente = existente.rows[0].id;

      await client.query(
        `UPDATE usuarios
            SET correo_secundario   = $1,
                telefono_secundario = $2
          WHERE id = $3`,
        [correo || null, contacto || null, idExistente]
      );

      resultado = {
        cc,
        estado: 'duplicado_guardado_como_secundario',
        id: idExistente
      };
    }

    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  listarUsuarios,
  sincronizarUnRegistro
};
