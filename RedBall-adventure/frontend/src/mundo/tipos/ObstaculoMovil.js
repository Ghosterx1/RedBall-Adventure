import { Obstaculo } from './Obstaculo.js';
import { registrarTipo } from '../registro.js';
import { Vaiven } from '../movimiento.js';
import { MUNDO } from '../../config/ajustes.js';
import { PALETA } from '../../config/paleta.js';

/**
 * ObstaculoMovil.js — obstáculo que se mueve y ADEMÁS hace daño.
 *
 * Compone dos capacidades que ya existen por separado:
 *   sólido   → lo hereda de Obstaculo (bloquea el paso)
 *   peligro  → lo añade aquí (tocar = reiniciar en el último checkpoint)
 *
 * Propiedades propias: eje, recorrido, velocidad, pausa, fase y `haceDano`
 * (false lo convierte en un simple ascensor horizontal sólido).
 */
export class ObstaculoMovil extends Obstaculo {
  static tipo = 'obstaculoMovil';

  constructor({
    eje = 'x',
    recorrido = 80,
    velocidad = MUNDO.MOVIL_VELOCIDAD,
    pausa = MUNDO.MOVIL_PAUSA,
    fase = 0,
    haceDano = true,
    material = 'piedra',
    capa = 1,
    ...resto
  } = {}) {
    super({ ...resto, material, capa });
    this.vaiven = new Vaiven({ eje, recorrido, velocidad, pausa, fase });
    this.haceDano = haceDano;
  }

  /** Capacidad: zona de peligro (si `haceDano`). */
  get peligro() {
    return this.haceDano ? this : null;
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
    const origen = this.vaiven.origen;
    if (origen) {
      ctx.fillStyle = PALETA.METAL_CLARO;
      if (this.vaiven.eje === 'x') {
        ctx.fillRect(origen.x, this.y + this.alto / 2, this.recorrido + this.ancho, 1);
      } else {
        ctx.fillRect(this.x + this.ancho / 2, origen.y, 1, this.recorrido + this.alto);
      }
    }

    super.dibujar(ctx);

    if (!this.haceDano) return;
    // Franjas de aviso: este obstáculo sí reinicia.
    ctx.fillStyle = PALETA.AVISO;
    for (let y = this.y + 2; y < this.y + this.alto - 2; y += 6) {
      ctx.fillRect(this.x + 1, y, this.ancho - 2, 2);
    }
    ctx.fillStyle = PALETA.ROJO;
    ctx.fillRect(this.x, this.y, this.ancho, 1);
  }
}

registrarTipo(ObstaculoMovil.tipo, (datos) => new ObstaculoMovil(datos));
