import { VISTA } from '../../config/ajustes.js';
import { SUELO, filaMonedas, moneda } from './ayudas.js';

/**
 * demo.js — nivel de demostración con TODAS las mecánicas de la Fase 3 y las
 * monedas de la Fase 4.
 *
 * Es DATA pura (nada de clases ni funciones de juego): cada entrada es un objeto
 * del nivel descrito por `tipo` + propiedades. `Mundo` los fabrica con
 * `crearObjeto`, así que este archivo se podría sustituir por un JSON.
 *
 * No está en el catálogo (./index.js) a propósito: es el escenario de pruebas y
 * de depuración (el que abre `new EscenaMundo()` sin argumentos). Se supera
 * recogiendo TODAS las monedas, que es el objetivo por defecto de un nivel.
 *
 * Convención de coordenadas: (x, y) es la esquina superior izquierda; el suelo
 * del nivel está en y = 240 (30 px de grosor hasta el borde inferior).
 */
export const NIVEL_DEMO = Object.freeze({
  id: 'demo',
  nombre: 'Demostración de mecánicas',
  ancho: 960,
  alto: VISTA.ALTO,
  /** Punto de reaparición inicial, en coordenadas de "pies". */
  inicio: { x: 40, y: SUELO },
  objetos: [
    /* ── Suelo partido en dos por un foso ──────────────────────────────── */
    {
      tipo: 'plataforma',
      etiqueta: 'suelo',
      x: 0,
      y: SUELO,
      ancho: 556,
      alto: 30,
      material: 'cesped'
    },
    {
      tipo: 'plataforma',
      etiqueta: 'suelo',
      x: 624,
      y: SUELO,
      ancho: 336,
      alto: 30,
      material: 'cesped'
    },

    /* ── Checkpoint de salida ──────────────────────────────────────────── */
    { tipo: 'checkpoint', etiqueta: 'checkpoint', x: 60, y: SUELO - 34, ancho: 14, alto: 34 },

    /* ── Rampa: se sube andando, sin escalones ─────────────────────────── */
    {
      tipo: 'rampa',
      etiqueta: 'rampa',
      x: 96,
      y: SUELO,
      ancho: 64,
      alto: 32,
      pendiente: 'sube',
      material: 'cesped'
    },

    /* ── Plataforma elevada: se atraviesa desde abajo ──────────────────── */
    {
      tipo: 'plataformaElevada',
      etiqueta: 'elevada',
      x: 160,
      y: 208,
      ancho: 88,
      alto: 8,
      material: 'piedra'
    },

    /* ── Obstáculo estático: solo estorba ──────────────────────────────── */
    { tipo: 'obstaculo', etiqueta: 'obstaculo', x: 252, y: SUELO - 56, ancho: 20, alto: 56 },

    /* ── Plataforma móvil vertical (usa el recorrido desde arriba) ─────── */
    {
      tipo: 'movil',
      etiqueta: 'movil',
      x: 288,
      y: SUELO - 76,
      ancho: 48,
      alto: 8,
      eje: 'y',
      recorrido: 56,
      velocidad: 40,
      material: 'piedra'
    },

    /* ── Obstáculo móvil: se mueve y además reinicia ───────────────────── */
    {
      tipo: 'obstaculoMovil',
      etiqueta: 'obst. movil',
      x: 360,
      y: SUELO - 16,
      ancho: 16,
      alto: 16,
      eje: 'x',
      recorrido: 80,
      velocidad: 55
    },

    /* ── Superficie elástica: rebote más fuerte que el material blando ─── */
    {
      tipo: 'elastica',
      etiqueta: 'elastica',
      x: 456,
      y: SUELO - 8,
      ancho: 48,
      alto: 8
    },

    /* ── Plataforma efímera: puente sobre el foso ──────────────────────── */
    {
      tipo: 'efimera',
      etiqueta: 'efimera',
      x: 556,
      y: SUELO - 4,
      ancho: 68,
      alto: 8
    },

    /* ── Foso con agua: caer dentro reinicia ───────────────────────────── */
    {
      tipo: 'peligro',
      etiqueta: 'agua',
      x: 556,
      y: SUELO + 12,
      ancho: 68,
      alto: 18,
      forma: 'agua'
    },

    /* ── Pinchos sobre el suelo firme ──────────────────────────────────── */
    {
      tipo: 'peligro',
      etiqueta: 'pinchos',
      x: 660,
      y: SUELO - 8,
      ancho: 40,
      alto: 8,
      forma: 'pinchos'
    },

    /* ── Checkpoint intermedio (justo después del foso) ────────────────── */
    { tipo: 'checkpoint', etiqueta: 'checkpoint', x: 630, y: SUELO - 34, ancho: 14, alto: 34 },

    /* ── Muro alto: hay que saltarlo ───────────────────────────────────── */
    { tipo: 'obstaculo', etiqueta: 'muro', x: 772, y: SUELO - 64, ancho: 16, alto: 64 },

    /* ── Ascensor horizontal final ─────────────────────────────────────── */
    {
      tipo: 'movil',
      etiqueta: 'movil',
      x: 806,
      y: SUELO - 40,
      ancho: 56,
      alto: 8,
      eje: 'x',
      recorrido: 96,
      velocidad: 50,
      material: 'piedra'
    },

    /* ══ Monedas ═══════════════════════════════════════════════════════════
     * Reparto pensado para que cada tramo "premie" la mecánica que enseña:
     *   - a ras de suelo   → se cogen andando (y = SUELO - 14)
     *   - sobre una cornisa→ se cogen al subirla (14 px por encima de la cara)
     *   - en el aire       → obligan a saltar o a usar el trampolín
     * Todas están dentro del nivel y a menos de un salto de la superficie más
     * cercana; el total (21) es lo que cuenta el HUD como "monedas x/21".
     */

    // 1. Antes de la rampa: las primeras, para aprender el gesto andando.
    ...filaMonedas(64, SUELO - 14, 2, 16),

    // 2. Sobre la plataforma elevada: se recogen al subirse a ella.
    ...filaMonedas(168, 208 - 14, 3, 26),

    // 3. Encima del obstáculo: hay que saltarlo.
    moneda(262, SUELO - 56 - 14),

    // 4. En lo alto del recorrido de la plataforma móvil vertical.
    ...filaMonedas(300, 164 - 14, 2, 22),

    // 5. Arco sobre el trampolín: la recompensa del rebote fuerte.
    moneda(464, SUELO - 64),
    moneda(480, SUELO - 84),
    moneda(496, SUELO - 64),

    // 6. Sobre el puente efímero del foso: se cogen cruzando.
    ...filaMonedas(570, 236 - 28, 3, 20),

    // 7. Tras el foso, antes de los pinchos.
    moneda(642, SUELO - 14),

    // 8. Después de los pinchos: en el aire, premio al salto limpio.
    ...filaMonedas(704, SUELO - 44, 2, 18),

    // 9. Coronando el muro alto.
    moneda(780, SUELO - 64 - 14 - 4),

    // 10. Encima del ascensor final: se recogen montado.
    ...filaMonedas(820, SUELO - 40 - 14, 3, 26)
  ]
});
