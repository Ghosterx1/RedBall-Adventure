import { Plataforma } from './Plataforma.js';
import { registrarTipo } from '../registro.js';
import { PALETA } from '../../config/paleta.js';

/**
 * PlataformaElevada.js — plataforma atravesable desde abajo.
 *
 * Es una plataforma normal con `unSoloSentido: true`: el barrido por eje solo
 * la bloquea al CAER y viniendo desde arriba (ver fisica/Colisiones.js). Sirve
 * para repisas y cornisas donde el jugador tiene que poder saltar desde debajo.
 */
export class PlataformaElevada extends Plataforma {
  static tipo = 'plataformaElevada';

  constructor({ material = 'piedra', ...resto } = {}) {
    super({ ...resto, material, unSoloSentido: true });
  }

  dibujar(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.ancho, this.alto);
    // Borde luminoso arriba y muescas abajo: "se puede atravesar por debajo".
    ctx.fillStyle = PALETA.BLANCO;
    ctx.fillRect(this.x, this.y, this.ancho, 2);
    ctx.fillStyle = PALETA.PIEDRA_HIELO;
    for (let x = this.x + 3; x < this.x + this.ancho - 2; x += 6) {
      ctx.fillRect(x, this.y + this.alto, 3, 2);
    }
  }
}

registrarTipo(PlataformaElevada.tipo, (datos) => new PlataformaElevada(datos));
