import { PALETA } from '../config/paleta.js';

/**
 * particulas.js — chispas de la recogida y polvo de los botes.
 *
 * Es un sistema de partículas mínimo y PIXEL ART:
 *  - cada partícula es un CUADRADO (no un círculo ni un degradado),
 *  - no se usa transparencia: la partícula se hace más pequeña al morir, así
 *    encaja con el resto del dibujo, que tampoco usa `globalAlpha`,
 *  - se redondea la posición al pintar, para que todo quede en la rejilla del
 *    lienzo y nada se vea "a medias".
 *
 * Es puro salvo por `dibujar(ctx)`: no conoce el juego, ni la escena, ni los
 * objetos. La escena le dice "estalla en (x, y) de color oro" y él se encarga.
 * El generador de azar se inyecta (`aleatorio`) para que las pruebas sean
 * deterministas y no dependan de Math.random.
 */

/** Cuántas partículas se guardan como máximo (las más viejas dejan sitio). */
const MAXIMO_POR_DEFECTO = 96;

export class Particulas {
  constructor({ maximo = MAXIMO_POR_DEFECTO, aleatorio = Math.random } = {}) {
    this.maximo = Math.max(1, entero(maximo, MAXIMO_POR_DEFECTO));
    this.aleatorio = typeof aleatorio === 'function' ? aleatorio : Math.random;
    /** Partículas vivas, de la más vieja a la más nueva. */
    this.lista = [];
  }

  /** Cuántas partículas hay ahora mismo (lo comprueban las pruebas). */
  get vivas() {
    return this.lista.length;
  }

  /** Borra todo (al cambiar de nivel o reaparecer). */
  limpiar() {
    this.lista.length = 0;
    return this;
  }

  /**
   * Estallido en todas las direcciones: la chispa de una moneda recogida.
   * @returns {number} cuántas partículas se han creado
   */
  estallido({
    x = 0,
    y = 0,
    colores = [PALETA.ORO, PALETA.ORO_CLARO],
    cuantas = 6,
    velocidad = 90,
    duracion = 0.45,
    tamano = 2,
    gravedad = 420
  } = {}) {
    return this.#emitir({ x, y, colores, cuantas, velocidad, duracion, tamano, gravedad }, 0, Math.PI * 2);
  }

  /**
   * Semicírculo hacia ARRIBA: el polvo de un aterrizaje o de un bote elástico.
   * En el lienzo la Y crece hacia abajo, así que "arriba" es `sin(ángulo) < 0`.
   */
  polvo({
    x = 0,
    y = 0,
    colores = [PALETA.PIEDRA_CLARA, PALETA.BLANCO],
    cuantas = 4,
    velocidad = 60,
    duracion = 0.3,
    tamano = 2,
    gravedad = 260
  } = {}) {
    return this.#emitir({ x, y, colores, cuantas, velocidad, duracion, tamano, gravedad }, Math.PI, Math.PI * 2);
  }

  /**
   * Un paso de simulación. Integra con Euler (igual que la física: primero la
   * velocidad, después la posición) y retira las partículas agotadas.
   */
  actualizar(dt) {
    if (!(dt > 0)) return this;
    for (const particula of this.lista) {
      particula.vida -= dt;
      particula.vy += particula.gravedad * dt;
      particula.x += particula.vx * dt;
      particula.y += particula.vy * dt;
    }
    if (this.lista.some((particula) => particula.vida <= 0)) {
      this.lista = this.lista.filter((particula) => particula.vida > 0);
    }
    return this;
  }

  /** Pinta los cuadrados, del más viejo al más nuevo (orden estable, sin z-fighting). */
  dibujar(ctx) {
    for (const particula of this.lista) {
      const resto = Math.max(0, particula.vida / particula.duracion);
      const lado = Math.max(1, Math.round(particula.tamano * resto));
      ctx.fillStyle = particula.color;
      ctx.fillRect(Math.round(particula.x), Math.round(particula.y), lado, lado);
    }
    return this;
  }

  /** Crea `cuantas` partículas repartidas en el abanico [desde, hasta]. */
  #emitir({ x, y, colores, cuantas, velocidad, duracion, tamano, gravedad }, desde, hasta) {
    const total = Math.max(0, entero(cuantas, 0));
    const gama = Array.isArray(colores) && colores.length > 0 ? colores : [PALETA.ORO];
    const rapidez = Math.max(0, numero(velocidad, 90));
    const vidaBase = Math.max(0.05, numero(duracion, 0.45));
    const lado = Math.max(1, numero(tamano, 2));
    const caida = numero(gravedad, 0);
    const origenX = numero(x, 0);
    const origenY = numero(y, 0);

    for (let i = 0; i < total; i++) {
      if (this.lista.length >= this.maximo) this.lista.shift(); // la más vieja deja sitio

      const angulo = desde + this.aleatorio() * (hasta - desde);
      const fuerza = rapidez * (0.45 + 0.55 * this.aleatorio());
      const vida = vidaBase * (0.7 + 0.3 * this.aleatorio());

      this.lista.push({
        x: origenX,
        y: origenY,
        vx: Math.cos(angulo) * fuerza,
        vy: Math.sin(angulo) * fuerza,
        gravedad: caida,
        duracion: vida,
        vida,
        tamano: lado,
        color: gama[entero(this.aleatorio() * gama.length, 0) % gama.length]
      });
    }
    return total;
  }
}

/** Número finito o el valor por defecto. */
function numero(valor, porDefecto) {
  return Number.isFinite(valor) ? valor : porDefecto;
}

/** Entero ≥ 0 o el valor por defecto. */
function entero(valor, porDefecto) {
  return Number.isFinite(valor) ? Math.max(0, Math.floor(valor)) : porDefecto;
}
