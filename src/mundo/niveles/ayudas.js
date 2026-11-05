import { MUNDO } from '../../config/ajustes.js';

/**
 * ayudas.js — generadores de DATA para escribir niveles cortos y legibles.
 *
 * Esto NO es lógica de juego: son funciones que devuelven objetos de nivel
 * (los mismos `{ tipo, x, y, … }` que se escribirían a mano). Existen para que un
 * nivel de 40 líneas no se convierta en 200 y para que todos los niveles usen el
 * mismo suelo, el mismo tamaño de moneda y el mismo alto de meta.
 *
 * Si mañana un nivel se guarda como JSON, estas ayudas simplemente no se usan:
 * el formato de datos es el mismo.
 */

/** Altura del suelo de todos los niveles (30 px de grosor hasta el borde). */
export const SUELO = 240;

/** Moneda suelta. Por defecto, a ras de suelo (se coge andando). */
export const moneda = (x, y = SUELO - 14) => ({ tipo: 'moneda', x, y });

/** Fila de `cuantas` monedas separadas `paso` px: un arco de premio típico. */
export const filaMonedas = (x, y, cuantas, paso = 20) =>
  Array.from({ length: cuantas }, (_, i) => moneda(x + i * paso, y));

/** Tramo de suelo sólido. */
export const suelo = (
  x,
  ancho,
  { y = SUELO, alto = 30, material = 'cesped', etiqueta = null } = {}
) => ({ tipo: 'plataforma', x, y, ancho, alto, material, etiqueta });

/** Foso lleno de agua: caer dentro reinicia al jugador. */
export const agua = (x, ancho, { y = SUELO + 12, alto = 18 } = {}) => ({
  tipo: 'peligro',
  x,
  y,
  ancho,
  alto,
  forma: 'agua',
  etiqueta: 'agua'
});

/** Pinchos apoyados en el suelo (hay que saltarlos). */
export const pinchos = (x, ancho, { y = SUELO - 8, alto = 8 } = {}) => ({
  tipo: 'peligro',
  x,
  y,
  ancho,
  alto,
  forma: 'pinchos',
  etiqueta: 'pinchos'
});

/** Muro: estorba pero no mata. */
export const muro = (x, alto = 40, { ancho = 16, y = SUELO - alto } = {}) => ({
  tipo: 'obstaculo',
  x,
  y,
  ancho,
  alto,
  etiqueta: 'muro'
});

/** Checkpoint (bandera). */
export const checkpoint = (x, { y = SUELO - 34, alto = 34 } = {}) => ({
  tipo: 'checkpoint',
  x,
  y,
  ancho: 14,
  alto
});

/**
 * Meta (portal de llegada) apoyada en el suelo. Es el único objeto que la escena
 * mira para saber si el nivel está superado (ver mundo/objetivo.js).
 */
export const meta = (x, { y = SUELO - MUNDO.META_ALTO } = {}) => ({
  tipo: 'meta',
  x,
  y,
  ancho: MUNDO.META_ANCHO,
  alto: MUNDO.META_ALTO
});
