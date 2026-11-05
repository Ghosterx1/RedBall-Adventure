import { MUNDO } from '../config/ajustes.js';

/**
 * movimiento.js — matemática del vaivén (ida y vuelta) de los objetos móviles.
 *
 * Se resuelve con una FUNCIÓN del tiempo acumulado, no sumando velocidad a la
 * posición: así el recorrido es idéntico a cualquier tasa de refresco y no
 * arrastra error de redondeo. La posición `s` recorre el segmento [0, L].
 *
 * Un ciclo completo dura 2·(tramo + pausa):
 *   [0, tramo)             ida     s: 0 → L
 *   [tramo, tramo+pausa)   pausa   s = L
 *   […, +tramo)            vuelta  s: L → 0
 *   resto                  pausa   s = 0
 */

/** Precalcula los tiempos de un vaivén de recorrido L a velocidad v. */
export function crearVaiven({
  recorrido = 0,
  velocidad = MUNDO.MOVIL_VELOCIDAD,
  pausa = MUNDO.MOVIL_PAUSA
} = {}) {
  const largo = Math.max(0, recorrido);
  const rapidez = Math.max(1e-6, Math.abs(velocidad));
  const espera = Math.max(0, pausa);
  const tramo = largo / rapidez;
  return {
    recorrido: largo,
    velocidad: rapidez,
    pausa: espera,
    tramo,
    periodo: 2 * (tramo + espera)
  };
}

/** Posición `s` ∈ [0, recorrido] en el instante `tiempo` (segundos). */
export function posicionVaiven(vaiven, tiempo = 0) {
  const { recorrido, velocidad, pausa, tramo, periodo } = vaiven;
  if (!(recorrido > 0) || !(periodo > 0)) return 0;

  let t = tiempo % periodo;
  if (t < 0) t += periodo;

  if (t < tramo) return t * velocidad;
  t -= tramo;
  if (t < pausa) return recorrido;
  t -= pausa;
  if (t < tramo) return recorrido - t * velocidad;
  return 0;
}

/**
 * Mueve `objeto` en vaivén y devuelve cuánto se ha desplazado en este paso.
 * El origen se fija la primera vez, así que el objeto puede crearse en
 * cualquier punto del recorrido.
 */
export class Vaiven {
  constructor({
    eje = 'x',
    recorrido = 0,
    velocidad = MUNDO.MOVIL_VELOCIDAD,
    pausa = MUNDO.MOVIL_PAUSA,
    fase = 0
  } = {}) {
    this.eje = eje === 'y' ? 'y' : 'x';
    this.ciclo = crearVaiven({ recorrido, velocidad, pausa });
    this.fase = fase;
    this.tiempo = 0;
    this.origen = null;
  }

  get recorrido() {
    return this.ciclo.recorrido;
  }

  get periodo() {
    return this.ciclo.periodo;
  }

  /** Avanza `dt` y recoloca el objeto. Devuelve { dx, dy }. */
  paso(objeto, dt) {
    if (!this.origen) this.origen = { x: objeto.x, y: objeto.y };
    this.tiempo += dt;
    const s = posicionVaiven(this.ciclo, this.tiempo + this.fase);
    const destinoX = this.eje === 'x' ? this.origen.x + s : objeto.x;
    const destinoY = this.eje === 'y' ? this.origen.y + s : objeto.y;
    const dx = destinoX - objeto.x;
    const dy = destinoY - objeto.y;
    objeto.x = destinoX;
    objeto.y = destinoY;
    return { dx, dy };
  }

  /** Vuelve al principio del ciclo y olvida el origen. */
  reiniciar() {
    this.tiempo = 0;
    this.origen = null;
  }
}
