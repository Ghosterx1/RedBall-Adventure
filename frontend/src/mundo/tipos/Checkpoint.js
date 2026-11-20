import { Objeto } from '../Objeto.js';
import { registrarTipo } from '../registro.js';
import { PALETA } from '../../config/paleta.js';

/**
 * Checkpoint.js — bandera que fija el punto de reaparición.
 *
 * Propiedades propias:
 *   activo  (estado) se enciende la primera vez que se toca
 *   punto   (derivada) punto de apoyo: centro de la bandera, a ras de suelo
 *
 * El punto se da como "pies" (no como esquina del jugador) para que el mundo no
 * necesite saber cuánto mide la bola.
 */
export class Checkpoint extends Objeto {
  static tipo = 'checkpoint';

  constructor({ ancho = 14, alto = 34, material = 'piedra', capa = 2, ...resto } = {}) {
    super({ ...resto, ancho, alto, material, capa });
    this.activo = false;
  }

  /** Capacidad: es un checkpoint. */
  get checkpoint() {
    return this;
  }

  /** Punto donde reaparecerá el jugador (centro, a ras de suelo). */
  get punto() {
    return { x: this.centroX, y: this.y + this.alto };
  }

  activar() {
    if (this.activo) return false;
    this.activo = true;
    return true;
  }

  reiniciar() {
    this.activo = false;
  }

  dibujar(ctx) {
    const color = this.activo ? PALETA.BANDERA_ACTIVA : PALETA.BANDERA;

    // Poste
    ctx.fillStyle = PALETA.NEGRO;
    ctx.fillRect(this.x, this.y, 2, this.alto);

    // Bandera triangular (ondea hacia la derecha si está activa)
    const ancho = this.activo ? this.ancho - 2 : this.ancho - 5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(this.x + 2, this.y + 1);
    ctx.lineTo(this.x + 2 + ancho, this.y + 6);
    ctx.lineTo(this.x + 2, this.y + 11);
    ctx.closePath();
    ctx.fill();

    // Base
    ctx.fillStyle = this.activo ? PALETA.BANDERA_ACTIVA : PALETA.PIEDRA;
    ctx.fillRect(this.x - 2, this.y + this.alto - 2, this.ancho, 2);
  }
}

registrarTipo(Checkpoint.tipo, (datos) => new Checkpoint(datos));
