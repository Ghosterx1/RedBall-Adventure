/**
 * registro.js — catálogo de tipos de objeto.
 *
 * Es la pieza que permite añadir contenido sin tocar el motor: cada archivo de
 * src/mundo/tipos/ se registra a sí mismo con `registrarTipo(...)` y los
 * niveles son datos JSON con un campo `tipo`. Nadie hace `switch (tipo)`.
 *
 * Añadir un objeto nuevo (2 pasos, 0 cambios en motor/escena/física):
 *   1. crear src/mundo/tipos/MiObjeto.js y llamar a registrarTipo(MiObjeto.tipo, …)
 *   2. añadirlo al barril src/mundo/tipos.js
 */

/** tipo → función que crea el objeto a partir de los datos del nivel. */
const TIPOS = new Map();

/** Registra (o reemplaza) un tipo. Devuelve la fábrica para poder encadenar. */
export function registrarTipo(tipo, fabrica) {
  if (typeof tipo !== 'string' || tipo.length === 0) {
    throw new TypeError('registrarTipo necesita un nombre de tipo no vacío');
  }
  if (typeof fabrica !== 'function') {
    throw new TypeError(`La fábrica de "${tipo}" debe ser una función`);
  }
  TIPOS.set(tipo, fabrica);
  return fabrica;
}

/**
 * Crea un objeto desde los datos de un nivel: `{ tipo: 'rampa', … }`.
 * Falla con un mensaje útil (y con la lista de tipos válidos) si el tipo no
 * existe, en vez de devolver undefined y romper más tarde.
 */
export function crearObjeto(datos) {
  const tipo = datos?.tipo;
  const fabrica = TIPOS.get(tipo);
  if (!fabrica) {
    throw new Error(
      `Tipo de objeto desconocido: "${tipo}". Registrados: ${tiposRegistrados().join(', ')}`
    );
  }
  return fabrica(datos);
}

/** Nombres de todos los tipos registrados, ordenados (para validar niveles). */
export function tiposRegistrados() {
  return [...TIPOS.keys()].sort();
}

/** ¿Existe ese tipo? */
export function hayTipo(tipo) {
  return TIPOS.has(tipo);
}
