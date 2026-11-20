import { Objeto } from '../Objeto.js';
import { registrarTipo } from '../registro.js';
import { PALETA } from '../../config/paleta.js';

/**
 * Rampa.js — cuesta inclinada por la que se sube y se baja andando.
 *
 * GEOMETRÍA: `y` es la altura de la superficie en el borde IZQUIERDO y el otro
 * borde queda en `y + desnivel`:
 *   pendiente: 'sube'  → a la derecha sube (desnivel = -alto)
 *   pendiente: 'baja'  → a la derecha baja (desnivel = +alto)
 *
 * CAPACIDAD `superficie`: expone dos funciones puras que usa el motor:
 *   alturaEn(x) = y + desnivel · (x - x0) / ancho      (null fuera del tramo)
 *   normalEn(x) = perpendicular unitaria a la pendiente
 *
 * No es un rectángulo sólido: así no bloquea el paso horizontal (se sube
 * andando, sin escalones) y se puede atravesar desde abajo.
 */
export class Rampa extends Objeto {
  static tipo = 'rampa';

  constructor({ pendiente = 'sube', desnivel = null, material = 'cesped', ...resto } = {}) {
    super({ ...resto, material });
    // dy total a lo largo del ancho. Negativo = la superficie sube hacia la derecha.
    this.desnivel = desnivel ?? (pendiente === 'baja' ? this.alto : -this.alto);
    this.pendiente = this.desnivel < 0 ? 'sube' : 'baja';
  }

  /** Capacidad: es una superficie inclinada. */
  get superficie() {
    return this;
  }

  /** Altura de la superficie en la x indicada, o null si queda fuera. */
  alturaEn(x) {
    if (!(this.ancho > 0)) return null;
    if (x < this.x || x > this.x + this.ancho) return null;
    return this.y + (this.desnivel * (x - this.x)) / this.ancho;
  }

  /** Normal (empuja hacia fuera de la pendiente); el eje Y crece hacia abajo. */
  normalEn() {
    const m = this.desnivel / Math.max(this.ancho, 1e-6);
    const norma = Math.hypot(m, 1);
    return { x: m / norma, y: -1 / norma };
  }

  /** Punto de la superficie en el borde izquierdo y en el derecho. */
  get extremos() {
    return {
      izquierda: { x: this.x, y: this.y },
      derecha: { x: this.x + this.ancho, y: this.y + this.desnivel }
    };
  }

  dibujar(ctx) {
    const x0 = this.x;
    const x1 = this.x + this.ancho;
    const y0 = this.y;
    const y1 = this.y + this.desnivel;
    // Cuña: superficie + lado vertical en el extremo más bajo.
    const esquina = y1 < y0 ? { x: x1, y: y0 } : { x: x0, y: y1 };

    ctx.fillStyle = PALETA.TIERRA;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(esquina.x, esquina.y);
    ctx.closePath();
    ctx.fill();

    // Césped sobre la pendiente
    ctx.strokeStyle = PALETA.PASTO;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

registrarTipo(Rampa.tipo, (datos) => new Rampa(datos));
