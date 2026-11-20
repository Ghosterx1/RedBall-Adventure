/**
 * ajustes.js — ÚNICA fuente de números del juego.
 *
 * UNIDADES: segundos (tiempo) y píxeles por segundo (velocidad/aceleración).
 * El prototipo antiguo trabajaba en "píxeles por frame" asumiendo 60 Hz fijos.
 * Las constantes se han convertido con estos factores, así que el "feeling"
 * es EXACTAMENTE el mismo que el del prototipo a 60 Hz:
 *
 *   velocidad:     v[px/s]   = v[px/frame]   * 60
 *   aceleración:   a[px/s²]  = a[px/frame²]  * 60 * 60 = * 3600
 *   factores multiplicativos por frame (rozamiento): se aplican como
 *   Math.pow(factor, dt * 60)
 *
 * Verificado en pruebas/ajustes.test.js: el salto da un ápice de 84,18 px,
 * idéntico al prototipo medido en el harness (84,18 px / 46 frames en aire).
 */

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * RELACIONES MATEMÁTICAS (lo que hay detrás de cada número)
 *
 *   Gravedad y salto, con g constante y v0 hacia arriba:
 *     ápice      h = v0² / (2·g)
 *     aire       t = 2·v0 / g
 *     alcance    R = VELOCIDAD_MAXIMA · t
 *   Y su inversa, para diseñar un salto de altura h y duración t:
 *     v0 = 4h / t        g = 8h / t²
 *   (ver fisica/Fisica.js: alturaMaxima, tiempoEnAire, parametrosSalto)
 *
 *   Integración por paso (Euler semi-implícito, estable):
 *     v ← v + a·dt    y después    x ← x + v·dt
 *
 *   Fricción exponencial: un factor "por frame a 60 Hz" se aplica como
 *   f^(dt·60), que a 60 Hz vale exactamente f y a otra tasa sigue siendo el
 *   mismo decaimiento por segundo.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Duración de un paso de simulación. La física SIEMPRE avanza en múltiplos de este valor. */
export const PASO_FIJO = 1 / 60;

/** Tiempo máximo simulado por cuadro. Evita saltos enormes al volver de una pestaña en segundo plano. */
export const TOPE_TIEMPO = 0.25;

/** Pasos máximos por cuadro. Evita la "espiral de la muerte" si el equipo no da abasto. */
export const MAX_PASOS = 8;

/** Resolución interna del lienzo (se escala por CSS, nunca por canvas.width). */
export const VISTA = Object.freeze({
  ANCHO: 480,
  ALTO: 270,
  TILE: 16
});

export const FISICA = Object.freeze({
  GRAVEDAD: 1152, // 0.32 px/frame²
  SALTO_VELOCIDAD: -450, // -7.5 px/frame
  CAIDA_MAXIMA: 420, // 7 px/frame
  ACELERACION: 1800, // 0.5 px/frame²
  VELOCIDAD_MAXIMA: 300, // 5 px/frame
  // Fricción y frenado
  AMORTIGUAMIENTO: 0.8, // factor por frame a 60 Hz → se aplica Math.pow(f, dt * 60)
  AMORTIGUAMIENTO_AIRE: 0.98, // en el aire casi no hay freno
  UMBRAL_PARADA: 6, // px/s: por debajo de esto la fricción detiene la bola del todo
  // Salto y rebote
  CORTE_SALTO: 0.5, // al soltar el salto subiendo: vy = max(vy, v0 * 0.5)
  UMBRAL_REBOTE: 80, // px/s de impacto mínimo para que una superficie elástica bote
  MARGEN_CONTACTO: 0.001, // px de tolerancia en los bordes (evita contactos falsos)
  IMPULSO_VELOCIDAD: 600,
  IMPULSO_DURACION: 0.15,
  IMPULSO_ENFRIAMIENTO: 0.5,
  COYOTE_TIEMPO: 0.1,
  SALTO_BUFFER: 0.13
});

export const JUEGO = Object.freeze({
  VIDAS_INICIALES: 3,
  VALOR_ANILLO: 10,
  VALOR_ENEMIGO: 5,
  /** Puntos que vale una moneda recogida. */
  VALOR_MONEDA: 10,
  DANIO_AGUA: true
});

/**
 * AUDIO — diseño de sonido. Frecuencias en hercios, tiempos en segundos.
 *
 * El "blip" de moneda son DOS notas cortas y agudas (B5 y E6) con envolvente
 * de ataque rápido y caída exponencial: es el mismo truco que usaban los
 * arcades para que el oído lo reconozca antes de verlo.
 */
export const AUDIO = Object.freeze({
  VOLUMEN: 0.22,
  MONEDA_TONOS: Object.freeze([988, 1319]), // B5 → E6
  MONEDA_DURACION: 0.075,
  MONEDA_SEPARACION: 0.055, // cuándo arranca la segunda nota
  MONEDA_ATAQUE: 0.005, // subida de la envolvente (evita el "clic")
  // Dos monedas en el mismo paso no deben apilar dos osciladores.
  MONEDA_INTERVALO_MINIMO: 0.035
});

/** Velocidad de la cámara: fracción del desplazamiento que se persigue por segundo. */
export const CAMARA = Object.freeze({
  SUAVIZADO: 8,
  MARGEN_X: 0.38,
  MARGEN_Y: 0.3
});

/**
 * MUNDO — números de los objetos del escenario (Fase 3).
 *
 * Cada tipo de objeto los lee de aquí; ningún tipo escribe constantes propias.
 * Los valores describen COMPORTAMIENTO, no dibujo.
 */
export const MUNDO = Object.freeze({
  // Superficies elásticas: restitución > 1 significa que el rebote DEVUELVE más
  // energía de la que llegó (serie geométrica creciente), así que se acota con
  // REBOTE_MAXIMO para que el juego siga siendo controlable.
  REBOTE_ELASTICA: 1.2,
  IMPULSO_ELASTICA: 140, // px/s extra que añade el trampolín en cada bote
  REBOTE_MAXIMO: 620, // tope de velocidad de salida de un bote elástico
  // Rampas: desnivel máximo (px) que se "absorbe" en un paso para quedarse
  // pegado a la pendiente. Debe superar el avance horizontal por paso
  // (VELOCIDAD_MAXIMA * PASO_FIJO = 5 px) o la bola se despega al bajar.
  RAMPA_TOLERANCIA: 7,
  // Escalón: altura máxima (px) de un canto que el cuerpo sube al andar.
  // Es lo que hace que una rampa termine limpiamente en una cornisa (llega
  // unos píxeles por debajo del borde) y que un bordillo no bloquee.
  ESCALON_MAXIMO: 6,
  // Plataformas que desaparecen (segundos)
  EFIMERA_RETARDO: 0.4, // pisarla → empieza la cuenta atrás
  EFIMERA_AVISO: 0.4, // parpadeo antes de desaparecer
  EFIMERA_REAPARICION: 1.8, // tiempo oculta
  // Plataformas y obstáculos móviles (px/s y segundos)
  MOVIL_VELOCIDAD: 40,
  MOVIL_PAUSA: 0.35, // pausa en cada extremo del recorrido
  // Caída: si la bola baja más de esto por debajo del nivel, cuenta como caída
  CAIDA_MARGEN: 120,
  // Monedas: tamaño, animación (rad/s y px) y destello al recogerlas (s).
  MONEDA_LADO: 14,
  MONEDA_GIRO: 3.2, // rad/s del giro sobre su eje vertical (solo dibujo)
  MONEDA_BALANCEO: 2, // px de flotación vertical (solo dibujo)
  MONEDA_EFECTO: 0.22, // segundos que dura el destello de la recogida
  // Recogida: recorrido máximo (px) que se barre en un paso para no perder
  // monedas si el cuerpo se mueve muy rápido. Por encima de esto se supone un
  // teletransporte (reaparición al morir) y NO se recoge nada por el camino:
  // sin este tope, morir arrasaría todas las monedas de la línea de regreso.
  // 48 px es ~4,6 veces el paso más rápido posible (620 px/s ÷ 60).
  RECOGIDA_BARRIDO_MAXIMO: 48,
  // Meta del nivel (portal/bandera de llegada). Su tamaño por defecto es el de
  // una puerta de 1,5 tiles: se ve desde lejos y no tapa el camino.
  META_ANCHO: 24,
  META_ALTO: 44
});

/**
 * NIVEL — reglas del SISTEMA DE NIVELES.
 *
 * Un nivel es DATA pura (src/mundo/niveles/): dimensiones, inicio, objetos y
 * objetivo. Estas constantes son las únicas reglas que el motor aplica a esa
 * data: qué objetivo hay si no se indica, qué rango de dificultad existe, qué
 * tamaño mínimo tiene un escenario y cuánto se espera antes de saltar al
 * siguiente nivel.
 */
export const NIVEL = Object.freeze({
  /** Sin `objetivo` explícito, un nivel se supera recogiendo TODAS las monedas. */
  OBJETIVO_POR_DEFECTO: 'monedas',
  /** Dificultad declarativa: 1 = paseo, 5 = todo a la vez. */
  DIFICULTAD_MINIMA: 1,
  DIFICULTAD_MAXIMA: 5,
  /** Un escenario más pequeño que una pantalla no se puede recorrer. */
  ANCHO_MINIMO: VISTA.ANCHO,
  ALTO_MINIMO: 200,
  /** Tolerancia (px) al comprobar que un objeto cabe dentro del nivel. */
  MARGEN: 2,
  /** Segundos de aviso antes de pasar al siguiente nivel. */
  TRANSICION: 1.4,
  /** px de tolerancia al decidir si algo se APOYA en una superficie. */
  APOYO_MARGEN: 8,
  /** Solape horizontal mínimo (px) para considerar que hay apoyo. */
  APOYO_ANCHO_MINIMO: 8
});
