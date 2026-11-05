import { FISICA, MUNDO, PASO_FIJO } from '../config/ajustes.js';
import { material, MATERIAL_POR_DEFECTO } from '../config/materiales.js';
import * as Fisica from '../fisica/Fisica.js';

/**
 * Jugador.js — la pelota roja: estado + reglas de movimiento.
 *
 * Aquí viven las "sensaciones" (coyote time, buffer de salto, salto variable,
 * impulso), no la mecánica genérica: la gravedad, la integración y las
 * colisiones están en src/fisica/ y se usan tal cual.
 *
 * Recibe el control como un OBJETO, no como `Entrada`, para poder probarlo sin
 * teclado ni DOM:
 *
 *   jugador.actualizar(dt, {
 *     control: { eje, salto, saltoMantenido, impulso },
 *     solidos,
 *     limites: { ancho, alto }
 *   })
 *
 *   salto          → pulsado EN ESTE paso (flanco)
 *   saltoMantenido → sigue pulsado (permite el salto alto)
 *   impulso        → pulsado en este paso (flanco)
 */

const CONTROL_VACIO = Object.freeze({
  eje: 0,
  salto: false,
  saltoMantenido: false,
  impulso: false
});

/** Pasos enteros que dura el impulso (así la distancia es exacta y determinista). */
const PASOS_IMPULSO = Math.max(1, Math.round(FISICA.IMPULSO_DURACION / PASO_FIJO));

export class Jugador {
  constructor({ x = 0, y = 0, ancho = 24, alto = 24, vx = 0, vy = 0, enSuelo = false } = {}) {
    this.x = x;
    this.y = y;
    this.ancho = ancho;
    this.alto = alto;
    this.vx = vx;
    this.vy = vy;

    /** ¿Toca suelo en este instante? Se recalcula en cada paso. */
    this.enSuelo = enSuelo;
    /** ¿Golpeó un techo en el último paso? */
    this.enTecho = false;
    /** -1 si empuja una pared a la derecha, 1 si es a la izquierda, 0 si no. */
    this.empujado = 0;
    /** Hacia dónde mira (1 derecha, -1 izquierda). */
    this.mirando = 1;

    /** Segundos de gracia que quedan para poder saltar sin estar en el suelo. */
    this.coyote = enSuelo ? FISICA.COYOTE_TIEMPO : 0;
    /** Segundos que queda recordado un salto pulsado antes de poder saltar. */
    this.bufferSalto = 0;
    /** ¿Ya se recortó este salto por soltar el botón? */
    this.corteAplicado = true;

    this.impulsoRestante = 0; // pasos de impulso que quedan
    this.enfriamientoImpulso = 0; // segundos hasta poder volver a impulsarse
    this.direccionImpulso = 1;

    this.materialSuelo = MATERIAL_POR_DEFECTO;
    this.contactos = [];

    // Eventos del último paso, para la escena (partículas, sonido, HUD).
    this.aterrizo = false;
    this.reboto = false;
    this.saltoHecho = false;
  }

  /** Vista de solo lectura como caja, para colisiones y dibujo. */
  get caja() {
    return { x: this.x, y: this.y, ancho: this.ancho, alto: this.alto };
  }

  /** Centro de la bola (para dibujar y para la cámara). */
  get centro() {
    return { x: this.x + this.ancho / 2, y: this.y + this.alto / 2 };
  }

  /** Módulo de la velocidad (px/s). */
  get velocidad() {
    return Math.hypot(this.vx, this.vy);
  }

  /** ¿Está en pleno impulso? Durante el impulso se ignora la fricción. */
  get enImpulso() {
    return this.impulsoRestante > 0;
  }

  /** Lleva al jugador a una posición concreta y olvida el estado de salto. */
  colocar({ x = this.x, y = this.y } = {}) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.enSuelo = false;
    this.enTecho = false;
    this.empujado = 0;
    this.coyote = 0;
    this.bufferSalto = 0;
    this.corteAplicado = true;
    this.impulsoRestante = 0;
    this.enfriamientoImpulso = 0;
    this.contactos = [];
    return this;
  }

  /**
   * Un paso de simulación. `dt` siempre vale 1/60 (paso fijo del Bucle).
   *
   * ORDEN (importante para que el salto mida siempre lo mismo):
   *   1 temporizadores (coyote, buffer, enfriamiento)
   *   2 movimiento horizontal (impulso / aceleración / fricción)
   *   3 salto y corte de salto
   *   4 gravedad y límites de velocidad
   *   5 desplazamiento + colisiones
   *   6 interpretación de los contactos (suelo, techo, pared, rebote)
   */
  actualizar(
    dt,
    { control = CONTROL_VACIO, solidos = [], superficies = [], limites = null } = {}
  ) {
    const c = control ?? CONTROL_VACIO;
    this.aterrizo = false;
    this.reboto = false;
    this.saltoHecho = false;

    /* 1. Temporizadores ---------------------------------------------------- */
    if (this.enSuelo) {
      this.coyote = FISICA.COYOTE_TIEMPO;
      this.corteAplicado = true;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }
    this.bufferSalto = c.salto ? FISICA.SALTO_BUFFER : Math.max(0, this.bufferSalto - dt);

    /* 2. Horizontal -------------------------------------------------------- */
    if (this.enImpulso) {
      this.vx = this.direccionImpulso * FISICA.IMPULSO_VELOCIDAD;
      this.impulsoRestante -= 1;
    } else if (c.eje) {
      this.mirando = c.eje > 0 ? 1 : -1;
      Fisica.acelerar(this, c.eje, dt);
    } else {
      // En el suelo manda la fricción del material; en el aire casi no frena.
      const factor = this.enSuelo ? material(this.materialSuelo).friccion : FISICA.AMORTIGUAMIENTO_AIRE;
      Fisica.frenar(this, dt, factor);
    }

    /* 3. Impulso y salto --------------------------------------------------- */
    this.enfriamientoImpulso = Math.max(0, this.enfriamientoImpulso - dt);
    if (c.impulso && !this.enImpulso && this.enfriamientoImpulso <= 0) {
      this.direccionImpulso = c.eje ? (c.eje > 0 ? 1 : -1) : this.mirando;
      this.mirando = this.direccionImpulso;
      this.impulsoRestante = PASOS_IMPULSO;
      this.enfriamientoImpulso = FISICA.IMPULSO_ENFRIAMIENTO;
      this.vx = this.direccionImpulso * FISICA.IMPULSO_VELOCIDAD;
    }

    if (this.bufferSalto > 0 && (this.enSuelo || this.coyote > 0)) {
      this.vy = FISICA.SALTO_VELOCIDAD;
      this.bufferSalto = 0;
      this.coyote = 0;
      this.enSuelo = false;
      this.corteAplicado = false;
      this.saltoHecho = true;
    }

    // Salto variable: si se suelta el botón subiendo, se recorta la altura una vez.
    if (!this.corteAplicado && !c.saltoMantenido && this.vy < 0) {
      this.vy = Math.max(this.vy, FISICA.SALTO_VELOCIDAD * FISICA.CORTE_SALTO);
      this.corteAplicado = true;
    }

    /* 4. Gravedad y límites ------------------------------------------------ */
    Fisica.aplicarGravedad(this, dt);
    Fisica.limitarVelocidad(this, {
      horizontal: this.enImpulso ? FISICA.IMPULSO_VELOCIDAD : FISICA.VELOCIDAD_MAXIMA
    });

    /* 5. Desplazamiento + colisiones --------------------------------------- */
    const estabaEnSuelo = this.enSuelo;
    const contactos = Fisica.desplazar(this, dt, solidos, { limites, superficies });
    this.contactos = contactos;
    this.enTecho = false;
    this.empujado = 0;
    this.enSuelo = false;

    /* 6. Interpretación de los contactos ----------------------------------- */
    for (const contacto of contactos) {
      if (contacto.eje === 'x') {
        this.empujado = -contacto.normal.x;
        continue;
      }

      if (contacto.normal.y > 0) {
        this.enTecho = true;
        continue;
      }

      // Contacto por abajo = suelo. El material decide si se aterriza o se bota,
      // pero el OBJETO puede sobreescribirlo con `restitucion` (rebote más
      // fuerte) e `impulsoRebote` (px/s extra). Así una superficie elástica
      // empuja más sin tocar el motor ni la clase.
      this.materialSuelo = contacto.solido?.material ?? MATERIAL_POR_DEFECTO;
      const mat = material(this.materialSuelo);
      const impacto = Math.abs(contacto.impacto?.vy ?? 0);
      const restitucion = contacto.solido?.restitucion ?? mat.restitucion;
      const extra = contacto.solido?.impulsoRebote ?? 0;

      if (restitucion > 0 && impacto >= FISICA.UMBRAL_REBOTE) {
        // Una restitución > 1 gana energía en cada bote (es lo que hace un
        // trampolín), así que la salida se acota: sin tope la bola saldría
        // disparada del nivel. El umbral deja posarse y saltar con normalidad.
        this.vy = -Math.min(MUNDO.REBOTE_MAXIMO, impacto * restitucion + extra);
        this.reboto = true;
        this.coyote = 0; // rebotando no se puede saltar
      } else {
        this.enSuelo = true;
        if (!estabaEnSuelo) this.aterrizo = true;
      }
    }

    return this;
  }
}
