/**
 * Progreso.js — persistencia del RÉCORD entre sesiones.
 *
 * Reglas de oro:
 *  - Nada de estado oculto: las funciones reciben el almacén (localStorage) por
 *    parámetro, así se pueden probar con un objeto falso en Node.
 *  - Nada puede romper el juego: si el navegador bloquea el almacén (modo
 *    privado, cuota llena, Safari), se devuelve el progreso vacío o false.
 *  - Lo que se lee se NORMALIZA: un JSON corrupto, de otra versión o con
 *    números imposibles no debe poder reventar el HUD.
 *
 * Se guarda el récord por nivel: mejor puntuación, máximo de monedas cogidas,
 * total de monedas del nivel, si se completó y cuántas partidas se jugaron.
 */

/** Clave y versión del formato guardado. */
export const CLAVE_PROGRESO = 'redball.progreso.v1';
export const VERSION_PROGRESO = 1;

/** Estado vacío (nivel sin jugar). */
export function progresoVacio() {
  return { version: VERSION_PROGRESO, niveles: {} };
}

/** `localStorage` si existe y se deja tocar, o null. */
export function almacenDelNavegador() {
  try {
    const almacen = globalThis.localStorage;
    return almacen && typeof almacen.getItem === 'function' ? almacen : null;
  } catch {
    return null; // algunos navegadores lanzan al acceder a localStorage
  }
}

/** Récord de un nivel (nunca undefined). */
export function registroDe(progreso, nivel = 'nivel') {
  return nivelNormalizado(progreso?.niveles?.[nivel]);
}

/** Lee y normaliza el progreso guardado. Nunca lanza. */
export function leerProgreso(almacen = almacenDelNavegador()) {
  if (!almacen || typeof almacen.getItem !== 'function') return progresoVacio();
  try {
    const crudo = almacen.getItem(CLAVE_PROGRESO);
    if (!crudo) return progresoVacio();
    return normalizarProgreso(JSON.parse(crudo));
  } catch {
    return progresoVacio();
  }
}

/** Guarda el progreso. Devuelve true si se ha escrito. Nunca lanza. */
export function guardarProgreso(progreso, almacen = almacenDelNavegador()) {
  if (!almacen || typeof almacen.setItem !== 'function') return false;
  try {
    almacen.setItem(CLAVE_PROGRESO, JSON.stringify(normalizarProgreso(progreso)));
    return true;
  } catch {
    return false; // cuota llena o almacén bloqueado: se juega igual
  }
}

/**
 * Fusiona el resultado de una partida con el progreso: se queda con el RÉCORD
 * (nunca empeora) y suma una partida jugada. Devuelve un progreso NUEVO, no
 * muta el recibido.
 */
export function registrarPartida(
  progreso,
  { nivel = 'nivel', puntos = 0, monedas = 0, totalMonedas = 0, completado = false } = {}
) {
  const nuevo = normalizarProgreso(progreso);
  const previo = nivelNormalizado(nuevo.niveles[nivel]);

  nuevo.niveles[nivel] = {
    puntos: Math.max(previo.puntos, entero(puntos)),
    monedas: Math.max(previo.monedas, entero(monedas)),
    totalMonedas: Math.max(previo.totalMonedas, entero(totalMonedas)),
    completado: previo.completado || completado === true,
    partidas: previo.partidas + 1
  };
  return nuevo;
}

/** Copia normalizada: descarta niveles raros y números imposibles. */
export function normalizarProgreso(datos) {
  const progreso = progresoVacio();
  if (!datos || typeof datos !== 'object') return progreso;
  if (!datos.niveles || typeof datos.niveles !== 'object') return progreso;

  for (const [nivel, registro] of Object.entries(datos.niveles)) {
    if (typeof nivel !== 'string' || nivel.length === 0) continue;
    progreso.niveles[nivel] = nivelNormalizado(registro);
  }
  return progreso;
}

function nivelNormalizado(datos) {
  const base = { puntos: 0, monedas: 0, totalMonedas: 0, completado: false, partidas: 0 };
  if (!datos || typeof datos !== 'object') return base;
  return {
    puntos: entero(datos.puntos),
    monedas: entero(datos.monedas),
    totalMonedas: entero(datos.totalMonedas),
    completado: datos.completado === true,
    partidas: entero(datos.partidas)
  };
}

function entero(valor) {
  return Number.isFinite(valor) ? Math.max(0, Math.floor(valor)) : 0;
}
