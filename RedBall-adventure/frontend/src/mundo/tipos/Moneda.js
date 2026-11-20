import { Objeto } from '../Objeto.js';
import { registrarTipo } from '../registro.js';
import { JUEGO, MUNDO } from '../../config/ajustes.js';
import { PALETA } from '../../config/paleta.js';

/**
 * Moneda.js — coleccionable clásico: se toca, desaparece y da puntos.
 *
 * Propiedades propias:
 *   valor     puntos que da al recogerla (por defecto JUEGO.VALOR_MONEDA)
 *   giro      rad/s del giro sobre su eje vertical (animación)
 *   balanceo  px de flotación vertical (animación)
 *   fase      desfase de la animación; si no se indica se deduce de la x, así
 *             varias monedas del nivel no giran al unísono sin escribirlo
 *   recogida  (estado) true desde que se coge
 *   efecto    (estado) segundos que quedan del destello de recogida
 *
 * CAPACIDADES
 *   coleccionable → ella misma mientras no esté cogida; null cuando ya no está
 *   (NO es sólida, ni peligro, ni checkpoint: se atraviesa y no bloquea nada)
 *
 * GANCHO
 *   recoger() → true la primera vez, false después. Es idempotente a propósito:
 *   el mundo puede barrer varios pasos sin miedo a contar la moneda dos veces.
 *
 * ANIMACIÓN: el ángulo es función del tiempo acumulado, no del número de
 * fotogramas, así que la moneda gira igual a 60 que a 144 Hz y las pruebas
 * pueden comprobarlo. El dibujo usa |cos| como ancho aparente (truco clásico
 * para simular una moneda girando) y un balanceo vertical. Ninguna de las dos
 * cosas mueve la caja de colisión: la moneda se recoge en su sitio.
 */
export class Moneda extends Objeto {
  static tipo = 'moneda';

  constructor({
    ancho = MUNDO.MONEDA_LADO,
    alto = MUNDO.MONEDA_LADO,
    valor = JUEGO.VALOR_MONEDA,
    giro = MUNDO.MONEDA_GIRO,
    balanceo = MUNDO.MONEDA_BALANCEO,
    fase = null,
    capa = 2,
    material = 'moneda',
    ...resto
  } = {}) {
    super({ ...resto, ancho, alto, material, capa });
    this.valor = valor;
    this.giro = giro;
    this.balanceo = balanceo;
    /** Desfase estable: dos monedas vecinas no laten igual sin tocar el nivel. */
    this.fase = fase ?? ((this.x * 0.35) % (Math.PI * 2));
    this.reiniciar();
  }

  /** Capacidad: solo se puede recoger mientras no esté cogida. */
  get coleccionable() {
    return this.recogida ? null : this;
  }

  /** Ya cogida no se dibuja (las etiquetas de depuración también desaparecen). */
  get visible() {
    return !this.recogida;
  }

  /** Ángulo actual de giro (rad). */
  get angulo() {
    return this.tiempo * this.giro + this.fase;
  }

  /** Ancho aparente del giro: 0 = de canto, `ancho` = de frente. */
  get anchoVisible() {
    return Math.abs(Math.cos(this.angulo)) * this.ancho;
  }

  /** Flotación vertical (solo dibujo, no colisión). */
  get desplazamientoY() {
    if (!(this.balanceo > 0)) return 0;
    return Math.sin(this.tiempo * 1.6 + this.fase) * this.balanceo;
  }

  reiniciar() {
    this.recogida = false;
    this.efecto = 0;
    this.tiempo = 0;
    this.delta = { dx: 0, dy: 0 };
  }

  actualizar(dt) {
    this.tiempo += dt;
    if (this.efecto > 0) this.efecto = Math.max(0, this.efecto - dt);
  }

  /** Recoge la moneda. Devuelve true solo la primera vez. */
  recoger() {
    if (this.recogida) return false;
    this.recogida = true;
    this.efecto = MUNDO.MONEDA_EFECTO;
    return true;
  }

  dibujar(ctx) {
    const cx = this.centroX;
    const cy = this.y + this.alto / 2 + this.desplazamientoY;
    const alto = this.alto / 2;

    // Ya cogida: solo queda el destello que se expande y se apaga.
    if (this.recogida) {
      if (this.efecto <= 0) return;
      const avance = 1 - this.efecto / MUNDO.MONEDA_EFECTO; // 0 → 1
      ctx.strokeStyle = PALETA.ORO_CLARO;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, alto + avance * 9, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    // Giro: ellipse achatada por |cos|. Nunca llega a ancho 0 (línea invisible).
    const ancho = Math.max(0.8, this.anchoVisible) / 2;

    ctx.fillStyle = PALETA.ORO;
    ctx.beginPath();
    ctx.ellipse(cx, cy, ancho, alto, 0, 0, Math.PI * 2);
    ctx.fill();

    // Brillo: solo cuando hay superficie suficiente para verlo.
    if (ancho > 2) {
      ctx.fillStyle = PALETA.ORO_CLARO;
      ctx.beginPath();
      ctx.ellipse(cx - ancho * 0.3, cy - alto * 0.3, ancho * 0.38, alto * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = PALETA.ORO_CONTORNO;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, ancho, alto, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

registrarTipo(Moneda.tipo, (datos) => new Moneda(datos));
