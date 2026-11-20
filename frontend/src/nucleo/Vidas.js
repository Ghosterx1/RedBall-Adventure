import { JUEGO } from '../config/ajustes.js';

/**
 * Vidas.js — vidas que le quedan al jugador en la partida.
 *
 * Puro: no sabe de niveles, ni de dibujo, ni de menús. Se le dice "ha muerto"
 * y lleva la cuenta; la escena decide CUÁNDO se pierde una vida (peligro,
 * caída…) y la interfaz solo la pinta.
 *
 * Por qué es un objeto aparte y no un número en la escena: las vidas duran más
 * que un nivel. `main.js` crea UNA instancia y se la pasa a cada `EscenaMundo`,
 * así al superar un nivel no se recuperan (como en los clásicos) y al reintentar
 * tras la derrota se reinician con `reiniciar()`.
 *
 * El motor NO limita vidas por defecto: si la escena no recibe ninguna, jugar
 * nunca se acaba. Así el bot de las pruebas puede morir mil veces sin que la
 * partida termine, y las reglas de "game over" viven en el juego, no en el motor.
 */
export class Vidas {
  constructor({ iniciales = JUEGO.VIDAS_INICIALES, maximo = null } = {}) {
    /** Vidas con las que se empieza (y a las que vuelve `reiniciar()`). */
    this.iniciales = enteroPositivo(iniciales, JUEGO.VIDAS_INICIALES);
    /** Tope al que puede llegar `ganar()` (nunca por debajo de las iniciales). */
    this.maximo = Math.max(this.iniciales, enteroPositivo(maximo, this.iniciales));
    /** Vidas disponibles ahora mismo. */
    this.restantes = this.iniciales;
  }

  /** ¿Se ha quedado sin vidas? (es lo que dispara la pantalla de derrota) */
  get agotadas() {
    return this.restantes <= 0;
  }

  /** ¿Está al máximo? */
  get llenas() {
    return this.restantes >= this.maximo;
  }

  /**
   * Gasta vidas (una por defecto). Nunca baja de cero: una escena que avise dos
   * veces de la misma muerte no puede dejar el contador en negativo.
   * Devuelve cuántas quedan.
   */
  perder(cuantas = 1) {
    this.restantes = Math.max(0, this.restantes - cantidad(cuantas, 1));
    return this.restantes;
  }

  /** Recupera vidas sin pasarse del máximo. Devuelve cuántas quedan. */
  ganar(cuantas = 1) {
    this.restantes = Math.min(this.maximo, this.restantes + cantidad(cuantas, 1));
    return this.restantes;
  }

  /** Vuelve a las vidas iniciales (al reintentar un nivel tras la derrota). */
  reiniciar() {
    this.restantes = this.iniciales;
    return this;
  }
}

/** Entero ≥ 1; cualquier otra cosa cae al valor por defecto. */
function enteroPositivo(valor, porDefecto) {
  return Number.isFinite(valor) && valor >= 1 ? Math.floor(valor) : porDefecto;
}

/**
 * Entero ≥ 0 (cuántas vidas se gastan o se recuperan): `perder(0)` no quita
 * ninguna y un valor imposible se trata como "una".
 */
function cantidad(valor, porDefecto) {
  return Number.isFinite(valor) && valor >= 0 ? Math.floor(valor) : porDefecto;
}
