import { NIVEL } from '../config/ajustes.js';

/**
 * objetivo.js — QUÉ hay que hacer para superar un nivel, expresado como datos.
 *
 * Un nivel declara su objetivo de una de estas dos formas:
 *
 *   { objetivo: 'monedas' }                  recoger TODAS las monedas
 *   { objetivo: { tipo: 'monedas' } }        (lo mismo, escrito largo)
 *   { objetivo: { tipo: 'meta' } }           llegar a la meta
 *   { objetivo: { tipo: 'meta', monedas: 5 }} llegar a la meta con ≥ 5 monedas
 *
 * Nada de esto conoce al jugador, ni al mundo, ni la escena: es una función
 * pura de (objetivo, estado de la partida) → ¿cumplido?. Por eso se puede
 * probar sin canvas y el HUD puede preguntar por el texto sin duplicar reglas.
 *
 * Este módulo vive en `mundo/` a propósito: el objetivo es parte de la DATA del
 * nivel y el validador (src/mundo/validar.js) lo necesita; las capas inferiores
 * (mundo) no pueden importar `nucleo/`.
 */

/** Tipos de objetivo admitidos. */
export const TIPOS_OBJETIVO = Object.freeze({
  /** Recoger todas las monedas del nivel. */
  MONEDAS: 'monedas',
  /** Llegar a la meta (opcionalmente con un mínimo de monedas). */
  META: 'meta'
});

/** Lista de tipos válidos, para validar y para los mensajes de error. */
export const OBJETIVOS_VALIDOS = Object.freeze(Object.values(TIPOS_OBJETIVO));

/**
 * Normaliza el objetivo de un nivel a `{ tipo, monedas }`.
 * Acepta texto suelto ('meta') y objetos; lo que no reconoce cae al objetivo
 * por defecto (todas las monedas) en vez de romper la partida.
 */
export function normalizarObjetivo(objetivo = NIVEL.OBJETIVO_POR_DEFECTO) {
  const crudo = typeof objetivo === 'string' ? { tipo: objetivo } : objetivo ?? {};
  const tipo = crudo.tipo === TIPOS_OBJETIVO.META ? TIPOS_OBJETIVO.META : TIPOS_OBJETIVO.MONEDAS;

  return Object.freeze({
    tipo,
    /** Monedas que hay que llevar encima al tocar la meta (solo tipo 'meta'). */
    monedas: tipo === TIPOS_OBJETIVO.META ? entero(crudo.monedas) : 0
  });
}

/**
 * Estado del objetivo en un instante de la partida.
 *
 * `estado` es la foto que ya conoce la escena: monedas cogidas, total del nivel
 * y si se ha tocado la meta. Devuelve un objeto con `cumplido` y los datos que
 * necesita el HUD (lo que falta, cuántas monedas se exigen…).
 *
 * REGLA: un nivel de monedas sin monedas NUNCA está cumplido. Si no se pusiera
 * este caso, un nivel mal escrito se superaría solo al entrar.
 */
export function estadoObjetivo(objetivo, { monedas = 0, totalMonedas = 0, metaAlcanzada = false } = {}) {
  const { tipo, monedas: requeridas } = normalizarObjetivo(objetivo);
  const cogidas = entero(monedas);
  const total = entero(totalMonedas);
  const metaTocada = metaAlcanzada === true;

  if (tipo === TIPOS_OBJETIVO.META) {
    const cumplido = metaTocada && cogidas >= requeridas;
    return Object.freeze({
      tipo,
      cumplido,
      monedas: cogidas,
      totalMonedas: total,
      requeridas,
      metaAlcanzada: metaTocada,
      faltaMeta: !metaTocada,
      faltanMonedas: Math.max(0, requeridas - cogidas)
    });
  }

  const cumplido = total > 0 && cogidas >= total;
  return Object.freeze({
    tipo,
    cumplido,
    monedas: cogidas,
    totalMonedas: total,
    requeridas: total,
    metaAlcanzada: metaTocada,
    faltaMeta: false,
    faltanMonedas: Math.max(0, total - cogidas)
  });
}

/** Texto corto del objetivo para el HUD (sin símbolos raros: es pixel art). */
export function textoObjetivo(estado) {
  if (!estado) return '';

  if (estado.tipo === TIPOS_OBJETIVO.META) {
    const extra = estado.requeridas > 0 ? ` + ${estado.monedas}/${estado.requeridas} monedas` : '';
    return estado.cumplido ? `meta superada${extra}` : `meta${extra}`;
  }

  return estado.cumplido
    ? `todas las monedas ${estado.monedas}/${estado.totalMonedas}`
    : `recoge las ${estado.totalMonedas} monedas (${estado.monedas})`;
}

/** ¿Este objetivo es uno de los que entiende el motor? (lo usa el validador) */
export function esObjetivoValido(objetivo) {
  const tipo = typeof objetivo === 'string' ? objetivo : objetivo?.tipo;
  return OBJETIVOS_VALIDOS.includes(tipo);
}

function entero(valor) {
  return Number.isFinite(valor) ? Math.max(0, Math.floor(valor)) : 0;
}
