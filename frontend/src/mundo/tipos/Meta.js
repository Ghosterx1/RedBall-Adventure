import { Objeto } from '../Objeto.js';
import { registrarTipo } from '../registro.js';
import { MUNDO } from '../../config/ajustes.js';
import { PALETA } from '../../config/paleta.js';

/**
 * Meta.js — portal/bandera de LLEGADA del nivel.
 *
 * Propiedades propias:
 *   alcanzada  (estado) true desde que el jugador la toca
 *
 * CAPACIDAD
 *   meta → ella misma. NO es sólida (se atraviesa), ni peligro, ni coleccionable:
 *   el mundo la detecta aparte y la escena decide si eso SUPERA el nivel, porque
 *   "llegar a la meta" es solo uno de los objetivos posibles (objetivo.js).
 *
 * GANCHO
 *   alcanzar() → true la primera vez, false después. Igual que Moneda.recoger()
 *   es idempotente: el mundo puede repetir el barrido de un paso sin contar dos
 *   veces la llegada (y sin reiniciar el aviso de nivel superado).
 */
export class Meta extends Objeto {
  static tipo = 'meta';

  constructor({
    ancho = MUNDO.META_ANCHO,
    alto = MUNDO.META_ALTO,
    material = 'piedra',
    capa = 2,
    ...resto
  } = {}) {
    super({ ...resto, ancho, alto, material, capa });
    this.alcanzada = false;
  }

  /** Capacidad: es la meta del nivel. */
  get meta() {
    return this;
  }

  /** Punto de apoyo (esquina inferior izquierda), para validar que se puede pisar. */
  get apoyo() {
    return { x: this.x, y: this.y + this.alto };
  }

  /** Marca la meta como alcanzada. Devuelve true solo la primera vez. */
  alcanzar() {
    if (this.alcanzada) return false;
    this.alcanzada = true;
    return true;
  }

  reiniciar() {
    this.alcanzada = false;
    this.delta = { dx: 0, dy: 0 };
  }

  /**
   * Portal de 2 postes y dintel, con banderín a cuadros. Cuando ya está
   * alcanzada se pinta apagada y sin banderín: se lee de un vistazo en 480×270.
   */
  dibujar(ctx) {
    const color = this.alcanzada ? PALETA.META_APAGADA : PALETA.META;
    const cuerpo = this.ancho - 8; // hueco interior entre postes

    // Aura interior (primero, para que los postes queden encima).
    ctx.fillStyle = this.alcanzada ? PALETA.META_APAGADA : PALETA.META_CLARA;
    ctx.fillRect(this.x + 4, this.y + 4, cuerpo, this.alto - 4);

    // Postes y dintel.
    ctx.fillStyle = color;
    ctx.fillRect(this.x, this.y, 4, this.alto);
    ctx.fillRect(this.x + this.ancho - 4, this.y, 4, this.alto);
    ctx.fillRect(this.x, this.y, this.ancho, 4);

    // Base: dos baldosas a ras de suelo.
    ctx.fillStyle = PALETA.PIEDRA;
    ctx.fillRect(this.x - 2, this.y + this.alto - 2, this.ancho + 4, 2);

    if (this.alcanzada) {
      // Cruz de "hecho": tres trazos, sin fuentes ni símbolos.
      ctx.fillStyle = PALETA.NEGRO;
      const cx = this.x + this.ancho / 2;
      const cy = this.y + this.alto / 2;
      ctx.fillRect(cx - 5, cy - 1, 4, 2);
      ctx.fillRect(cx - 2, cy + 1, 2, 2);
      ctx.fillRect(cx, cy - 1, 2, 2);
      ctx.fillRect(cx + 2, cy - 5, 2, 6);
      return;
    }

    // Banderín a cuadros de 4 px en el poste izquierdo.
    const cuadros = Math.max(2, Math.floor(this.alto / 8));
    for (let fila = 0; fila < cuadros; fila++) {
      for (let columna = 0; columna < 2; columna++) {
        const claro = (fila + columna) % 2 === 0;
        ctx.fillStyle = claro ? PALETA.BLANCO : PALETA.NEGRO;
        ctx.fillRect(this.x + 4 + columna * 4, this.y + 6 + fila * 4, 4, 4);
      }
    }
  }
}

registrarTipo(Meta.tipo, (datos) => new Meta(datos));
