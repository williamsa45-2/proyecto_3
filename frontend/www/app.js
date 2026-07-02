/**
 * app.js
 * Lógica Offline-First multiplataforma (PWA + APK vía Capacitor).
 *
 * - Detecta la plataforma (web vs nativo) e inicializa SQLite con el
 *   motor correcto: jeep-sqlite (WebAssembly) en web, motor nativo
 *   en Android/iOS.
 * - Todo registro se guarda SIEMPRE primero en la tabla local
 *   "usuarios_local" con sincronizado = 0.
 * - Escucha el estado de red (@capacitor/network). Si hay conexión,
 *   toma los pendientes y los sincroniza contra el backend.
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Network } from '@capacitor/network';

// ------------------------------------------------------------------
// Configuración
// ------------------------------------------------------------------

// El frontend y el backend ahora son proyectos independientes
// (frontend servido como PWA/APK, backend como API REST aparte).
// Ajustar este valor al host real del backend en producción.
const API_BASE = 'http://localhost:3000/api/v1';
const NOMBRE_BD = 'usuarios_offline_db';

const sqliteConexion = new SQLiteConnection(CapacitorSQLite);
let baseDeDatos; // referencia a la conexión abierta
let plataformaActual;

// ------------------------------------------------------------------
// 1. Inicialización de SQLite según plataforma
// ------------------------------------------------------------------
async function inicializarSQLite() {
  plataformaActual = Capacitor.getPlatform(); // 'web' | 'android' | 'ios'

  if (plataformaActual === 'web') {
    // --- PWA / Navegador de escritorio: motor WebAssembly ---
    // Requiere el custom element <jeep-sqlite></jeep-sqlite> en el HTML.
    const elementoJeep = document.querySelector('jeep-sqlite');
    if (!elementoJeep) {
      console.error('No se encontró <jeep-sqlite> en el HTML. Revisa las instrucciones PWA.');
    }
    console.log('[SQLite] Esperando a que <jeep-sqlite> quede definido...');
    await customElements.whenDefined('jeep-sqlite');
    console.log('[SQLite] <jeep-sqlite> definido. Iniciando WebStore...');
    await sqliteConexion.initWebStore();
    console.log('[SQLite] WebStore inicializado.');
  }
  // --- Android / iOS: no requiere pasos extra, usa el plugin nativo ---

  console.log('[SQLite] Verificando consistencia de conexiones...');
  const consistencia = await sqliteConexion.checkConnectionsConsistency();
  const abierta = (await sqliteConexion.isConnection(NOMBRE_BD, false)).result;

  if (consistencia.result && abierta) {
    console.log('[SQLite] Reutilizando conexión existente.');
    baseDeDatos = await sqliteConexion.retrieveConnection(NOMBRE_BD, false);
  } else {
    console.log('[SQLite] Creando nueva conexión...');
    baseDeDatos = await sqliteConexion.createConnection(
      NOMBRE_BD,
      false,          // sin encriptación
      'no-encryption',
      1,              // versión de esquema
      false
    );
  }

  console.log('[SQLite] Abriendo base de datos...');
  await baseDeDatos.open();
  console.log('[SQLite] Base de datos abierta. Creando tabla si no existe...');

  await baseDeDatos.execute(`
    CREATE TABLE IF NOT EXISTS usuarios_local (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      cc                    TEXT UNIQUE NOT NULL,
      nombre                TEXT NOT NULL,
      apellido              TEXT NOT NULL,
      contacto              TEXT,
      correo                TEXT,
      direccion             TEXT,
      fecha_nacimiento      TEXT,
      profesion             TEXT,
      telefono_secundario   TEXT,
      correo_secundario     TEXT,
      sincronizado          INTEGER NOT NULL DEFAULT 0
    );
  `);

  // En web, jeep-sqlite guarda en IndexedDB; hay que persistir explícitamente.
  if (plataformaActual === 'web') {
    await sqliteConexion.saveToStore(NOMBRE_BD);
  }

  console.log(`SQLite inicializado correctamente (plataforma: ${plataformaActual})`);
}

// ------------------------------------------------------------------
// 2. Guardar SIEMPRE en local primero (sincronizado = 0)
// ------------------------------------------------------------------
async function guardarUsuarioLocal(usuario) {
  if (!baseDeDatos) {
    throw new Error(
      'La base de datos local todavía no está lista (SQLite no se inicializó). Revisa la consola (F12) para ver el error real.'
    );
  }

  const sentencia = `
    INSERT OR REPLACE INTO usuarios_local
      (cc, nombre, apellido, contacto, correo, direccion,
       fecha_nacimiento, profesion, sincronizado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0);
  `;

  const valores = [
    usuario.cc,
    usuario.nombre,
    usuario.apellido,
    usuario.contacto || null,
    usuario.correo || null,
    usuario.direccion || null,
    usuario.fecha_nacimiento || null,
    usuario.profesion || null
  ];

  await baseDeDatos.run(sentencia, valores);

  if (plataformaActual === 'web') {
    await sqliteConexion.saveToStore(NOMBRE_BD);
  }
}

// ------------------------------------------------------------------
// 3. Consultar pendientes y refrescar tabla en pantalla
// ------------------------------------------------------------------
async function obtenerPendientes() {
  const resultado = await baseDeDatos.query(
    'SELECT * FROM usuarios_local WHERE sincronizado = 0;'
  );
  return resultado.values || [];
}

async function refrescarTablaEnPantalla() {
  const resultado = await baseDeDatos.query('SELECT * FROM usuarios_local ORDER BY id DESC;');
  const filas = resultado.values || [];
  const cuerpoTabla = document.querySelector('#tablaUsuarios tbody');
  if (!cuerpoTabla) return;

  cuerpoTabla.innerHTML = filas.map((usuario) => `
    <tr>
      <td>${usuario.cc}</td>
      <td>${usuario.nombre}</td>
      <td>${usuario.apellido}</td>
      <td>${usuario.contacto || ''}</td>
      <td>${usuario.correo || ''}</td>
      <td>${usuario.sincronizado ? '✅' : '⏳ pendiente'}</td>
    </tr>
  `).join('');
}

// ------------------------------------------------------------------
// 4. Sincronización con el backend cuando hay red
// ------------------------------------------------------------------
async function sincronizarPendientes() {
  try {
    const pendientes = await obtenerPendientes();
    if (pendientes.length === 0) {
      console.log('No hay registros pendientes por sincronizar.');
      return;
    }

    const registros = pendientes.map((u) => ({
      cc: u.cc,
      nombre: u.nombre,
      apellido: u.apellido,
      contacto: u.contacto,
      correo: u.correo,
      direccion: u.direccion,
      fecha_nacimiento: u.fecha_nacimiento,
      profesion: u.profesion
    }));

    const respuesta = await fetch(`${API_BASE}/sincronizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registros })
    });

    if (!respuesta.ok) {
      console.warn('El servidor respondió con error al sincronizar. Se reintentará luego.');
      return;
    }

    const data = await respuesta.json();

    // Marcamos como sincronizado = 1 cada cc que el backend procesó sin error.
    for (const item of data.resultados) {
      if (item.estado === 'insertado' || item.estado === 'duplicado_guardado_como_secundario') {
        await baseDeDatos.run(
          'UPDATE usuarios_local SET sincronizado = 1 WHERE cc = ?;',
          [item.cc]
        );
      } else {
        console.warn(`No se pudo sincronizar cc=${item.cc}: ${item.mensaje}`);
      }
    }

    if (plataformaActual === 'web') {
      await sqliteConexion.saveToStore(NOMBRE_BD);
    }

    await refrescarTablaEnPantalla();
    console.log('Sincronización completada.');
  } catch (error) {
    // Sin conexión real, timeout, backend caído, etc. -> se queda pendiente.
    console.warn('No fue posible sincronizar en este momento. Se reintentará más tarde.', error);
  }
}

// ------------------------------------------------------------------
// 5. Monitoreo de red (@capacitor/network)
// ------------------------------------------------------------------
function actualizarIndicadorConexion(conectado) {
  const badge = document.getElementById('estadoConexion');
  if (!badge) return;
  badge.textContent = conectado ? 'En línea' : 'Sin conexión';
  badge.classList.toggle('en-linea', conectado);
  badge.classList.toggle('sin-conexion', !conectado);
}

async function configurarMonitoreoDeRed() {
  const estadoInicial = await Network.getStatus();
  actualizarIndicadorConexion(estadoInicial.connected);
  if (estadoInicial.connected) {
    sincronizarPendientes();
  }

  Network.addListener('networkStatusChange', (estado) => {
    actualizarIndicadorConexion(estado.connected);
    if (estado.connected) {
      sincronizarPendientes();
    }
  });

  // Reintento periódico de respaldo (por si el evento de red no dispara,
  // caso común en algunos navegadores de escritorio).
  setInterval(async () => {
    const estado = await Network.getStatus();
    if (estado.connected) {
      sincronizarPendientes();
    }
  }, 30000);
}

// ------------------------------------------------------------------
// 6. Captura del formulario
// ------------------------------------------------------------------
function configurarFormulario() {
  const formulario = document.getElementById('formUsuario');
  if (!formulario) return;

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const usuario = {
      cc: document.getElementById('cc').value.trim(),
      nombre: document.getElementById('nombre').value.trim(),
      apellido: document.getElementById('apellido').value.trim(),
      contacto: document.getElementById('contacto').value.trim(),
      correo: document.getElementById('correo').value.trim(),
      direccion: document.getElementById('direccion').value.trim(),
      fecha_nacimiento: document.getElementById('fecha_nacimiento').value,
      profesion: document.getElementById('profesion').value.trim()
    };

    if (!usuario.cc || !usuario.nombre || !usuario.apellido) {
      alert('Cédula, nombre y apellido son obligatorios.');
      return;
    }

    // Regla clave del sistema: SIEMPRE se guarda local primero.
    try {
      await guardarUsuarioLocal(usuario);
    } catch (error) {
      console.error('Error al guardar en la base de datos local:', error);
      alert(error.message || 'No se pudo guardar el usuario localmente.');
      return;
    }
    await refrescarTablaEnPantalla();
    formulario.reset();

    // Si hay red disponible en este momento, se intenta sincronizar de una vez.
    const estadoRed = await Network.getStatus();
    if (estadoRed.connected) {
      sincronizarPendientes();
    }
  });
}

// ------------------------------------------------------------------
// Service Worker (PWA): habilita instalación y funcionamiento offline
// del "shell" de la app. Solo aplica en navegador; en el APK nativo
// (Capacitor) no es necesario ni existe navigator.serviceWorker en
// el mismo sentido, por eso se valida la plataforma.
// ------------------------------------------------------------------
async function registrarServiceWorker() {
  if (Capacitor.getPlatform() !== 'web') return;
  if (!('serviceWorker' in navigator)) return;

  try {
    await navigator.serviceWorker.register('./sw.js');
    console.log('Service Worker registrado correctamente.');
  } catch (error) {
    console.error('No se pudo registrar el Service Worker:', error);
  }
}

// ------------------------------------------------------------------
// Arranque de la aplicación
// ------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  // 1. Formulario y estado de red deben quedar funcionando SIEMPRE,
  //    incluso si SQLite falla al iniciar (ver punto 2).
  configurarFormulario();
  await configurarMonitoreoDeRed();

  // 2. Service Worker y SQLite: si algo falla aquí, lo mostramos
  //    claramente en vez de dejar la app "congelada" en silencio.
  await registrarServiceWorker();

  try {
    await inicializarSQLite();
    await refrescarTablaEnPantalla();
  } catch (error) {
    console.error('Error inicializando SQLite local:', error);
    const badge = document.getElementById('estadoConexion');
    if (badge) {
      badge.textContent = 'Error de base de datos local (ver consola F12)';
      badge.classList.add('sin-conexion');
    }
  }
});
