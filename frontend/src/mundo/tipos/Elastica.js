import { Plataforma } from './Plataforma.js';
import { registrarTipo } from '../registro.js';
import { MUNDO } from '../../config/ajustes.js';
import { PALETA } from '../../config/paleta.js';

/**
 * Elastica.js — superficie elástica que AUMENTA la fuerza del rebote.
 *
 * Propiedades propias (sobreescriben las del material):
 *   restitucion   > 1 significa que devuelve más energía de la que recibe
 *   impulsoRebote px/s extra sumados a la salida del bote
 *
 * La entidad Jugador lee esas dos propiedades del sólido al interpretar el
 * contacto, así que el trampolín no necesita código propio en la física: es
 * puro dato. El tope MUNDO.REBOTE_MAXIMO evita que la bola salga disparada.
 */
export class Elastica extends Plataforma {
  static tipo = 'elastica';

  constructor({
    restitucion = MUNDO.REBOTE_ELASTICA,
    impulsoRebote = MUNDO.IMPULSO_ELASTICA,
    material = 'elastico',
    ...resto
  } = {}) {
    super({ ...resto, material });
    this.restitucion = restitucion;
    this.impulsoRebote = impulsoRebote;
  }

  dibujar(ctx) {
    ctx.fillStyle = PALETA.ELASTICO;
    ctx.fillRect(this.x, this.y + 2, this.ancho, this.alto - 2);

    // Muelle: líneas verticales que sugieren la superficie flexible.
    ctx.fillStyle = PALETA.ELASTICO_CLARO;
    for (let x = this.x + 2; x < this.x + this.ancho - 2; x += 5) {
      ctx.fillRect(x, this.y + this.alto - 4, 2, 3);
    }

    // Cara superior brillante (por donde se bota).
    ctx.fillStyle = PALETA.ELASTICO_CLARO;
    ctx.fillRect(this.x, this.y, this.ancho, 2);
  }
}

registrarTipo(Elastica.tipo, (datos) => new Elastica(datos));
