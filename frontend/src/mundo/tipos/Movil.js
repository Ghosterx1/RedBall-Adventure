import { Plataforma } from './Plataforma.js';
import { registrarTipo } from '../registro.js';
import { Vaiven } from '../movimiento.js';
import { MUNDO } from '../../config/ajustes.js';
import { PALETA } from '../../config/paleta.js';

/**
 * Movil.js — plataforma que va y viene sobre un recorrido fijo.
 *
 * Propiedades propias:
 *   eje         'x' u 'y'
 *   recorrido   píxeles que avanza desde su posición inicial
 *   velocidad   px/s
 *   pausa       segundos que espera en cada extremo
 *   fase        desfase inicial (segundos), para que varias no vayan a la vez
 *
 * El movimiento lo resuelve `Vaiven` como función del tiempo, así que es
 * idéntico a 30, 60 o 144 Hz. Cada paso publica `delta`, y el mundo lo usa para
 * arrastrar a quien vaya encima (ver Mundo.transportePara).
 */
export class Movil extends Plataforma {
  static tipo = 'movil';

  constructor({
    eje = 'y',
    recorrido = 64,
    velocidad = MUNDO.MOVIL_VELOCIDAD,
    pausa = MUNDO.MOVIL_PAUSA,
    fase = 0,
    material = 'piedra',
    ...resto
  } = {}) {
    super({ ...resto, material });
    this.vaiven = new Vaiven({ eje, recorrido, velocidad, pausa, fase });
  }

  get eje() {
    return this.vaiven.eje;
  }

  get recorrido() {
    return this.vaiven.recorrido;
  }

  actualizar(dt) {
    this.delta = this.vaiven.paso(this, dt);
  }

  reiniciar() {
    this.vaiven.reiniciar();
    this.delta = { dx: 0, dy: 0 };
  }

  dibujar(ctx) {
    // Raíl: deja claro por dónde va a pasar la plataforma.
    const origen = this.vaiven.origen;
    if (origen) {
      ctx.fillStyle = PALETA.METAL_CLARO;
      if (this.eje === 'x') {
        ctx.fillRect(origen.x, this.y + this.alto / 2, this.recorrido + this.ancho, 1);
      } else {
        ctx.fillRect(this.x + this.ancho / 2, origen.y, 1, this.recorrido + this.alto);
      }
    }

    ctx.fillStyle = PALETA.METAL;
    ctx.fillRect(this.x, this.y, this.ancho, this.alto);

    // Franjas de peligro: se ve que la plataforma está activa.
    ctx.fillStyle = PALETA.AVISO;
    for (let x = this.x + 2; x < this.x + this.ancho - 2; x += 8) {
      ctx.fillRect(x, this.y + this.alto / 2 - 1, 4, 2);
    }

    ctx.fillStyle = PALETA.BLANCO;
    ctx.fillRect(this.x, this.y, this.ancho, 1);
  }
}

registrarTipo(Movil.tipo, (datos) => new Movil(datos));
