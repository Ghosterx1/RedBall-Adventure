import { almacenDelNavegador } from '../nucleo/Progreso.js';

/**
 * clienteApi.js — el ÚNICO módulo del frontend que habla con el backend.
 *
 * Decisiones:
 *  1. La URL de la API se resuelve sola: si el juego se sirve desde el mismo
 *     Express (`npm start`), basta con `window.location.origin + '/api'`. Si el
 *     frontend vive en otro sitio (GitHub Pages, Netlify…), se declara en el
 *     HTML:  <meta name="redball-api" content="https://mi-api.com/api">
 *     Sin `window` (Node, pruebas) no hay API: el juego funciona igual.
 *  2. NADA lanza: cada método devuelve `{ ok: true, ... }` o
 *     `{ ok: false, error: { codigo, mensaje } }`. Un servidor caído no puede
 *     romper el juego, solo dejar la tabla de récords vacía.
 *  3. `fetch` se inyecta: las pruebas pasan un doble y no se abre ni un socket.
 *  4. La identidad del jugador es un id anónimo guardado en `localStorage`. No
 *     hay cuentas ni contraseñas: es un juego de un solo nivel de confianza.
 */

/** Clave del id anónimo en el almacén del navegador. */
export const CLAVE_JUGADOR = 'redball.jugador.v1';

/** Prefijo de la API cuando se sirve todo junto. */
export const RUTA_API = '/api';

/** Si el servidor no contesta en este tiempo, se da por perdido. */
export const TIEMPO_ESPERA = 4000;

/** Patrón del id de jugador: el mismo que valida el backend. */
const PATRON_ID = /^[A-Za-z0-9_-]{3,32}$/;

/**
 * URL base de la API, o null si no se puede jugar en red.
 * @returns {string|null}
 */
export function baseApi({ documento = globalThis.document ?? null, ventana = globalThis.window ?? null } = {}) {
  // 1. Lo que diga el HTML manda (frontend y API en dominios distintos).
  const meta =
    typeof documento?.querySelector === 'function' ? documento.querySelector('meta[name="redball-api"]') : null;
  const configurada = typeof meta?.content === 'string' ? meta.content.trim() : '';
  if (configurada !== '') return configurada.replace(/\/+$/, '');

  // 2. Si nos han servido por HTTP, la API está en el mismo origen.
  const protocolo = ventana?.location?.protocol ?? '';
  if (protocolo === 'http:' || protocolo === 'https:') {
    return `${ventana.location.origin}${RUTA_API}`;
  }

  // 3. Abierto como archivo local (`file://`) o sin ventana: sin API.
  return null;
}

/**
 * Id anónimo y estable del jugador. Se genera una vez y se guarda; si el
 * navegador bloquea el almacén, se usa uno temporal para esta sesión.
 */
export function idDeJugador({ almacen = almacenDelNavegador(), generar = generarIdJugador } = {}) {
  try {
    const guardado = almacen?.getItem?.(CLAVE_JUGADOR);
    if (typeof guardado === 'string' && PATRON_ID.test(guardado)) return guardado;
    const nuevo = generar();
    almacen?.setItem?.(CLAVE_JUGADOR, nuevo);
    return nuevo;
  } catch {
    return generar();
  }
}

/** `jug-` + 8 caracteres al azar. Cabe de sobra en el patrón 3..32. */
export function generarIdJugador(azar = Math.random) {
  const alfabeto = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let sufijo = '';
  for (let i = 0; i < 8; i++) {
    sufijo += alfabeto[Math.floor(Math.abs(azar()) * alfabeto.length) % alfabeto.length];
  }
  return `jug-${sufijo}`;
}

/**
 * Cliente HTTP de la API del juego.
 *
 * @param {object}   [opciones]
 * @param {string|null} [opciones.base]      URL de la API (ver `baseApi()`)
 * @param {Function} [opciones.fetchImpl]    `fetch` a usar (inyectable)
 * @param {number}   [opciones.tiempoEspera] ms antes de abandonar
 */
export function crearClienteApi({
  base = null,
  fetchImpl = globalThis.fetch?.bind?.(globalThis) ?? null,
  tiempoEspera = TIEMPO_ESPERA
} = {}) {
  const raiz = typeof base === 'string' && base.trim() !== '' ? base.trim().replace(/\/+$/, '') : null;
  const disponible = Boolean(raiz) && typeof fetchImpl === 'function';

  async function pedir(ruta, { metodo = 'GET', cuerpo = null } = {}) {
    if (!disponible) {
      return {
        ok: false,
        error: { codigo: 'API_NO_DISPONIBLE', mensaje: 'No hay servidor: el juego funciona en local.' }
      };
    }

    const opciones = { method: metodo, headers: { Accept: 'application/json' } };
    if (cuerpo !== null) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }

    const abortar = typeof AbortController === 'function' ? new AbortController() : null;
    const temporizador = abortar && tiempoEspera > 0 ? setTimeout(() => abortar.abort(), tiempoEspera) : null;
    if (abortar) opciones.signal = abortar.signal;

    try {
      const respuesta = await fetchImpl(`${raiz}${ruta}`, opciones);
      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok || datos?.ok !== true) {
        return {
          ok: false,
          estado: respuesta.status,
          error: datos?.error ?? {
            codigo: 'ERROR_HTTP',
            mensaje: `El servidor respondió ${respuesta.status}.`
          }
        };
      }
      return { ...datos, ok: true, estado: respuesta.status };
    } catch (error) {
      const cancelado = error?.name === 'AbortError';
      return {
        ok: false,
        error: {
          codigo: cancelado ? 'TIEMPO_AGOTADO' : 'SIN_CONEXION',
          mensaje: cancelado ? 'El servidor tardó demasiado.' : 'No se pudo conectar con el servidor.'
        }
      };
    } finally {
      if (temporizador) clearTimeout(temporizador);
    }
  }

  return {
    disponible,
    base: raiz,

    /** `GET /api/salud` */
    salud: () => pedir('/salud'),

    /** `GET /api/niveles` */
    niveles: () => pedir('/niveles'),

    /** `GET /api/records?nivel=&limite=` */
    records: ({ nivel = null, limite = 10 } = {}) => {
      const parametros = new URLSearchParams();
      if (nivel) parametros.set('nivel', nivel);
      parametros.set('limite', String(limite));
      return pedir(`/records?${parametros.toString()}`);
    },

    /** `POST /api/records` — una partida terminada. */
    anotarPartida: ({ jugador, nombre = '', partida }) =>
      pedir('/records', { metodo: 'POST', cuerpo: { jugador, nombre, ...partida } }),

    /** `GET /api/perfiles/:id` */
    perfil: (jugador) => pedir(`/perfiles/${encodeURIComponent(jugador)}`),

    /** `PUT /api/perfiles/:id/progreso` — sincronizar el récord local. */
    subirProgreso: ({ jugador, nombre = '', progreso }) =>
      pedir(`/perfiles/${encodeURIComponent(jugador)}/progreso`, {
        metodo: 'PUT',
        cuerpo: { nombre, progreso }
      })
  };
}
