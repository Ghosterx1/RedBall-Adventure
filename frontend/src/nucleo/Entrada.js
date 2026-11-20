/**
 * Entrada.js — mapa de acciones único para teclado y táctil.
 *
 * El resto del juego NO conoce teclas: pregunta por acciones
 * ("salto", "izquierda"…). Así se puede reasignar controles sin tocar
 * la lógica, y el táctil y el teclado se comportan exactamente igual.
 *
 * (El mando/gamepad se añadirá en la Fase 7 sobre esta misma API.)
 */

export const ACCIONES = Object.freeze({
  IZQUIERDA: 'izquierda',
  DERECHA: 'derecha',
  SALTO: 'salto',
  IMPULSO: 'impulso',
  PAUSA: 'pausa',
  REINICIAR: 'reiniciar'
});

/** Códigos de `KeyboardEvent.code` (independientes de la distribución del teclado). */
export const MAPA_POR_DEFECTO = Object.freeze({
  izquierda: ['ArrowLeft', 'KeyA'],
  derecha: ['ArrowRight', 'KeyD'],
  salto: ['Space', 'ArrowUp', 'KeyW'],
  impulso: ['KeyX', 'ShiftLeft', 'ShiftRight'],
  pausa: ['Escape', 'KeyP'],
  reiniciar: ['KeyR']
});

/** Teclas cuyo comportamiento por defecto (scroll) hay que bloquear. */
const CODIGOS_BLOQUEADOS = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight'
]);

export class Entrada {
  #codigos = new Set(); // códigos de tecla pulsados ahora mismo
  #tactiles = new Set(); // acciones pulsadas en pantalla
  #nuevas = new Set(); // acciones que empezaron en este paso
  #codigoAAccion = new Map();
  #conectada = false;
  #elementosTactiles = [];

  /**
   * @param {object}   opciones
   * @param {object}   opciones.objetivo       donde escuchar el teclado (window)
   * @param {Document} opciones.documento      para visibilitychange (null en Node)
   * @param {object}   opciones.mapa           acción → códigos de tecla
   * @param {Function} opciones.alPerderFoco   se llama al perder el foco
   */
  constructor({
    objetivo = typeof window !== 'undefined' ? window : null,
    documento = typeof document !== 'undefined' ? document : null,
    mapa = MAPA_POR_DEFECTO,
    alPerderFoco = null
  } = {}) {
    this.objetivo = objetivo;
    this.documento = documento;
    this.mapa = mapa;
    this.alPerderFoco = alPerderFoco;

    for (const [accion, codigos] of Object.entries(mapa)) {
      for (const codigo of codigos) this.#codigoAAccion.set(codigo, accion);
    }
  }

  get conectada() {
    return this.#conectada;
  }

  conectar() {
    if (this.#conectada || !this.objetivo) return this;
    this.objetivo.addEventListener('keydown', this.#alPresionar);
    this.objetivo.addEventListener('keyup', this.#alSoltar);
    this.objetivo.addEventListener('blur', this.#alPerderFoco);
    this.documento?.addEventListener('visibilitychange', this.#alCambiarVisibilidad);
    this.#conectada = true;
    return this;
  }

  desconectar() {
    if (!this.#conectada || !this.objetivo) return this;
    this.objetivo.removeEventListener('keydown', this.#alPresionar);
    this.objetivo.removeEventListener('keyup', this.#alSoltar);
    this.objetivo.removeEventListener('blur', this.#alPerderFoco);
    this.documento?.removeEventListener('visibilitychange', this.#alCambiarVisibilidad);
    this.#conectada = false;
    return this;
  }

  /** ¿La acción está mantenida ahora mismo? */
  estaPresionada(accion) {
    if (this.#tactiles.has(accion)) return true;
    const codigos = this.mapa[accion];
    if (!codigos) return false;
    for (const codigo of codigos) {
      if (this.#codigos.has(codigo)) return true;
    }
    return false;
  }

  /** ¿La acción empezó en este paso? Solo válido durante el paso actual. */
  recienPresionada(accion) {
    return this.#nuevas.has(accion);
  }

  /** -1, 0 o 1. Si se pulsan ambas direcciones a la vez, se anulan. */
  ejeHorizontal() {
    const izquierda = this.estaPresionada(ACCIONES.IZQUIERDA) ? 1 : 0;
    const derecha = this.estaPresionada(ACCIONES.DERECHA) ? 1 : 0;
    return derecha - izquierda;
  }

  /** Cierra el paso: las pulsaciones "recién" dejan de serlo. */
  terminarCuadro() {
    this.#nuevas.clear();
    return this;
  }

  /** Olvida todo lo pulsado (cambio de escena, pérdida de foco, game over). */
  soltarTodo() {
    this.#codigos.clear();
    this.#tactiles.clear();
    this.#nuevas.clear();
    for (const { elemento } of this.#elementosTactiles) delete elemento.dataset.activo;
    return this;
  }

  /**
   * Engancha los botones táctiles del HTML: cualquier elemento con
   * `data-accion="salto|izquierda|..."`. Usa pointer events, así funciona con
   * dedo, ratón y lápiz, y captura el puntero para no perder el "soltar".
   */
  conectarTactil(raiz = this.documento) {
    if (!raiz || typeof raiz.querySelectorAll !== 'function') return this;

    for (const elemento of raiz.querySelectorAll('[data-accion]')) {
      const accion = elemento.dataset.accion;
      if (!accion) continue;

      const presionar = (evento) => {
        evento.preventDefault?.();
        elemento.setPointerCapture?.(evento.pointerId);
        if (!this.estaPresionada(accion)) this.#nuevas.add(accion);
        this.#tactiles.add(accion);
        elemento.dataset.activo = 'true';
      };
      const soltar = () => {
        this.#tactiles.delete(accion);
        delete elemento.dataset.activo;
      };
      const bloquearMenu = (evento) => evento.preventDefault();

      elemento.addEventListener('pointerdown', presionar);
      elemento.addEventListener('pointerup', soltar);
      elemento.addEventListener('pointercancel', soltar);
      elemento.addEventListener('lostpointercapture', soltar);
      elemento.addEventListener('contextmenu', bloquearMenu);

      this.#elementosTactiles.push({ elemento, presionar, soltar, bloquearMenu });
    }
    return this;
  }

  desconectarTactil() {
    for (const { elemento, presionar, soltar, bloquearMenu } of this.#elementosTactiles) {
      elemento.removeEventListener('pointerdown', presionar);
      elemento.removeEventListener('pointerup', soltar);
      elemento.removeEventListener('pointercancel', soltar);
      elemento.removeEventListener('lostpointercapture', soltar);
      elemento.removeEventListener('contextmenu', bloquearMenu);
      delete elemento.dataset.activo;
    }
    this.#elementosTactiles = [];
    this.#tactiles.clear();
    return this;
  }

  #alPresionar = (evento) => {
    const accion = this.#codigoAAccion.get(evento.code);
    if (!accion) return;
    if (CODIGOS_BLOQUEADOS.has(evento.code)) evento.preventDefault?.();
    if (evento.repeat) return;
    if (!this.estaPresionada(accion)) this.#nuevas.add(accion);
    this.#codigos.add(evento.code);
  };

  #alSoltar = (evento) => {
    this.#codigos.delete(evento.code);
  };

  #alPerderFoco = () => {
    this.soltarTodo();
    this.alPerderFoco?.();
  };

  #alCambiarVisibilidad = () => {
    if (this.documento?.hidden) this.#alPerderFoco();
  };
}
