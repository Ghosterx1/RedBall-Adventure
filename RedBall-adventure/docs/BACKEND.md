# Backend — API de récords

Express 5 + ES Modules, sin build y sin base de datos. **Una sola dependencia**
(`express`): el resto es la librería estándar de Node.

El backend hace dos cosas con el mismo proceso y el mismo origen:

1. Sirve el juego (`frontend/`) como estáticos.
2. Expone `/api` para récords, perfiles y catálogo de niveles.

Que las dos cosas vivan en el mismo origen es lo que permite que `fetch()` del
navegador no necesite CORS en producción (ni cookies, ni tokens, ni proxies).

```bash
npm start          # http://localhost:3000 (juego) y /api (API)
npm run dev        # igual, con --watch
npm test           # pruebas del backend (en la raíz: frontend + backend)
```

## Estructura

```text
backend/
  src/
    servidor.js          arranca HTTP y cierra ordenadamente (SIGINT/SIGTERM)
    app.js               monta Express (sin escuchar): ideal para pruebas
    config.js            TODA la configuración desde el entorno, con valores por defecto
    dominio.js           puente a los módulos PUROS del frontend (Progreso.js, niveles/)
    validar.js           frontera de entrada: texto suelto → dato seguro o 400
    errores.js           ErrorHttp y atajos (peticionInvalida, noEncontrado)
    rutas/api.js         los seis endpoints
    servicios/records.js anotar partida, fusión de progreso, ranking
    servicios/progreso.js fusionar dos progresos (máximos) y resumir
    almacen/almacenJson.js   persistencia atómica en un archivo JSON
    almacen/almacenMemoria.js mismo contrato, en RAM (pruebas)
    almacen/esquema.js   normalizar la base y los perfiles (v1)
    middleware/cors.js      CORS por lista de orígenes
    middleware/limite.js    freno de peticiones por IP
    middleware/errores.js   cabeceras de seguridad, 404 de /api, traductor de errores
  pruebas/
    ayudas/servidor.js      levanta la API real en un puerto libre (almacén en memoria)
    ayudas/respuesta.js     req/res/next falsos para probar middlewares
    api.test.js             contrato HTTP de punta a punta
    ...
  datos/redball.json   la "base de datos" (se crea sola, no se versiona)
```

## Variables de entorno

Todas tienen valor por defecto: `npm start` sin `.env` arranca igual. La copia
comentada está en [`.env.example`](../.env.example); la fuente de verdad es
[`backend/src/config.js`](../backend/src/config.js).

| Variable | Defecto | Qué hace |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP (se recorta a 0..65535; `0` = puerto libre) |
| `HOST` | `0.0.0.0` | Interfaz donde escucha |
| `NODE_ENV` | `development` | `production` ⇒ errores escuetos y caché de estáticos (1 h) |
| `CORS_ORIGENES` | `*` | Lista separada por comas; `*` = cualquiera |
| `FRONTEND_DIR` | `frontend/` | Carpeta que se sirve como estáticos |
| `DATOS_DIR` | `backend/datos/` | Carpeta del JSON de récords |
| `DATOS_ARCHIVO` | `redball.json` | Nombre del archivo |
| `LIMITE_CUERPO` | `64kb` | Tamaño máximo del cuerpo JSON (`express.json`) |
| `LIMITE_PETICIONES` | `60` | Peticiones por minuto y por IP sobre `/api` (`0` = sin freno) |
| `LIMITE_RANKING` | `50` | Filas máximas que devuelve el ranking (1..500) |

Las rutas relativas se resuelven **contra la raíz del monorepo**, no contra el
directorio desde el que se lanzó el proceso: `DATOS_DIR=backend/datos` apunta al
mismo sitio en local y dentro de Docker (`/app`).

## Contrato HTTP

Todo es JSON y todo lleva `{ "ok": true, ... }` o `{ "ok": false, "error": {…} }`.

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/api/salud` | Estado del servicio (lo usa el `HEALTHCHECK` de Docker) |
| `GET` | `/api/niveles` | Catálogo de niveles (sin la geometría del nivel) |
| `GET` | `/api/records` | Ranking global, o por nivel con `?nivel=nivel-3` |
| `POST` | `/api/records` | Anotar una partida terminada |
| `GET` | `/api/perfiles/:id` | Progreso guardado de un jugador |
| `PUT` | `/api/perfiles/:id/progreso` | Sincronizar el progreso del navegador |

### `GET /api/salud`

```json
{ "ok": true, "servicio": "redball-api", "version": 1, "entorno": "development",
  "tiempoActivo": 42, "niveles": 5, "jugadores": 3 }
```

### `GET /api/niveles`

```json
{ "ok": true, "version": 1, "total": 5,
  "niveles": [{ "id": "nivel-1", "numero": 1, "orden": 1, "nombre": "Primeros pasos",
                "dificultad": 1, "monedas": 0, "ancho": 1280, "alto": 270,
                "objetivo": "meta" }] }
```

No incluye `objetos`: la geometría es contenido del juego y viaja con el
frontend. El catálogo sirve para pintar listas y validar sin duplicar datos.

### `GET /api/records`

`?nivel=` (opcional) y `?limite=` (opcional, con tope `LIMITE_RANKING`).

```json
// global: suma de los récords de todos los niveles
{ "ok": true, "nivel": null, "total": 1, "records": [
  { "posicion": 1, "jugador": "jug-ab12", "nombre": "ANA", "puntos": 999,
    "completados": 1, "total": 5, "partidas": 3,
    "actualizado": "2025-01-01T00:00:00.000Z" }
] }
```

Con `?nivel=nivel-3` cada fila trae `puntos`, `monedas`, `totalMonedas` y
`completado` de **ese** nivel. Quien no ha jugado ese nivel no aparece: un 0 no
es un récord. El orden es puntos → niveles completados → id (estable entre
peticiones iguales).

### `POST /api/records`

```json
{ "jugador": "jug-ab12", "nombre": "ANA", "nivel": "nivel-1",
  "puntos": 120, "monedas": 2, "totalMonedas": 2, "completado": true }
```

| Estado | Cuándo |
|---|---|
| `201` | El jugador no existía (se crea el perfil) |
| `200` | El jugador ya existía (se actualiza) |
| `400` | Cuerpo inválido, nivel inexistente, id mal escrito, monedas incoherentes |
| `413` | El cuerpo pasa de `LIMITE_CUERPO` |

```json
{ "ok": true, "nuevo": true, "mejorado": true, "posicion": 1,
  "record": { "nivel": "nivel-1", "puntos": 120, "monedas": 2, "totalMonedas": 2,
              "completado": true, "partidas": 1, "fecha": "…" },
  "perfil": { "id": "jug-ab12", "nombre": "ANA", "progreso": { "…": "formato v1" },
              "resumen": { "puntos": 120, "completados": 1, "total": 5, "partidas": 1 },
              "creado": "…", "actualizado": "…" } }
```

El récord **nunca empeora**: la fusión la hace `Progreso.registrarPartida()` del
frontend (la misma función que usa el navegador), así que servidor y
`localStorage` no pueden discrepar. `partidas` sí suma siempre.

### `GET /api/perfiles/:id`

```json
{ "ok": true, "perfil": { "id": "jug-ab12", "nombre": "ANA", "progreso": { "version": 1, "niveles": {} },
                          "resumen": { "puntos": 999, "completados": 1, "total": 5, "partidas": 3 },
                          "creado": "…", "actualizado": "…" } }
```

`404 JUGADOR_DESCONOCIDO` si no existe; `400 JUGADOR_INVALIDO` si el id no es
`3..32` caracteres de letras, números, guion o guion bajo.

### `PUT /api/perfiles/:id/progreso`

```json
{ "nombre": "ANA", "progreso": { "version": 1, "niveles": { "nivel-1": {
  "puntos": 120, "monedas": 2, "totalMonedas": 2, "completado": true, "partidas": 3 } } } }
```

`201` si el perfil es nuevo, `200` si se fusionó con uno existente. La fusión es
de **máximos** (`puntos`, `monedas`, `totalMonedas`, `partidas` y `completado`
por OR), así que reenviarlo no suma ni borra nada: sirve para llevar el
progreso del portátil al móvil sin riesgo.

### Errores

```json
{ "ok": false, "error": { "codigo": "NIVEL_DESCONOCIDO",
                          "mensaje": "El nivel \"nivel-9\" no existe en el catálogo.",
                          "detalles": { "niveles": ["nivel-1", "…"] } } }
```

| Código | Estado | Cuándo |
|---|---|---|
| `JUGADOR_INVALIDO` | 400 | El id no cumple el patrón |
| `NIVEL_DESCONOCIDO` | 400 | El nivel no está en el catálogo |
| `CAMPO_OBLIGATORIO` | 400 | Falta `puntos`, `progreso`… |
| `CAMPO_INVALIDO` | 400 | Tipo o rango incorrecto (`12.5`, `-1`, `"doce"`) |
| `CUERPO_INVALIDO` | 400 | El cuerpo no es un objeto JSON |
| `DATOS_INCOHERENTES` | 400 | Más monedas recogidas que monedas tiene el nivel |
| `JSON_INVALIDO` | 400 | El cuerpo no era JSON válido (`express.json`) |
| `JUGADOR_DESCONOCIDO` | 404 | No hay perfil con ese id |
| `NO_ENCONTRADO` | 404 | Ruta `/api` inexistente |
| `CUERPO_DEMASIADO_GRANDE` | 413 | Cuerpo por encima de `LIMITE_CUERPO` |
| `DEMASIADAS_PETICIONES` | 429 | Freno de `/api` (lleva `Retry-After`) |
| `ERROR_INTERNO` | 500 | Fallo inesperado (se registra; en producción no se detalla) |

El `codigo` es el contrato: el mensaje se puede reescribir sin romper clientes.
`detalles` solo aparece cuando hay algo útil que contar.

## Almacenamiento

`almacen/almacenJson.js` guarda UN archivo (`DATOS_DIR/DATOS_ARCHIVO`):

- **Escritura atómica**: se escribe `redball.json.tmp` y se renombra; un corte a
  mitad no deja el JSON truncado.
- **Una escritura a la vez**: `actualizar()` encadena las tareas, así dos POST
  simultáneos no se pisan (leer–modificar–escribir).
- **Lectura tolerante**: sin archivo → `null` (base vacía); archivo corrupto →
  `warn` por consola y se empieza de cero. El juego nunca cae por el disco.
- **Migración/normalización** en `almacen/esquema.js`: lo que no encaja se
  descarta en vez de reventar (versión, ids, nombres de más de 16 caracteres,
  números imposibles…).

`almacen/almacenMemoria.js` cumple el mismo contrato en RAM (con contadores
`lecturas`/`escrituras`) y es lo que usan las pruebas: ni tocan el disco ni
dependen del estado de una ejecución anterior.

## Middlewares (el orden importa)

1. `cabecerasSeguridad()` — `nosniff`, `SAMEORIGIN`, `no-referrer`.
2. `cors(origenes)` — cabeceras por lista; el preflight `OPTIONS` se contesta
   ahí mismo con `204`.
3. `/api`: `express.json({ limit })` → `limitePeticiones()` → `crearApi()`.
4. `/api` 404 en JSON (antes de los estáticos, para que una ruta mal escrita no
   devuelva el `index.html`).
5. `express.static(frontend)` — el juego (`index.html`, `Css/`, `src/`…).
6. Fallback del juego para rutas **sin extensión** (`/nivel-3` → `index.html`).
7. 404 de texto y, al final, `manejarErrores()` — el único sitio que decide el
   estado y el cuerpo de un error.

## Pruebas

```bash
npm test                          # los dos suites: 420 pruebas
npm run test:backend              # solo la API (97)
npm run test:frontend             # solo el juego (323)
npm test --workspace @redball/backend
cd backend && node --test "pruebas/**/*.test.js"
```

- `pruebas/api.test.js` levanta la API **de verdad** en un puerto libre
  (`levantarApi()`), le habla por HTTP y la cierra: no hay cliente simulado.
- `pruebas/middleware.test.js` usa `req`/`res`/`next` falsos (`ayudas/respuesta.js`).
- `pruebas/almacen.test.js` prueba el JSON real en un directorio temporal
  (archivo corrupto, escrituras concurrentes, sin temporales huérfanos).
- `pruebas/config.test.js` fija los valores por defecto y los límites (`PORT`
  imposible no tumba el servidor).

## Docker

```bash
docker compose up --build     # http://localhost:3000
```

Un solo contenedor, usuario `node` (no root), `HEALTHCHECK` contra `/api/salud`
y el JSON de récords en `backend/datos/` (montado como volumen en
`docker-compose.yml`). `frontend/pruebas` y `backend/pruebas` se excluyen de la
imagen con `.dockerignore`.

## Reglas del proyecto

1. La dependencia va **siempre** de backend → `frontend/src` **puro**
   (`Progreso.js`, `mundo/niveles/`). El frontend nunca importa de `backend/`.
2. Esos módulos del frontend no pueden empezar a tocar el DOM: los usa Node.
3. Nada de estado global: el almacén y la configuración se inyectan
   (`crearApp({ config, almacen, registro })`), que es lo que hace testeable todo.
4. El backend no reimplementa reglas del juego: las importa.
