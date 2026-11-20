import { Objeto } from '../Objeto.js';
import { registrarTipo } from '../registro.js';
import { PALETA } from '../../config/paleta.js';

/**
 * Peligro.js — zona que reinicia al jugador (pinchos, agua, láser…).
 *
 * Propiedades propias:
 *   forma   'pinchos' | 'agua' | 'banda'
 *   motivo  texto para la escena/HUD ('pinchos', 'agua'…)
 *
 * NO es sólida a propósito: se puede entrar (y normalmente se cae dentro). La
 * capacidad `peligro` es un rectángulo; quien decide qué hacer al tocarlo es el
 * mundo (reaparecer en el último checkpoint), no este objeto.
 */
export class Peligro extends Objeto {
  static tipo = 'peligro';

  constructor({ forma = 'pinchos', motivo = null, material = 'agua', capa = 1, ...resto } = {}) {
    super({ ...resto, material, capa });
    this.forma = forma;
    this.motivo = motivo ?? forma;
  }

  /** Capacidad: zona de peligro. */
  get peligro() {
    return this;
  }

  dibujar(ctx) {
    if (this.forma === 'agua') return this.#dibujarAgua(ctx);
    if (this.forma === 'banda') return this.#dibujarBanda(ctx);
    return this.#dibujarPinchos(ctx);
  }

  /** Dientes de sierra: triángulos de 8 px de base. */
  #dibujarPinchos(ctx) {
    ctx.fillStyle = PALETA.PINCHO_OSCURO;
    ctx.fillRect(this.x, this.y + this.alto - 3, this.ancho, 3);

    ctx.fillStyle = PALETA.PINCHO;
    const base = this.y + this.alto - 3;
    for (let x = this.x; x + 6 <= this.x + this.ancho; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x + 4, this.y);
      ctx.lineTo(x + 8, base);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Agua: cuerpo azul con oleaje claro en la superficie. */
  #dibujarAgua(ctx) {
    ctx.fillStyle = PALETA.AGUA;
    ctx.fillRect(this.x, this.y, this.ancho, this.alto);

    ctx.fillStyle = PALETA.AGUA_CLARA;
    ctx.fillRect(this.x, this.y, this.ancho, 2);
    for (let x = this.x + 4; x < this.x + this.ancho - 2; x += 12) {
      ctx.fillRect(x, this.y + 6, 6, 2);
    }

    ctx.fillStyle = PALETA.AGUA_OSCURA;
    ctx.fillRect(this.x, this.y + this.alto - 4, this.ancho, 4);
  }

  /** Banda de aviso: para zonas invisibles o láseres. */
  #dibujarBanda(ctx) {
    ctx.fillStyle = PALETA.PELIGRO_SUAVE;
    ctx.fillRect(this.x, this.y, this.ancho, this.alto);
    ctx.fillStyle = PALETA.ROJO;
    for (let x = this.x; x < this.x + this.ancho; x += 8) {
      ctx.fillRect(x, this.y, 4, this.alto);
    }
  }
}

registrarTipo(Peligro.tipo, (datos) => new Peligro(datos));
