import { idsDeNiveles, normalizarProgreso, progresoVacio, registroDe } from '../dominio.js';

/**
 * servicios/progreso.js — operaciones sobre el progreso guardado.
 *
 * `Progreso.js` (frontend) sabe normalizar y fusionar UNA partida
 * (`registrarPartida`). Aquí está lo que solo tiene sentido en el servidor:
 * fusionar dos progresos completos (sincronizar el móvil con el portátil) y
 * resumir un progreso para el ranking, sin mutar nunca lo recibido.
 */

/**
 * Une dos progresos quedándose con lo MEJOR de cada nivel.
 *
 * - puntos / monedas / totalMonedas → el máximo,
 * - completado → OR lógico (si se superó en algún sitio, está superado),
 * - partidas → el máximo, NO la suma: sincronizar no es jugar otra vez.
 *
 * Devuelve un progreso nuevo (formato v1 normalizado).
 */
export function fusionarProgreso(actual, nuevo) {
  const a = normalizarProgreso(actual);
  const b = normalizarProgreso(nuevo);
  const salida = progresoVacio();

  const ids = new Set([...Object.keys(a.niveles), ...Object.keys(b.niveles)]);
  for (const id of ids) {
    const x = registroDe(a, id);
    const y = registroDe(b, id);
    salida.niveles[id] = {
      puntos: Math.max(x.puntos, y.puntos),
      monedas: Math.max(x.monedas, y.monedas),
      totalMonedas: Math.max(x.totalMonedas, y.totalMonedas),
      completado: x.completado || y.completado,
      partidas: Math.max(x.partidas, y.partidas)
    };
  }
  return salida;
}

/** Resumen de un progreso para listados y ranking. */
export function resumenProgreso(progreso, ids = idsDeNiveles()) {
  let puntos = 0;
  let completados = 0;
  let partidas = 0;

  for (const id of ids) {
    const registro = registroDe(progreso, id);
    puntos += registro.puntos;
    partidas += registro.partidas;
    if (registro.completado) completados += 1;
  }

  return { puntos, completados, total: ids.length, partidas };
}

/** Récord de un nivel concreto tal y como lo ve la API. */
export function recordDeNivel(progreso, nivel) {
  const registro = registroDe(progreso, nivel);
  return {
    nivel,
    puntos: registro.puntos,
    monedas: registro.monedas,
    totalMonedas: registro.totalMonedas,
    completado: registro.completado,
    partidas: registro.partidas
  };
}
