# Sistema CRUD de Usuarios — Offline-First (Backend API + Frontend Capacitor separados)

## Estructura del proyecto

```
proyecto_3/
├── backend/                 <-- API REST (Express + PostgreSQL)
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── sql/
│   │   └── schema.sql
│   ├── routes/
│   │   ├── index.js          <-- agrega todos los routers de recursos
│   │   └── usuarios.routes.js
│   ├── controllers/
│   │   └── usuarios.controller.js
│   ├── middlewares/
│   │   ├── notFound.js       <-- 404 centralizado
│   │   └── errorHandler.js   <-- manejo de errores centralizado
│   ├── utils/
│   │   └── asyncHandler.js   <-- envuelve controladores async
│   └── models/
│       └── usuarios.model.js
│
├── frontend/                <-- App independiente (PWA + APK vía Capacitor)
│   ├── index.html
│   ├── app.js
│   ├── estilos.css
│   ├── manifest.json
│   ├── package.json
│   └── capacitor.config.json
│
└── README.md
```

El backend ya **no sirve HTML**: solo responde JSON bajo el prefijo `/api`.
El frontend es una app estática (HTML/CSS/JS) que consume esa API con `fetch`
y que además puede empaquetarse como PWA o como APK con Capacitor.

---

## 1. Backend (API)

```bash
cd backend
cp .env.example .env      # ajustar credenciales de PostgreSQL
npm install                # genera un package-lock.json nuevo y limpio
psql -U postgres -d usuarios_db -f sql/schema.sql
npm run dev                 # http://localhost:3000
```

Endpoints disponibles (todos bajo el prefijo versionado `/api/v1`):

| Método | Ruta                  | Descripción                                      |
|--------|-----------------------|---------------------------------------------------|
| GET    | `/api/v1`             | Ping de salud de la API                           |
| GET    | `/api/v1/usuarios`    | Lista los últimos 200 usuarios en PostgreSQL       |
| POST   | `/api/v1/sincronizar` | Recibe `{ registros: [...] }` y aplica la regla de duplicados (cc) |

Cualquier ruta no registrada devuelve `404` con
`{ ok: false, mensaje: 'Ruta no encontrada: <método> <ruta>' }`
(middleware `notFound.js`), y cualquier error no controlado dentro de un
controlador se captura por `errorHandler.js` y responde `{ ok: false,
mensaje: '...' }` con el código de estado correspondiente (por defecto 500).

CORS está habilitado (`cors()`), por lo que el frontend puede consumirla
desde otro origen/puerto sin problema.

### Agregar un nuevo recurso a futuro

1. Crear `routes/<recurso>.routes.js`, `controllers/<recurso>.controller.js`
   y `models/<recurso>.model.js`.
2. Envolver cada controlador async con `asyncHandler` (ver
   `controllers/usuarios.controller.js` como referencia).
3. En `routes/index.js`, importar el nuevo router y montarlo:
   ```js
   const productosRoutes = require('./productos.routes');
   router.use('/productos', productosRoutes);
   ```
   Con eso queda disponible automáticamente en `/api/v1/productos/...`.

---

## 2. Frontend (Capacitor: PWA + APK)

```bash
cd frontend
npm install
npx cap init                 # solo si aún no existe app.id / app.name configurados
npx cap add android          # genera el proyecto Android nativo
npx cap sync
```

Antes de correr, verifica en `app.js` la constante:

```js
const API_BASE = 'http://localhost:3000/api';
```

Ajústala a la URL real del backend en producción (por ejemplo,
`https://api.mi-dominio.com/api`). En Android, `localhost` apunta al propio
dispositivo, así que en pruebas con emulador/dispositivo físico deberás usar
la IP de tu máquina de desarrollo o el dominio público del backend.

### Ejecutar como sitio estático / PWA

```bash
cd frontend
npx serve .        # o cualquier servidor estático (live-server, http-server, etc.)
```

Abre la URL que te indique el servidor. El navegador ofrecerá "Instalar app"
gracias al `manifest.json` enlazado en `index.html`.

### Generar el APK

```bash
npx cap open android
# En Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)
```

En el APK, `Capacitor.getPlatform()` devuelve `"android"`, por lo que
`app.js` usa directamente el plugin nativo `@capacitor-community/sqlite`
en vez de `jeep-sqlite`.

---

## 3. Separación de dependencias

- **`backend/package.json`**: solo `express`, `pg`, `dotenv`, `cors`
  (+ `nodemon` como devDependency). No incluye Capacitor ni EJS.
- **`frontend/package.json`**: solo `@capacitor/core`, `@capacitor/network`,
  `@capacitor-community/sqlite`, `jeep-sqlite` (+ `@capacitor/android` y
  `@capacitor/cli` como devDependencies). No incluye Express ni `pg`.

---

## 4. Lógica Offline-First (sin cambios de negocio)

1. El usuario llena el formulario en `frontend/index.html` → se guarda
   **siempre** en `usuarios_local` (SQLite, vía `app.js`) con
   `sincronizado = 0`.
2. `@capacitor/network` detecta conexión:
   - **Con red:** se envían los pendientes con `POST {API_BASE}/sincronizar`
     y se marcan `sincronizado = 1` según la respuesta del backend.
   - **Sin red:** quedan en SQLite local hasta el próximo evento de red o
     el reintento periódico cada 30s.
3. En el backend (`models/usuarios.model.js`), por cada registro:
   - Si el `cc` no existe en PostgreSQL → `INSERT`.
   - Si el `cc` ya existe → **no se sobrescriben los datos principales**;
     solo se actualizan `correo_secundario` y `telefono_secundario`.

---

## 5. Mejora opcional: migrar el frontend a Vite

Si el proyecto va a crecer, se recomienda migrar `frontend/` a Vite:

```
frontend/
├── src/
│   ├── app.js
│   └── estilos.css
├── public/
│   └── manifest.json
├── index.html
├── vite.config.js
├── package.json
└── capacitor.config.json
```

Con Vite, `capacitor.config.json` cambiaría `webDir` de `"."` a `"dist"`,
y `npx cap sync` tomaría el build de producción en lugar de los archivos
fuente directamente. Esto no es necesario para que el proyecto funcione
hoy, pero facilita el mantenimiento a largo plazo (hot reload, bundling,
minificación, etc.).
