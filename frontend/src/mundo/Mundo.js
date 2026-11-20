import { MUNDO } from '../config/ajustes.js';
import { barreHasta, solapan } from '../fisica/aabb.js';
import { crearObjeto, tiposRegistrados } from './tipos.js';

/**
 * Mundo.js — colección de objetos de un nivel y consultas por CAPACIDAD.
 *
 * Es el único agregador: no pregunta "¿de qué tipo eres?" sino "¿eres sólido?",
 * "¿eres peligro?", "¿se te puede recoger?". Por eso un tipo nuevo funciona sin
 * tocar esta clase.
 *
 * Orden de un paso (lo cablea la escena):
 *   1. mundo.actualizar(dt)      los objetos se mueven y publican su delta
 *   2. mundo.transportePara(j)   arrastra al jugador si va sobre algo móvil
 *   3. jugador.actualizar(…)     con solidos/superficies/limites del mundo
 *   4. mundo.revisar(j)          recogida, checkpoints, peligros, caídas
 */
export class Mundo {
  constructor({ objetos = [], ancho = 0, alto = 0, inicio = { x: 0, y: 0 }, nombre = '' } = {}) {
    this.nombre = nombre;
    this.ancho = ancho;
    this.alto = alto;
    /** Punto de reaparición inicial, en coordenadas de "pies". */
    this.inicio = { x: inicio.x ?? 0, y: inicio.y ?? 0 };
    /** Bordes del nivel: el motor no deja salir por los laterales ni el techo. */
    this.limites = Object.freeze({ ancho, alto });

    /** Objetos ya construidos o datos de nivel (se fabrican con crearObjeto). */
    this.objetos = objetos.map((objeto) =>
      objeto && typeof objeto.actualizar === 'function' ? objeto : crearObjeto(objeto)
    );

    // Orden de dibujo fijo: fondo → obstáculos/peligros → detalles.
    this.ordenados = [...this.objetos].sort((a, b) => (a.capa ?? 0) - (b.capa ?? 0));

    this.tiempo = 0;
    this.checkpoint = null;
    this.reinicios = 0;
    this.ultimoEvento = null;

    /** Caja del jugador en el paso anterior: sirve para barrer la recogida. */
    this.ultimaCajaJugador = null;

    /**
     * Cuántos objetos se pueden recoger en total, estén ya cogidos o no.
     * Se cuenta al construir el mundo porque `coleccionable` se apaga al
     * recogerlos; la marca estable es implementar el gancho `recoger()`.
     */
    this.totalColeccionables = this.objetos.filter(
      (objeto) => typeof objeto.recoger === 'function'
    ).length;
  }

  /* ───────────── Consultas por capacidad ─────────────────────────────────── */

  /** Todo lo que bloquea el paso (las efímeras ocultas devuelven null). */
  get solidos() {
    return this.objetos.filter((objeto) => objeto.solido);
  }

  /** Rampas y demás superficies inclinadas. */
  get superficies() {
    return this.objetos.filter((objeto) => objeto.superficie);
  }

  /** Zonas que reinician al jugador. */
  get peligros() {
    return this.objetos.filter((objeto) => objeto.peligro);
  }

  /** Puntos de control del nivel. */
  get checkpoints() {
    return this.objetos.filter((objeto) => objeto.checkpoint);
  }

  /** Metas (portales/banderas de llegada) del nivel. */
  get metas() {
    return this.objetos.filter((objeto) => objeto.meta);
  }

  /** Meta que ocupa `cuerpo` ahora mismo, o null. */
  metaEn(cuerpo) {
    return this.metas.find((meta) => solapan(cuerpo.caja ?? cuerpo, meta.caja)) ?? null;
  }

  /** Lo que se puede recoger AHORA (las monedas ya cogidas no aparecen). */
  get coleccionables() {
    return this.objetos.filter((objeto) => objeto.coleccionable);
  }

  /** Cuántos quedan por recoger. */
  get coleccionablesRestantes() {
    return this.coleccionables.length;
  }

  /** Objetos de un tipo concreto (para pruebas y depuración). */
  delTipo(tipo) {
    return this.objetos.filter((objeto) => objeto.tipo === tipo);
  }

  /* ───────────── Ciclo de vida ───────────────────────────────────────────── */

  actualizar(dt) {
    this.tiempo += dt;
    for (const objeto of this.objetos) objeto.actualizar(dt, this);
    return this;
  }

  /**
   * Desplazamiento del sólido que sostiene a `cuerpo` en este paso.
   * La tolerancia es el propio movimiento del objeto: si la plataforma baja
   * 1 px, los pies quedan 1 px por encima de su cara y aun así cuenta como
   * apoyo (si no, el pasajero se quedaría atrás).
   */
  transportePara(cuerpo) {
    for (const solido of this.solidos) {
      const delta = solido.delta;
      if (!delta || (delta.dx === 0 && delta.dy === 0)) continue;

      const pies = cuerpo.y + cuerpo.alto;
      if (Math.abs(pies - solido.y) > Math.abs(delta.dy) + 1) continue;
      if (cuerpo.x + cuerpo.ancho <= solido.x || cuerpo.x >= solido.x + solido.ancho) continue;

      return { dx: delta.dx, dy: delta.dy };
    }
    return { dx: 0, dy: 0 };
  }

  /** Zona de peligro que ocupa `cuerpo` ahora mismo, o null. */
  peligroEn(cuerpo) {
    return this.peligros.find((zona) => solapan(cuerpo.caja ?? cuerpo, zona.caja)) ?? null;
  }

  /** Punto de reaparición activo (último checkpoint, o el inicio del nivel). */
  reaparicion() {
    return this.checkpoint ? this.checkpoint.punto : { ...this.inicio };
  }

  /**
   * Recogida de este paso. Devuelve la lista de objetos recogidos AHORA.
   *
   * `desde` es la caja del jugador ANTES de moverse. Con ella se barre todo el
   * recorrido del paso (`aabb.barreHasta`), así que una moneda diminuta no se
   * escapa aunque el cuerpo avance más que ella entre dos fotogramas. Si no se
   * indica, se usa la caja guardada del paso anterior.
   *
   * `barridoMaximo` es el tope de cordura: un salto mayor solo puede ser un
   * teletransporte (reaparición al morir, cambio de nivel) y en ese caso se
   * mira únicamente la posición actual, para no arrasar la línea de vuelta.
   */
  recogerColeccionables(
    jugador,
    { desde = this.ultimaCajaJugador, barridoMaximo = MUNDO.RECOGIDA_BARRIDO_MAXIMO } = {}
  ) {
    const disponibles = this.coleccionables;
    if (disponibles.length === 0) return [];

    const caja = jugador.caja ?? jugador;
    const desplazamiento = desde ? { dx: caja.x - desde.x, dy: caja.y - desde.y } : { dx: 0, dy: 0 };
    const distancia = Math.hypot(desplazamiento.dx, desplazamiento.dy);
    const barre = Boolean(desde) && distancia > 1e-9 && distancia <= barridoMaximo;

    const recogidas = [];
    for (const objeto of disponibles) {
      const toca = barre
        ? barreHasta(desde, desplazamiento, objeto.caja)
        : solapan(caja, objeto.caja);
      if (toca && objeto.recoger() === true) recogidas.push(objeto);
    }
    return recogidas;
  }

  /**
   * Eventos de este paso.
   * Devuelve { monedas, checkpoint, meta, peligro, reiniciado }.
   * Si el jugador toca un peligro o se cae fuera del nivel, lo recoloca en el
   * último checkpoint: la decisión de MORIR vive aquí, no en el objeto. Lo mismo
   * con la meta: el mundo solo dice "la ha tocado"; si eso SUPERA el nivel lo
   * decide la escena con el objetivo del nivel (mundo/objetivo.js).
   */
  revisar(jugador, opciones = {}) {
    const evento = { monedas: [], checkpoint: null, meta: null, peligro: null, reiniciado: false };

    // 1. Recogida: primero, para no perder lo que se toca en el mismo paso en
    //    que te caes al agua.
    evento.monedas = this.recogerColeccionables(jugador, opciones);

    // 2. Checkpoints: se encienden al tocarlos (el último gana).
    for (const punto of this.checkpoints) {
      if (punto.activo || !solapan(jugador.caja, punto.caja)) continue;
      punto.activar();
      this.checkpoint = punto;
      evento.checkpoint = punto;
    }

    // 3. Metas: llegar basta una vez (alcanzar() es idempotente).
    for (const meta of this.metas) {
      if (meta.alcanzada || !solapan(jugador.caja, meta.caja)) continue;
      if (meta.alcanzar() === true) evento.meta = meta;
    }

    // 4. ¿Hay que reiniciar? Peligro tocado o caída por debajo del nivel.
    const zona = this.peligroEn(jugador);
    // `alto: 0` significa "nivel de alto indefinido": entonces no se juzga caída.
    const caida = this.alto > 0 && jugador.y > this.alto + MUNDO.CAIDA_MARGEN;

    if (zona || caida) {
      evento.peligro = zona ?? { motivo: 'caida' };
      this.reinicios += 1;
      const punto = this.reaparicion();
      jugador.colocar({ x: punto.x - jugador.ancho / 2, y: punto.y - jugador.alto });
      evento.reiniciado = true;
    } else {
      // 5. Aviso "me han pisado" (efímeras, rompibles…). Solo suelo, no paredes.
      for (const contacto of jugador.contactos ?? []) {
        if (contacto.eje !== 'y' || contacto.normal.y >= 0) continue;
        contacto.solido?.alPisar?.(jugador);
      }
    }

    // 6. Memoria del paso (ya con el jugador recolocado, si hubo reaparición):
    //    es el origen del barrido del paso siguiente.
    this.ultimaCajaJugador = {
      x: jugador.x,
      y: jugador.y,
      ancho: jugador.ancho,
      alto: jugador.alto
    };

    this.ultimoEvento = evento;
    return evento;
  }

  /** Vuelve al estado inicial (sin borrar los objetos). */
  reiniciar() {
    for (const objeto of this.objetos) objeto.reiniciar();
    this.tiempo = 0;
    this.checkpoint = null;
    this.reinicios = 0;
    this.ultimaCajaJugador = null;
    return this;
  }

  dibujar(ctx) {
    for (const objeto of this.ordenados) objeto.dibujar(ctx);
  }

  /** Tipos que se pueden usar en los datos de un nivel. */
  static get tipos() {
    return tiposRegistrados();
  }

  /** Azúcar para construir un mundo a partir de los datos de un nivel. */
  static desdeNivel(datos) {
    return new Mundo(datos);
  }
}
