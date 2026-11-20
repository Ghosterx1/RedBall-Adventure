import { JUEGO } from '../config/ajustes.js';

/**
 * Marcador.js — contadores de la partida: puntos y monedas.
 *
 * Puro: no sabe de niveles, ni de dibujo, ni de almacenamiento. Se le dice
 * "ha caído una moneda de 10 puntos" y lleva la cuenta. La escena lo pinta y la
 * persistencia lo guarda; así el mismo marcador sirve para el HUD, para las
 * pruebas y para el récord.
 */
export class Marcador {
  constructor({
    puntos = 0,
    monedas = 0,
    totalMonedas = 0,
    valorMoneda = JUEGO.VALOR_MONEDA
  } = {}) {
    /** Puntos que vale cada moneda de este marcador. */
    this.valorMoneda = valorMoneda;
    this.totalMonedas = entero(totalMonedas);
    this.puntos = entero(puntos);
    this.monedas = entero(monedas);
    /** Puntos de la última moneda (para el aviso flotante "+10"). */
    this.ultimaGanancia = 0;
  }

  /** Cuántas monedas hay en el nivel (lo dice el mundo al empezar). */
  fijarTotal(total) {
    this.totalMonedas = entero(total);
    return this;
  }

  /** Suma una moneda recogida y devuelve los puntos ganados. */
  contarMoneda(valor = this.valorMoneda) {
    const ganancia = Number.isFinite(valor) ? Math.max(0, Math.round(valor)) : this.valorMoneda;
    this.monedas += 1;
    this.puntos += ganancia;
    this.ultimaGanancia = ganancia;
    return ganancia;
  }

  /** Suma puntos sueltos (enemigos, bonus de tiempo…). */
  sumar(puntos) {
    const ganancia = Number.isFinite(puntos) ? Math.max(0, Math.round(puntos)) : 0;
    this.puntos += ganancia;
    this.ultimaGanancia = ganancia;
    return ganancia;
  }

  /** Monedas que faltan para completar el nivel. */
  get restantes() {
    return Math.max(0, this.totalMonedas - this.monedas);
  }

  /** ¿Están todas? (un nivel sin monedas no cuenta como completo). */
  get completo() {
    return this.totalMonedas > 0 && this.monedas >= this.totalMonedas;
  }

  /** Fracción 0..1 recogida (para barras de progreso). */
  get porcentaje() {
    if (!(this.totalMonedas > 0)) return 0;
    return Math.min(1, this.monedas / this.totalMonedas);
  }

  reiniciar() {
    this.puntos = 0;
    this.monedas = 0;
    this.ultimaGanancia = 0;
    return this;
  }

  /** Línea del HUD, en el formato corto de la fuente pixel. */
  get texto() {
    return `monedas ${this.monedas}/${this.totalMonedas}  puntos ${this.puntos}`;
  }

  /** Instantánea para guardar el récord. */
  aJSON() {
    return { puntos: this.puntos, monedas: this.monedas, totalMonedas: this.totalMonedas };
  }
}

/** Entero ≥ 0, nunca NaN (los datos vienen de JSON y pueden venir sucios). */
function entero(valor) {
  return Number.isFinite(valor) ? Math.max(0, Math.floor(valor)) : 0;
}
