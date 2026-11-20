/**
 * BusEventos.js — canal lateral de comunicación entre capas.
 *
 * Regla de arquitectura: es la ÚNICA vía de comunicación horizontal permitida.
 * Sirve para que, por ejemplo, el HUD se entere de una moneda sin que la física
 * o las colisiones importen la escena ni el HUD.
 *
 * No sustituye a las llamadas directas en sentido vertical (Escena → Sistema).
 */
export class BusEventos {
  #oyentes = new Map();

  /** Suscribe `fn` al evento. Devuelve la función para cancelar la suscripción. */
  on(evento, fn) {
    if (typeof fn !== 'function') throw new TypeError('El oyente debe ser una función');
    if (!this.#oyentes.has(evento)) this.#oyentes.set(evento, new Set());
    this.#oyentes.get(evento).add(fn);
    return () => this.off(evento, fn);
  }

  /** Suscribe `fn` una sola vez. */
  una(evento, fn) {
    const envoltorio = (datos) => {
      this.off(evento, envoltorio);
      fn(datos);
    };
    return this.on(evento, envoltorio);
  }

  off(evento, fn) {
    const conjunto = this.#oyentes.get(evento);
    if (!conjunto) return this;
    conjunto.delete(fn);
    if (conjunto.size === 0) this.#oyentes.delete(evento);
    return this;
  }

  /**
   * Emite un evento. Se copia la lista de oyentes antes de recorrerla para que
   * un oyente pueda darse de baja (o suscribirse) sin romper la iteración.
   */
  emitir(evento, datos) {
    const conjunto = this.#oyentes.get(evento);
    if (!conjunto) return this;
    for (const fn of [...conjunto]) {
      try {
        fn(datos);
      } catch (error) {
        console.error(`[BusEventos] Error en el oyente de "${evento}"`, error);
      }
    }
    return this;
  }

  /** Nº de oyentes de un evento (útil en pruebas). */
  contar(evento) {
    return this.#oyentes.get(evento)?.size ?? 0;
  }

  limpiar() {
    this.#oyentes.clear();
    return this;
  }
}
