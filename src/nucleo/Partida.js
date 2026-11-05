/**
 * Partida.js — QUÉ pantalla se está viendo (máquina de estados de la interfaz).
 *
 * El juego tiene seis pantallas y no todas se pueden alcanzar desde cualquier
 * otra: no se puede "ganar" desde el menú de pausa ni reanudar desde la pantalla
 * de derrota. Esa tabla vive aquí, en un objeto congelado, y `ir()` la aplica.
 *
 * Ventajas frente a un puñado de booleanos (`pausado`, `enMenu`, `haGanado`…):
 *  - no existe un estado imposible (dos banderas a la vez),
 *  - la interfaz solo pregunta `partida.pantalla` para saber qué overlay
 *    enseñar, y el bucle solo pregunta `congelada` para saber si simular,
 *  - las transiciones se prueban sin DOM, sin canvas y sin niveles.
 *
 * Este módulo NO toca el DOM ni el bucle: `main.js` traduce cada cambio de
 * pantalla a lo que toque (pausar el bucle, enseñar el overlay, cambiar escena).
 */

/** Pantallas posibles. */
export const PANTALLAS = Object.freeze({
  TITULO: 'titulo',
  NIVELES: 'niveles',
  JUEGO: 'juego',
  PAUSA: 'pausa',
  VICTORIA: 'victoria',
  DERROTA: 'derrota'
});

const VALORES = Object.values(PANTALLAS);

/**
 * Desde dónde se puede ir a dónde. Todo lo que no esté en la lista se rechaza.
 * `juego` aparece como destino de `titulo`/`niveles` porque es "empezar a jugar".
 */
export const TRANSICIONES = Object.freeze({
  [PANTALLAS.TITULO]: Object.freeze([PANTALLAS.NIVELES, PANTALLAS.JUEGO]),
  [PANTALLAS.NIVELES]: Object.freeze([PANTALLAS.TITULO, PANTALLAS.JUEGO]),
  [PANTALLAS.JUEGO]: Object.freeze([
    PANTALLAS.PAUSA,
    PANTALLAS.VICTORIA,
    PANTALLAS.DERROTA,
    PANTALLAS.NIVELES,
    PANTALLAS.TITULO
  ]),
  [PANTALLAS.PAUSA]: Object.freeze([PANTALLAS.JUEGO, PANTALLAS.NIVELES, PANTALLAS.TITULO]),
  [PANTALLAS.VICTORIA]: Object.freeze([PANTALLAS.JUEGO, PANTALLAS.NIVELES, PANTALLAS.TITULO]),
  [PANTALLAS.DERROTA]: Object.freeze([PANTALLAS.JUEGO, PANTALLAS.NIVELES, PANTALLAS.TITULO])
});

export class Partida {
  #pantalla = PANTALLAS.TITULO;

  /**
   * @param {object} opciones
   * @param {string} [opciones.pantalla] pantalla inicial (por defecto, el título)
   */
  constructor({ pantalla = PANTALLAS.TITULO } = {}) {
    this.#pantalla = VALORES.includes(pantalla) ? pantalla : PANTALLAS.TITULO;
  }

  /** Pantalla actual. */
  get pantalla() {
    return this.#pantalla;
  }

  /** ¿Se está jugando (con o sin el menú de pausa encima)? */
  get enJuego() {
    return this.#pantalla === PANTALLAS.JUEGO || this.#pantalla === PANTALLAS.PAUSA;
  }

  /** ¿Hay una partida terminada (victoria o derrota) en pantalla? */
  get terminada() {
    return this.#pantalla === PANTALLAS.VICTORIA || this.#pantalla === PANTALLAS.DERROTA;
  }

  /**
   * ¿El bucle debe estar parado? Todo lo que no sea JUGAR congela la simulación:
   * los menús no pueden mover al jugador y la pausa tiene que congelar el nivel.
   */
  get congelada() {
    return this.#pantalla !== PANTALLAS.JUEGO;
  }

  /** ¿Es legal pasar a esa pantalla desde la actual? (irse a la misma, sí) */
  puedeIr(pantalla) {
    if (!VALORES.includes(pantalla)) return false;
    return pantalla === this.#pantalla || TRANSICIONES[this.#pantalla].includes(pantalla);
  }

  /**
   * Cambia de pantalla si la transición es legal.
   * Devuelve true si se ha cambiado (o ya se estaba en ella) y false si se ha
   * ignorado: un botón pulsado en el momento equivocado no puede romper el flujo.
   */
  ir(pantalla) {
    if (!this.puedeIr(pantalla)) return false;
    this.#pantalla = pantalla;
    return true;
  }

  /* Atajos con nombre: la interfaz y main.js leen mejor que `ir(...)`. */
  jugar() {
    return this.ir(PANTALLAS.JUEGO);
  }

  pausar() {
    return this.ir(PANTALLAS.PAUSA);
  }

  reanudar() {
    return this.ir(PANTALLAS.JUEGO);
  }

  ganar() {
    return this.ir(PANTALLAS.VICTORIA);
  }

  perder() {
    return this.ir(PANTALLAS.DERROTA);
  }

  verNiveles() {
    return this.ir(PANTALLAS.NIVELES);
  }

  volverAlTitulo() {
    return this.ir(PANTALLAS.TITULO);
  }
}
