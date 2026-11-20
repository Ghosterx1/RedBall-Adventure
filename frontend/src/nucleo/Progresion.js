import { registroDe } from './Progreso.js';

/**
 * Progresion.js — reglas de DESBLOQUEO de niveles.
 *
 * Un juego "progresivo" es una regla y no un montón de banderas: el nivel 1
 * siempre está abierto y cada nivel completado abre el siguiente. Eso es TODO.
 * Por eso aquí no hay estado propio que guardar: la lista de desbloqueados se
 * DEDUCE del progreso guardado (Progreso.registroDe → `completado`) y del orden
 * del catálogo.
 *
 * Ventajas de deducirlo en vez de guardar un array `desbloqueados`:
 *  - no hay dos fuentes de verdad que se puedan contradecir,
 *  - si alguien añade un nivel en medio, los desbloqueos siguen cuadrando,
 *  - el formato guardado (v1) no cambia: cero migraciones.
 *
 * No conoce los niveles concretos: recibe una lista de IDS en orden de juego
 * (src/mundo/niveles/index.js → idsDeNiveles), así que la capa `nucleo` sigue
 * sin depender de `mundo`.
 */

/**
 * Ids desbloqueados, en orden. El primero siempre lo está; cada uno abre el
 * siguiente SOLO si está completado.
 */
export function nivelesDesbloqueados(progreso, ids = []) {
  const desbloqueados = [];
  for (const id of ids) {
    desbloqueados.push(id);
    if (!estaCompletado(progreso, id)) break;
  }
  return desbloqueados;
}

/** ¿Se puede jugar ya ese nivel? */
export function estaDesbloqueado(progreso, id, ids = []) {
  return nivelesDesbloqueados(progreso, ids).includes(id);
}

/** ¿Está superado? (el récord guardado dice que sí) */
export function estaCompletado(progreso, id) {
  return registroDe(progreso, id).completado === true;
}

/**
 * Nivel que toca jugar al arrancar: el primero desbloqueado SIN completar; si ya
 * está todo hecho, el último (para poder repetirlo). `null` si no hay catálogo.
 */
export function nivelInicial(progreso, ids = []) {
  if (ids.length === 0) return null;
  const desbloqueados = nivelesDesbloqueados(progreso, ids);
  const pendiente = desbloqueados.find((id) => !estaCompletado(progreso, id));
  return pendiente ?? desbloqueados[desbloqueados.length - 1];
}

/**
 * Siguiente nivel jugable después de `id`, o null si no hay más.
 * Un nivel recién superado abre al siguiente; si no se ha superado, `id` sigue
 * siendo el último disponible y esto devuelve null (no se puede saltar).
 */
export function siguienteDesbloqueado(progreso, id, ids = []) {
  const posicion = ids.indexOf(id);
  if (posicion < 0) return null;
  if (!estaCompletado(progreso, id)) return null;
  return ids[posicion + 1] ?? null;
}

/** Cuántos niveles del catálogo están superados. */
export function nivelesCompletados(progreso, ids = []) {
  return ids.filter((id) => estaCompletado(progreso, id)).length;
}

/** Fracción 0..1 del juego completada (para el HUD o una pantalla de título). */
export function avance(progreso, ids = []) {
  if (ids.length === 0) return 0;
  return nivelesCompletados(progreso, ids) / ids.length;
}
