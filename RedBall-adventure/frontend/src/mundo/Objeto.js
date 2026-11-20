import { solapan } from '../fisica/aabb.js';

/**
 * Objeto.js — base de TODO lo que hay en un nivel.
 *
 * IDEA CLAVE: un objeto no se define por su clase sino por las CAPACIDADES que
 * declara. El mundo y el motor preguntan "¿eres sólido?", nunca "¿eres una
 * plataforma?", así que añadir un tipo nuevo no obliga a tocar nada existente.
 *
 * CAPACIDADES (getters; por defecto null = "no lo soy"):
 *   solido        → rect { x, y, ancho, alto, material, … } que bloquea el paso
 *   superficie    → objeto con alturaEn(x) / normalEn(x) (rampas, cuestas…)
 *   peligro       → rect que reinicia al jugador (pinchos, agua, láser…)
 *   checkpoint    → rect que fija el punto de reaparición
 *   coleccionable → se puede recoger AHORA (moneda, llave, vida…); null si ya no
 *   meta          → rect de LLEGADA (portal/bandera): no bloquea ni puntúa, el
 *                   mundo solo avisa de que la has tocado
 *
 * GANCHOS opcionales:
 *   actualizar(dt, mundo)  comportamiento propio (moverse, cuenta atrás…)
 *   dibujar(ctx)           pintarse a sí mismo
 *   alPisar(cuerpo)        alguien se ha apoyado encima en este paso
 *   recoger()              lo ha tocado el jugador; true la primera vez.
 *                          Implementarlo es lo que convierte un objeto en
 *                          recogible: el mundo cuenta los que lo tienen para
 *                          saber el TOTAL del nivel, aunque ya estén cogidos.
 *   reiniciar()            volver al estado inicial
 *
 * `delta` guarda cuánto se movió el objeto en el último paso: es lo que usa el
 * mundo para transportar a quien va encima (plataformas móviles).
 *
 * Aquí no se conoce al jugador, ni la escena, ni el canvas.
 */
export class Objeto {
  constructor({
    x = 0,
    y = 0,
    ancho = 16,
    alto = 16,
    material = 'piedra',
    etiqueta = null,
    capa = 0
  } = {}) {
    this.x = x;
    this.y = y;
    this.ancho = ancho;
    this.alto = alto;
    /** Nombre del material: decide fricción y rebote (config/materiales.js). */
    this.material = material;
    /** Texto opcional que el banco de pruebas dibuja encima (solo depuración). */
    this.etiqueta = etiqueta;
    /** Orden de dibujo: 0 fondo, 1 obstáculos/peligros, 2 detalles. */
    this.capa = capa;
    /** Desplazamiento de este paso, para transportar pasajeros. */
    this.delta = { dx: 0, dy: 0 };
  }

  /** Identificador del tipo (lo declara cada subclase como `static tipo`). */
  get tipo() {
    return this.constructor.tipo ?? 'objeto';
  }

  /** Vista de la caja, para colisiones y dibujo. */
  get caja() {
    return { x: this.x, y: this.y, ancho: this.ancho, alto: this.alto };
  }

  get centroX() {
    return this.x + this.ancho / 2;
  }

  /* ───────────── Capacidades: por defecto, un objeto no es nada de esto ───── */

  get solido() {
    return null;
  }

  get superficie() {
    return null;
  }

  get peligro() {
    return null;
  }

  get checkpoint() {
    return null;
  }

  /** Capacidad: se puede recoger ahora mismo (null cuando ya no queda). */
  get coleccionable() {
    return null;
  }

  /** Capacidad: es la meta (llegada) del nivel. */
  get meta() {
    return null;
  }

  /* ───────────── Ganchos: por defecto no hacen nada ───────────────────────── */

  actualizar() {}

  dibujar() {}

  alPisar() {
    return false;
  }

  reiniciar() {}

  /** ¿La caja de este objeto se solapa con la de `cuerpo`? (zonas de peligro) */
  contiene(cuerpo) {
    return solapan(this.caja, cuerpo.caja ?? cuerpo);
  }
}
