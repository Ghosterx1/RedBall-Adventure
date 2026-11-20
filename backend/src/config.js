import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * config.js — TODA la configuración del backend en un único sitio.
 *
 * Reglas:
 *  - Se lee de variables de entorno, pero cada una tiene un valor por defecto
 *    que funciona en local (`npm start` sin `.env` arranca igual).
 *  - `leerConfig(env)` recibe el entorno por parámetro: las pruebas construyen
 *    configuraciones a medida sin tocar `process.env`.
 *  - Las rutas relativas se resuelven contra la RAÍZ DEL PROYECTO, no contra el
 *    directorio desde el que se lanzó el proceso (en Docker es `/app`, en local
 *    es la carpeta del repo: en los dos casos apunta al mismo sitio).
 */

/** Carpeta `backend/` (este archivo vive en `backend/src/`). */
export const RAIZ_BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Raíz del monorepo: contiene `frontend/` y `backend/`. */
export const RAIZ_PROYECTO = path.resolve(RAIZ_BACKEND, '..');

/** Versión del contrato de la API (no la del juego). */
export const VERSION_API = 1;

const POR_DEFECTO = Object.freeze({
  puerto: 3000,
  host: '0.0.0.0',
  entorno: 'development',
  carpetaFrontend: path.join(RAIZ_PROYECTO, 'frontend'),
  carpetaDatos: path.join(RAIZ_BACKEND, 'datos'),
  archivoDatos: 'redball.json',
  origenes: ['*'],
  limiteCuerpo: '64kb',
  limitePeticiones: 60,
  limiteRanking: 50
});

/**
 * Configuración efectiva del servidor.
 * @param {Record<string, string|undefined>} [env] entorno (por defecto `process.env`)
 * @returns {Readonly<object>} configuración congelada
 */
export function leerConfig(env = process.env) {
  return Object.freeze({
    puerto: entero(env.PORT, POR_DEFECTO.puerto, 0, 65535),
    host: texto(env.HOST, POR_DEFECTO.host),
    entorno: texto(env.NODE_ENV, POR_DEFECTO.entorno),
    produccion: env.NODE_ENV === 'production',
    /** Estáticos del juego: `index.html`, `Css/`, `src/`, `Index/`, `legacy/` */
    carpetaFrontend: ruta(env.FRONTEND_DIR, POR_DEFECTO.carpetaFrontend),
    /** Carpeta de la "base de datos" JSON */
    carpetaDatos: ruta(env.DATOS_DIR, POR_DEFECTO.carpetaDatos),
    archivoDatos: texto(env.DATOS_ARCHIVO, POR_DEFECTO.archivoDatos),
    /** Orígenes permitidos por CORS; `['*']` = cualquiera */
    origenes: lista(env.CORS_ORIGENES),
    limiteCuerpo: texto(env.LIMITE_CUERPO, POR_DEFECTO.limiteCuerpo),
    /** Peticiones por minuto y por IP sobre /api (0 = sin límite) */
    limitePeticiones: entero(env.LIMITE_PETICIONES, POR_DEFECTO.limitePeticiones, 0, 1_000_000),
    /** Filas máximas del ranking */
    limiteRanking: entero(env.LIMITE_RANKING, POR_DEFECTO.limiteRanking, 1, 500),
    versionApi: VERSION_API
  });
}

function texto(valor, porDefecto) {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  return limpio === '' ? porDefecto : limpio;
}

function entero(valor, porDefecto, minimo, maximo) {
  const numero = Number.parseInt(valor, 10);
  if (!Number.isFinite(numero)) return porDefecto;
  return Math.min(maximo, Math.max(minimo, numero));
}

function ruta(valor, porDefecto) {
  const limpio = texto(valor, '');
  return limpio === '' ? porDefecto : path.resolve(RAIZ_PROYECTO, limpio);
}

function lista(valor) {
  const limpio = texto(valor, '');
  if (limpio === '') return [...POR_DEFECTO.origenes];
  return limpio
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);
}
