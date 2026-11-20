import { Bucle } from './Bucle.js';
import { Entrada } from './Entrada.js';
import { BusEventos } from './BusEventos.js';
import { VISTA } from '../config/ajustes.js';

/**
 * Juego.js — orquestador.
 *
 * Responsabilidades:
 *  - poseer el contexto 2D y el bucle,
 *  - mantener la escena activa y reenviarle actualización/dibujo,
 *  - cerrar el "paso" de entrada después de cada actualización.
 *
 * NO conoce física, ni niveles, ni dibujo concreto: todo eso vive en la escena.
 * En la Fase 7 aparecerá GestorEscenas (pila: título → juego → pausa) y esta
 * clase delegará en él; la API pública no cambiará.
 */
export class Juego {
  constructor({
    lienzo,
    entrada = new Entrada(),
    bus = new BusEventos(),
    sonido = null,
    ancho = VISTA.ANCHO,
    alto = VISTA.ALTO,
    bucle = null,
    alDibujar = null
  } = {}) {
    if (!lienzo) throw new Error('Juego necesita un <canvas>');
    const contexto = lienzo.getContext('2d');
    if (!contexto) throw new Error('El navegador no soporta canvas 2D');

    this.lienzo = lienzo;
    this.contexto = contexto;
    this.ancho = ancho;
    this.alto = alto;
    this.entrada = entrada;
    this.bus = bus;
    /**
     * Sistema de sonido (duck-typed: basta con que tenga métodos como
     * `moneda()`). Se inyecta desde main.js para que el núcleo no dependa del
     * navegador y las pruebas puedan pasar un doble.
     */
    this.sonido = sonido;
    /**
     * Gancho opcional que se llama al final de cada cuadro, DESPUÉS de dibujar:
     * `main.js` lo usa para volcar el estado de la escena al HUD del DOM. Es un
     * callback inyectado (como `sonido`), así el núcleo no sabe qué es el DOM ni
     * la interfaz y las pruebas pueden pasar null sin cambiar nada.
     */
    this.alDibujar = typeof alDibujar === 'function' ? alDibujar : null;
    /** Escena activa (objeto con entrar/actualizar/dibujar/salir opcionales). */
    this.escena = null;

    this.contexto.imageSmoothingEnabled = false;

    this.bucle =
      bucle ??
      new Bucle({
        actualizar: (dt) => this.actualizar(dt),
        dibujar: (alfa) => this.dibujar(alfa)
      });
  }

  iniciar() {
    this.bucle.iniciar();
    return this;
  }

  detener() {
    this.bucle.detener();
    return this;
  }

  pausar() {
    this.bucle.pausar();
    this.bus.emitir('juego:pausa');
    return this;
  }

  reanudar() {
    this.bucle.reanudar();
    this.bus.emitir('juego:reanudar');
    return this;
  }

  /** Reemplaza la escena activa. */
  cambiarEscena(escena) {
    this.escena?.salir?.(this);
    this.entrada.soltarTodo();
    this.escena = escena;
    this.escena?.entrar?.(this);
    return this;
  }

  /**
   * Un paso de simulación (dt siempre vale 1/60 por el paso fijo).
   * La entrada se cierra AQUÍ, no por cuadro: así una pulsación ocurrida en un
   * cuadro sin pasos (posible a 144 Hz) no se pierde, la consume el siguiente paso.
   */
  actualizar(dt) {
    this.escena?.actualizar?.(dt, this);
    this.entrada.terminarCuadro();
  }

  /** Un cuadro de render. `alfa` es la interpolación pendiente (0..1). */
  dibujar(alfa) {
    const ctx = this.contexto;
    ctx.clearRect(0, 0, this.ancho, this.alto);
    this.escena?.dibujar?.(ctx, alfa, this);
    // Después de pintar, nunca antes: la interfaz lee el estado ya simulado.
    this.alDibujar?.(this);
  }
}
