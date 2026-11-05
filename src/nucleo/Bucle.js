import { PASO_FIJO, TOPE_TIEMPO, MAX_PASOS } from '../config/ajustes.js';

const ahora = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/**
 * Bucle.js — bucle principal con PASO FIJO y acumulador.
 *
 * Por qué paso fijo: la física debe dar siempre el mismo resultado. Si se
 * integra con el tiempo real entre cuadros, a 144 Hz el salto y el rozamiento
 * cambian respecto a 60 Hz. Con acumulador, la simulación avanza en pasos
 * idénticos de 1/60 s y el render interpola.
 *
 * - `tope` recorta saltos de tiempo brutales (pestaña minimizada).
 * - `maxPasos` evita la espiral de la muerte si el equipo no alcanza 60 pasos/s.
 * - `reloj`, `planificar` y `cancelar` son inyectables para poder probar el
 *   bucle en Node sin requestAnimationFrame.
 */
export class Bucle {
  #acumulador = 0;
  #ultimo = null;
  #id = null;
  #corriendo = false;
  #pausado = false;

  constructor({
    paso = PASO_FIJO,
    tope = TOPE_TIEMPO,
    maxPasos = MAX_PASOS,
    actualizar,
    dibujar = () => {},
    reloj = ahora,
    planificar = (cb) => globalThis.requestAnimationFrame(cb),
    cancelar = (id) => globalThis.cancelAnimationFrame(id)
  } = {}) {
    if (typeof actualizar !== 'function') {
      throw new TypeError('Bucle necesita una función "actualizar"');
    }
    if (!(paso > 0)) throw new RangeError('"paso" debe ser mayor que 0');

    this.paso = paso;
    this.tope = tope;
    this.maxPasos = maxPasos;
    this.actualizar = actualizar;
    this.dibujar = dibujar;
    this.reloj = reloj;
    this.planificar = planificar;
    this.cancelar = cancelar;

    /** Total de pasos de simulación ejecutados desde que se creó el bucle. */
    this.pasosTotales = 0;
    /** Total de cuadros renderizados. */
    this.cuadrosTotales = 0;
  }

  get corriendo() {
    return this.#corriendo;
  }

  get pausado() {
    return this.#pausado;
  }

  /** Resto de tiempo sin simular, en segundos (0 ≤ x < paso). */
  get acumulador() {
    return this.#acumulador;
  }

  iniciar() {
    if (this.#corriendo) return this;
    this.#corriendo = true;
    this.#pausado = false;
    this.#ultimo = null;
    this.#acumulador = 0;
    this.#programar();
    return this;
  }

  detener() {
    this.#corriendo = false;
    if (this.#id !== null) {
      this.cancelar(this.#id);
      this.#id = null;
    }
    return this;
  }

  /** Congela la simulación pero sigue renderizando (menús, pausa). */
  pausar() {
    this.#pausado = true;
    return this;
  }

  /** Reanuda descartando el tiempo transcurrido durante la pausa. */
  reanudar() {
    this.#pausado = false;
    this.#ultimo = null; // la próxima marca de tiempo solo sirve de referencia
    this.#acumulador = 0;
    return this;
  }

  /**
   * Núcleo determinista del bucle: avanza la simulación hasta la marca de
   * tiempo (en milisegundos) indicada. `#cuadro` lo llama con la marca de
   * requestAnimationFrame; las pruebas lo llaman a mano.
   */
  avanzarHasta(tiempoMs) {
    // El primer cuadro solo fija la referencia temporal: no simula ni dibuja,
    // porque no hay tiempo transcurrido que repartir.
    if (this.#ultimo === null) {
      this.#ultimo = tiempoMs;
      return this;
    }

    let delta = (tiempoMs - this.#ultimo) / 1000;
    this.#ultimo = tiempoMs;

    // Durante la pausa se actualiza la referencia temporal (hecho arriba) para
    // que al reanudar no se acumule todo el tiempo parado; se sigue dibujando.
    if (this.#pausado) {
      this.cuadrosTotales++;
      this.dibujar(0);
      return this;
    }

    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    if (delta > this.tope) delta = this.tope;

    this.#acumulador += delta;

    let pasos = 0;
    while (this.#acumulador >= this.paso && pasos < this.maxPasos) {
      this.actualizar(this.paso);
      this.#acumulador -= this.paso;
      this.pasosTotales++;
      pasos++;
    }

    // Si se alcanzó el techo de pasos, se descarta la deuda: no tiene sentido
    // arrastrarla y simular "a cámara rápida" durante los siguientes cuadros.
    if (pasos === this.maxPasos) this.#acumulador = 0;

    this.cuadrosTotales++;
    this.dibujar(this.#acumulador / this.paso);
    return this;
  }

  #programar() {
    this.#id = this.planificar(this.#cuadro);
  }

  #cuadro = (marcaTiempo) => {
    this.#id = null;
    if (!this.#corriendo) return;
    this.avanzarHasta(marcaTiempo);
    if (this.#corriendo) this.#programar();
  };
}
