import { NIVEL_1 } from './nivel-1.js';
import { NIVEL_2 } from './nivel-2.js';
import { NIVEL_3 } from './nivel-3.js';
import { NIVEL_4 } from './nivel-4.js';
import { NIVEL_5 } from './nivel-5.js';

/**
 * index.js — CATÁLOGO de niveles del juego.
 *
 * Este archivo es la frontera entre "el motor" y "el contenido": el motor
 * (Mundo, EscenaMundo) no conoce ningún nivel concreto, solo recibe datos. Aquí
 * se enumeran, se ordenan y se buscan por id.
 *
 * ── Añadir un nivel (4 pasos, 0 cambios en el motor) ────────────────────────
 *   1. crear src/mundo/niveles/nivel-6.js con `export const NIVEL_6 = {...}`
 *   2. importarlo arriba
 *   3. añadirlo a CONTENIDO con su `orden`
 *   4. `npm test` → pruebas/catalogo-niveles.test.js lo valida automáticamente
 *
 * ── Añadir un nivel SIN tocar código (desde datos) ──────────────────────────
 *   `crearCatalogo([...NIVELES, miNivelJson])` y pasarlo a
 *   `new EscenaMundo({ nivelId, niveles: miCatalogo })`. `NIVELES` es solo el
 *   catálogo por defecto.
 *
 * REGLAS DEL CATÁLOGO (las comprueba validarCatalogo):
 *   - ids únicos (se usan para guardar el récord de cada nivel),
 *   - orden ascendente = orden de juego = orden de desbloqueo.
 */

const CONTENIDO = [NIVEL_1, NIVEL_2, NIVEL_3, NIVEL_4, NIVEL_5];

/**
 * Construye un catálogo a partir de una lista de niveles: los ordena por
 * `orden` (y por posición si no lo tienen) y lo congela, porque el catálogo es
 * de solo lectura una vez creado.
 */
export function crearCatalogo(niveles = []) {
  return Object.freeze(
    niveles
      .map((nivel, posicion) => ({ nivel, posicion }))
      .sort((a, b) => ordenDe(a.nivel, a.posicion) - ordenDe(b.nivel, b.posicion))
      .map(({ nivel }) => nivel)
  );
}

function ordenDe(nivel, posicion = 0) {
  return Number.isFinite(nivel?.orden) ? nivel.orden : posicion;
}

/** Catálogo por defecto: los niveles del juego, en orden de juego. */
export const NIVELES = crearCatalogo(CONTENIDO);

/** Identificadores en orden de juego (lo que necesitan la progresión y el HUD). */
export function idsDeNiveles(niveles = NIVELES) {
  return niveles.map((nivel, indice) => idDeNivel(nivel, indice));
}

/** Id estable de un nivel (el suyo o, si falta, uno derivado de su posición). */
export function idDeNivel(nivel, indice = 0) {
  return nivel?.id ?? nivel?.nombre ?? `nivel-${indice + 1}`;
}

/** Nivel por id (null si no existe). */
export function nivelPorId(id, niveles = NIVELES) {
  return niveles.find((nivel, indice) => idDeNivel(nivel, indice) === id) ?? null;
}

/** Posición del nivel en el catálogo (-1 si no está). */
export function indiceDeNivel(id, niveles = NIVELES) {
  return niveles.findIndex((nivel, indice) => idDeNivel(nivel, indice) === id);
}

/**
 * Datos del nivel siguiente, o null si `id` es el último (o no está en el
 * catálogo). Con esto la escena sabe si al superar el nivel hay algo más.
 */
export function siguienteNivel(id, niveles = NIVELES) {
  const indice = indiceDeNivel(id, niveles);
  if (indice < 0 || indice + 1 >= niveles.length) return null;
  return niveles[indice + 1];
}

/** Cuántos niveles hay en el catálogo. */
export function totalNiveles(niveles = NIVELES) {
  return niveles.length;
}
