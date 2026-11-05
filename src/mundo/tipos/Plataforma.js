import { Objeto } from '../Objeto.js';
import { registrarTipo } from '../registro.js';
import { PALETA } from '../../config/paleta.js';
import { MATERIAL_POR_DEFECTO } from '../../config/materiales.js';

/**
 * Plataforma.js — bloque sólido normal y base de casi todo lo demás.
 *
 * Propiedades propias:
 *   material       fricción y rebote (config/materiales.js)
 *   unSoloSentido  se atraviesa desde abajo y desde los lados
 *   bloquea        false → decorado que no colisiona
 */

/** Material → color de la paleta. Ningún color literal fuera de config/. */
export const COLOR_SUPERFICIE = Object.freeze({
  cesped: PALETA.PASTO,
  piedra: PALETA.PIEDRA,
  hielo: PALETA.PIEDRA_HIELO,
  blando: PALETA.ORO,
  elastico: PALETA.ELASTICO,
  rompible: PALETA.TIERRA,
  agua: PALETA.AGUA
});

export class Plataforma extends Objeto {
  static tipo = 'plataforma';

  constructor({
    material = MATERIAL_POR_DEFECTO,
    unSoloSentido = false,
    bloquea = true,
    ...resto
  } = {}) {
    super({ ...resto, material });
    this.unSoloSentido = unSoloSentido;
    this.bloquea = bloquea;
  }

  /** Capacidad: es un rectángulo que bloquea. */
  get solido() {
    return this.bloquea ? this : null;
  }

  /** Color del cuerpo según el material. */
  get color() {
    return COLOR_SUPERFICIE[this.material] ?? PALETA.PIEDRA;
  }

  dibujar(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.ancho, this.alto);
    // Luz superior y sombra inferior: relieve de 2 px, estilo pixel art.
    ctx.fillStyle = PALETA.BLANCO;
    ctx.fillRect(this.x, this.y, this.ancho, 1);
    ctx.fillStyle = PALETA.NEGRO;
    ctx.fillRect(this.x, this.y + this.alto - 1, this.ancho, 1);
  }
}

registrarTipo(Plataforma.tipo, (datos) => new Plataforma(datos));
