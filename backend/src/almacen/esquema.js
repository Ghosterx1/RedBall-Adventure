import { normalizarProgreso } from '../dominio.js';

/**
 * esquema.js — la forma de la "base de datos" y su normalización.
 *
 * La persistencia es un único JSON con esta pinta:
 *
 *   {
 *     "version": 1,
 *     "actualizado": "2026-05-11T10:00:00.000Z",
 *     "jugadores": {
 *       "jug-ab12cd34": {
 *         "id": "jug-ab12cd34",
 *         "nombre": "JUG-CD34",
 *         "progreso": {
 *           "version": 1,
 *           "niveles": {
 *             "nivel-1": { "puntos": 210, "monedas": 3, "totalMonedas": 3,
 *                          "completado": true, "partidas": 4 }
 *           }
 *         },
 *         "creado": "...", "actualizado": "..."
 *       }
 *     }
 *   }
 *
 * DECISIÓN: no se guarda una tabla de récords aparte. `progreso` es EXACTAMENTE
 * el formato v1 que ya usa el navegador (`frontend/src/nucleo/Progreso.js`), y
 * ya contiene el récord por nivel (puntos, monedas, completado, partidas). Dos
 * estructuras paralelas serían dos fuentes de verdad que se pueden contradecir.
 *
 * Nada entra sin pasar por `normalizarBase`: un JSON viejo, corrupto o escrito a
 * mano no puede romper el servidor ni el ranking (misma filosofía que
 * `Progreso.js`, que normaliza lo que lee del navegador).
 */

/** Versión del formato persistido (independiente de la versión de la API). */
export const VERSION_DB = 1;

/** Ids aceptados: los mismos que valida `validar.js`. */
export const PATRON_ID = /^[A-Za-z0-9_-]{3,32}$/;

/** Base vacía lista para usar. */
export function baseVacia() {
  return { version: VERSION_DB, actualizado: null, jugadores: {} };
}

/** Copia normalizada de una base leída del disco (nunca lanza). */
export function normalizarBase(datos) {
  const base = baseVacia();
  if (!datos || typeof datos !== 'object') return base;

  base.actualizado = fecha(datos.actualizado);
  const jugadores = datos.jugadores && typeof datos.jugadores === 'object' ? datos.jugadores : {};
  for (const [id, jugador] of Object.entries(jugadores)) {
    if (!PATRON_ID.test(id)) continue;
    base.jugadores[id] = normalizarJugador(id, jugador);
  }
  return base;
}

/** Jugador normalizado (siempre con un progreso válido). */
export function normalizarJugador(id, datos = {}) {
  return {
    id,
    nombre: nombreJugador(datos?.nombre, id),
    progreso: normalizarProgreso(datos?.progreso),
    creado: fecha(datos?.creado),
    actualizado: fecha(datos?.actualizado)
  };
}

/** Jugador recién creado. */
export function jugadorNuevo(id, nombre, cuando = new Date().toISOString()) {
  return {
    id,
    nombre: nombreJugador(nombre, id),
    progreso: normalizarProgreso(null),
    creado: cuando,
    actualizado: cuando
  };
}

/**
 * Nombre visible: letras, números, espacio, guion, punto y guion bajo; 16 como
 * máximo. Si no queda nada, se usa un alias derivado del id (`JUG-CD34`), así el
 * ranking siempre tiene algo que enseñar.
 */
export function nombreJugador(valor, id = '') {
  const limpio = String(valor ?? '')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, 16);
  if (limpio !== '') return limpio;
  const sufijo = String(id).slice(-4).toUpperCase();
  return sufijo === '' ? 'JUGADOR' : `JUG-${sufijo}`;
}

function fecha(valor) {
  if (typeof valor !== 'string') return null;
  const marca = Date.parse(valor);
  return Number.isFinite(marca) ? new Date(marca).toISOString() : null;
}
