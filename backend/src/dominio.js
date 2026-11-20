import {
  normalizarProgreso,
  progresoVacio,
  registroDe,
  registrarPartida
} from '../../frontend/src/nucleo/Progreso.js';

import { NIVELES, idDeNivel, nivelPorId } from '../../frontend/src/mundo/niveles/index.js';

/**
 * dominio.js — puente entre el backend y el DOMINIO del juego.
 *
 * El servidor NO reimplementa las reglas del juego: importa los módulos
 * **puros** del frontend (los que no tocan `document`, `canvas` ni
 * `localStorage`). Así hay una sola fuente de verdad:
 *
 *   - `Progreso.js`  → formato v1, normalización y fusión de récords,
 *   - `niveles/`     → catálogo real de niveles (ids, nombres, objetos).
 *
 * Consecuencias (documentadas también en docs/BACKEND.md):
 *   1. La dirección de la dependencia es SIEMPRE backend → frontend/src puro.
 *      El frontend jamás importa nada de `backend/`.
 *   2. Esos módulos no deben empezar a tocar el DOM: las pruebas del backend y
 *      las de integración lo detectan.
 *   3. El backend necesita el código del frontend para arrancar. En Docker se
 *      copian las dos carpetas; no está pensado para desplegarse suelto.
 */
export {
  normalizarProgreso,
  progresoVacio,
  registroDe,
  registrarPartida,
  NIVELES,
  idDeNivel,
  nivelPorId
};

/** Ids del catálogo, en orden de juego. */
export function idsDeNiveles(niveles = NIVELES) {
  return niveles.map((nivel, indice) => idDeNivel(nivel, indice));
}

/** ¿Existe ese nivel en el catálogo? */
export function existeNivel(id, niveles = NIVELES) {
  return nivelPorId(id, niveles) !== null;
}

/** Cuántas monedas tiene un nivel, contadas de su propia data. */
export function contarMonedas(nivel) {
  const objetos = Array.isArray(nivel?.objetos) ? nivel.objetos : [];
  return objetos.filter((objeto) => objeto?.tipo === 'moneda').length;
}

/**
 * Catálogo en formato API: lo justo para pintar una lista o validar en el
 * cliente. No expone los objetos del nivel (eso es contenido del juego).
 */
export function catalogoNiveles(niveles = NIVELES) {
  return niveles.map((nivel, indice) => ({
    id: idDeNivel(nivel, indice),
    numero: indice + 1,
    orden: Number.isFinite(nivel?.orden) ? nivel.orden : indice,
    nombre: nivel?.nombre ?? idDeNivel(nivel, indice),
    dificultad: Number.isFinite(nivel?.dificultad) ? nivel.dificultad : 1,
    monedas: contarMonedas(nivel),
    ancho: Number.isFinite(nivel?.ancho) ? nivel.ancho : null,
    alto: Number.isFinite(nivel?.alto) ? nivel.alto : null,
    objetivo: nivel?.objetivo?.tipo ?? 'meta'
  }));
}
