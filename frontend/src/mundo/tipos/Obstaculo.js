import { Objeto } from '../Objeto.js';
import { registrarTipo } from '../registro.js';
import { PALETA } from '../../config/paleta.js';

/**
 * Obstaculo.js — bulto sólido que solo estorba (no hace daño).
 *
 * Propiedades propias:
 *   forma   'bloque' (piedra) o 'columna' (más alto que ancho)
 * Es el tipo más simple que sirve para todo lo demás: recibe daño o se mueve
 * por composición, no cambiando esta clase.
 */
export class Obstaculo extends Objeto {
  static tipo = 'obstaculo';

  constructor({ material = 'piedra', forma = 'bloque', ...resto } = {}) {
    super({ ...resto, material });
    this.forma = forma;
  }

  /** Capacidad: bloquea el paso. */
  get solido() {
    return this;
  }

  dibujar(ctx) {
    ctx.fillStyle = PALETA.PIEDRA;
    ctx.fillRect(this.x, this.y, this.ancho, this.alto);

    ctx.fillStyle = PALETA.PIEDRA_CLARA;
    ctx.fillRect(this.x, this.y, this.ancho, 2);

    // Textura de piedra: cuatro motas fijas, sin azar (el dibujo es determinista).
    ctx.fillStyle = PALETA.GRIS_APAGADO;
    ctx.fillRect(this.x + 3, this.y + 5, 2, 2);
    ctx.fillRect(this.x + this.ancho - 6, this.y + 7, 2, 2);
    ctx.fillRect(this.x + 5, this.y + this.alto - 7, 2, 2);
    ctx.fillRect(this.x + this.ancho - 7, this.y + this.alto - 6, 2, 2);

    ctx.fillStyle = PALETA.NEGRO;
    ctx.fillRect(this.x, this.y + this.alto - 1, this.ancho, 1);
  }
}

registrarTipo(Obstaculo.tipo, (datos) => new Obstaculo(datos));
