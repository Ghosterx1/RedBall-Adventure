import { CAMARA } from '../config/ajustes.js';
import { limitar } from '../fisica/aabb.js';

/**
 * Camara.js — ventana que sigue al jugador por un nivel más grande que la
 * pantalla. Matemática pura: no dibuja nada ni toca el DOM.
 *
 * ── Dos espacios de coordenadas (la clave de todo esto) ─────────────────────
 *   MUNDO   : el nivel entero. `x` crece hacia la derecha desde el borde
 *             izquierdo del nivel; un nivel de 2200 px tiene objetos en x=2100.
 *   PANTALLA: el lienzo (480x270). Solo existe de 0 a ANCHO-1 y de 0 a ALTO-1.
 *   La cámara es la RESTA: `pantalla = mundo - desplazamiento`. El mundo y el
 *   jugador se dibujan en coordenadas de MUNDO dentro de `aplicar()`/
 *   `restaurar()` (que hacen `ctx.translate(-x, -y)`), y el HUD se dibuja fuera,
 *   en coordenadas de PANTALLA. `mundoAPantalla`/`pantallaAMundo` hacen esa
 *   cuenta sin pasar por el lienzo (marcadores del HUD, clics, pruebas).
 *
 * - El objetivo coloca al personaje a `margenX` del borde izquierdo (38 %),
 *   así se ve más de lo que viene por delante que de lo ya recorrido.
 * - Lo mismo en vertical con `margenY` (30 %): el jugador mira hacia donde cae,
 *   no al centro exacto de la pantalla.
 * - Se limita al tamaño del mundo: nunca enseña el vacío de fuera del nivel.
 *   Si el nivel cabe entero en la vista, el desplazamiento de ese eje es 0.
 * - El suavizado es exponencial (`1 - e^(-k·dt)`), de modo que la cámara llega
 *   al mismo sitio en el mismo TIEMPO a 30, 60 o 144 Hz. Sumar una fracción fija
 *   por cuadro ataría la cámara al refresco, que es justo lo que se evitó en el
 *   bucle y en la física.
 * - Internamente la posición es decimal (suave); `desplazamiento` la redondea
 *   UNA vez para dibujar, porque media pantalla desplazada emborrona el pixel art.
 *   El redondeo no se guarda, así que no acumula error ni tiembla.
 */
export class Camara {
  constructor({
    ancho = 0,
    alto = 0,
    mundoAncho = 0,
    mundoAlto = 0,
    margenX = CAMARA.MARGEN_X,
    margenY = CAMARA.MARGEN_Y,
    suavizado = CAMARA.SUAVIZADO,
    x = 0,
    y = 0
  } = {}) {
    this.ancho = ancho;
    this.alto = alto;
    this.mundoAncho = mundoAncho;
    this.mundoAlto = mundoAlto;
    this.margenX = margenX;
    this.margenY = margenY;
    this.suavizado = suavizado;
    this.x = x;
    this.y = y;
  }

  /** Posición deseada (sin suavizar) para centrar la vista en `centro`. */
  objetivoPara(centro) {
    return {
      x: limitar(centro.x - this.ancho * this.margenX, 0, Math.max(0, this.mundoAncho - this.ancho)),
      y: limitar(centro.y - this.alto * this.margenY, 0, Math.max(0, this.mundoAlto - this.alto))
    };
  }

  /** Un paso de persecución. */
  seguir(centro, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return this;
    const objetivo = this.objetivoPara(centro);
    const factor = 1 - Math.exp(-this.suavizado * dt);
    this.x += (objetivo.x - this.x) * factor;
    this.y += (objetivo.y - this.y) * factor;
    return this;
  }

  /** Colocación instantánea (al entrar en la escena o tras un reinicio). */
  centrar(centro) {
    const objetivo = this.objetivoPara(centro);
    this.x = objetivo.x;
    this.y = objetivo.y;
    return this;
  }

  /** Posición redondeada: en pixel art una cámara a medias emborrona todo. */
  get desplazamiento() {
    return { x: Math.round(this.x), y: Math.round(this.y) };
  }

  /**
   * Punto de MUNDO → punto de PANTALLA. Es la misma cuenta que hace
   * `ctx.translate(-x, -y)` al dibujar, pero devuelta como número: sirve para
   * pintar un marcador en el HUD, para pruebas y para leer la posición real del
   * jugador en el lienzo. Redondea, como `desplazamiento`.
   */
  mundoAPantalla(punto) {
    const { x, y } = this.desplazamiento;
    return { x: Math.round(punto.x - x), y: Math.round(punto.y - y) };
  }

  /**
   * Punto de PANTALLA → punto de MUNDO (la inversa). Es lo que hace falta para
   * un clic o un toque: el evento llega en píxeles del lienzo y el mundo necesita
   * coordenadas del nivel. Con puntos enteros, `pantallaAMundo(mundoAPantalla(p))`
   * devuelve exactamente `p`, y por eso aquí NO se redondea (el redondeo se
   * decidiría en el uso, que es quien conoce la rejilla).
   */
  pantallaAMundo(punto) {
    const { x, y } = this.desplazamiento;
    return { x: punto.x + x, y: punto.y + y };
  }

  /**
   * ¿Se ve algo de esta caja? (`{ x, y, ancho, alto }` en coordenadas de mundo).
   * Es un descarte barato: dibujar lo que está fuera de la ventana no se ve y
   * cuesta lo mismo. `margen` deja pasar lo que está a punto de entrar (para
   * sombras, etiquetas o avisos que sobresalen de su caja).
   */
  visible(caja, margen = 0) {
    if (!caja) return false;
    const ancho = caja.ancho ?? 0;
    const alto = caja.alto ?? 0;
    // Se compara con la posición SIN redondear para que el descarte no cambie
    // de opinión con cada píxel de más o de menos.
    return (
      caja.x + ancho >= this.x - margen &&
      caja.x <= this.x + this.ancho + margen &&
      caja.y + alto >= this.y - margen &&
      caja.y <= this.y + this.alto + margen
    );
  }

  /**
   * Nuevo tamaño de vista o de mundo (redimensionar la ventana, cargar otro
   * nivel sin recrear la cámara). Recalcula los límites y recoloca la cámara
   * dentro de ellos para no quedarse enseñando el vacío.
   */
  redimensionar({ ancho, alto, mundoAncho, mundoAlto } = {}) {
    if (Number.isFinite(ancho) && ancho > 0) this.ancho = ancho;
    if (Number.isFinite(alto) && alto > 0) this.alto = alto;
    if (Number.isFinite(mundoAncho) && mundoAncho > 0) this.mundoAncho = mundoAncho;
    if (Number.isFinite(mundoAlto) && mundoAlto > 0) this.mundoAlto = mundoAlto;

    this.x = limitar(this.x, 0, Math.max(0, this.mundoAncho - this.ancho));
    this.y = limitar(this.y, 0, Math.max(0, this.mundoAlto - this.alto));
    return this;
  }

  aplicar(ctx) {
    const { x, y } = this.desplazamiento;
    ctx.save();
    ctx.translate(-x, -y);
    return this;
  }

  restaurar(ctx) {
    ctx.restore();
    return this;
  }
}
