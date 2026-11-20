import { AUDIO } from '../config/ajustes.js';

/**
 * Sonido.js — efectos de sonido sintetizados con Web Audio.
 *
 * Sin archivos, sin DOM y sin dependencias: cada efecto son dos osciladores y
 * una envolvente. Eso mantiene el juego ligero y, sobre todo, permite que las
 * pruebas inyecten un contexto falso y comprueben QUÉ notas se programan.
 *
 * Esta capa NO conoce el juego: no sabe qué es una moneda. La escena decide
 * cuándo suena `moneda()`; aquí solo se sintetiza.
 *
 * Los navegadores no dejan sonar nada antes de un gesto del usuario, así que el
 * contexto se crea (o se reanuda) en `desbloquear()`, que se llama desde el
 * primer clic/tecla. Si no hay Web Audio —o el navegador lo bloquea— todos los
 * métodos son inofensivos y devuelven false.
 */

/** Crea el AudioContext del navegador, o null si no existe o falla. */
export function crearContexto(global = globalThis) {
  const Fabrica = global?.AudioContext ?? global?.webkitAudioContext;
  if (typeof Fabrica !== 'function') return null;
  try {
    return new Fabrica();
  } catch {
    return null; // el navegador puede negarse (límite de contextos, política…)
  }
}

export class Sonido {
  constructor({ contexto = null, volumen = AUDIO.VOLUMEN, silencioso = false } = {}) {
    this.contexto = contexto;
    this.volumen = volumen;
    this.silencioso = silencioso === true;
    /** Instante (s) del último efecto: evita apilar notas en el mismo paso. */
    this.ultimoSonido = -Infinity;
    /** Cuántos efectos se han programado (depuración y pruebas). */
    this.sonidos = 0;
  }

  /** ¿Hay Web Audio disponible? */
  get disponible() {
    return this.contexto !== null;
  }

  /**
   * Crea el contexto si aún no existe y lo reanuda si el navegador lo suspendió.
   * Llamarlo en el primer gesto del usuario es lo que permite oír algo.
   */
  desbloquear() {
    if (!this.contexto) this.contexto = crearContexto();
    if (this.contexto?.state === 'suspended') this.contexto.resume?.();
    return this.contexto;
  }

  /** Silencia o reactiva todos los efectos. */
  silenciar(silencioso = true) {
    this.silencioso = silencioso === true;
    return this;
  }

  /** Blip de moneda: dos notas cortas y agudas. Devuelve true si ha sonado. */
  moneda() {
    const ctx = this.desbloquear();
    if (!ctx || this.silencioso) return false;

    const ahora = Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0;
    if (ahora - this.ultimoSonido < AUDIO.MONEDA_INTERVALO_MINIMO) return false;
    this.ultimoSonido = ahora;

    const [primera, segunda] = AUDIO.MONEDA_TONOS;
    this.#blip(ctx, ahora, primera, AUDIO.MONEDA_DURACION);
    this.#blip(ctx, ahora + AUDIO.MONEDA_SEPARACION, segunda, AUDIO.MONEDA_DURACION);
    this.sonidos += 1;
    return true;
  }

  /** Una nota con envolvente ataque/caída (la caída es exponencial: suena natural). */
  #blip(ctx, cuando, frecuencia, duracion) {
    const oscilador = ctx.createOscillator();
    const ganancia = ctx.createGain();
    const volumen = Math.max(0, Math.min(1, this.volumen));

    oscilador.type = 'square';
    oscilador.frequency.setValueAtTime(frecuencia, cuando);

    ganancia.gain.setValueAtTime(0.0001, cuando);
    ganancia.gain.linearRampToValueAtTime(volumen, cuando + AUDIO.MONEDA_ATAQUE);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, cuando + duracion);

    oscilador.connect(ganancia);
    ganancia.connect(ctx.destination);
    oscilador.start(cuando);
    oscilador.stop(cuando + duracion + 0.02);
  }
}
