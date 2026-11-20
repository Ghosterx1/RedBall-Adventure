/**
 * materiales.js — propiedades de las superficies.
 * Se usan en la Fase 8 (rebote, hielo, rompibles). Ninguna constante
 * numérica de materiales debe escribirse fuera de este archivo.
 */

export const MATERIALES = Object.freeze({
  cesped: Object.freeze({
    friccion: 0.8, // mismo rozamiento que el prototipo
    restitucion: 0, // sin rebote: aterrizaje seco
    solido: true,
    descripcion: 'Césped normal'
  }),
  piedra: Object.freeze({
    friccion: 0.9,
    restitucion: 0,
    solido: true,
    descripcion: 'Bloque de piedra'
  }),
  hielo: Object.freeze({
    friccion: 0.98, // casi sin frenado
    restitucion: 0,
    solido: true,
    descripcion: 'Superficie resbaladiza'
  }),
  blando: Object.freeze({
    friccion: 0.7,
    restitucion: 0.55, // bota al caer: "bounce" del concepto
    solido: true,
    descripcion: 'Plataforma elástica'
  }),
  rompible: Object.freeze({
    friccion: 0.8,
    restitucion: 0,
    solido: true,
    vidaRomper: 0.35, // segundos de exposición antes de romperse
    descripcion: 'Bloque que se destruye'
  }),
  elastico: Object.freeze({
    friccion: 0.9,
    // Rebote base del material. Los objetos elásticos pueden sobreescribirlo
    // con su propia propiedad `restitucion` (ver mundo/tipos/Elastica.js).
    restitucion: 0.6,
    solido: true,
    descripcion: 'Superficie que impulsa hacia arriba'
  }),
  agua: Object.freeze({
    friccion: 0.5,
    restitucion: 0,
    solido: false,
    haceDano: true,
    descripcion: 'Agua: no sólida y mortífera'
  }),
  moneda: Object.freeze({
    friccion: 0.8,
    restitucion: 0,
    solido: false, // se atraviesa: solo existe para recogerla
    descripcion: 'Moneda coleccionable'
  })
});

export const MATERIAL_POR_DEFECTO = 'cesped';

/** Devuelve siempre un material válido; nunca undefined. */
export function material(nombre = MATERIAL_POR_DEFECTO) {
  return MATERIALES[nombre] ?? MATERIALES[MATERIAL_POR_DEFECTO];
}
