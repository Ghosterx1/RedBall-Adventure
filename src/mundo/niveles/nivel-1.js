import { VISTA } from '../../config/ajustes.js';
import { SUELO, filaMonedas, meta, moneda, muro, checkpoint, pinchos, suelo } from './ayudas.js';

/**
 * nivel-1.js — "Primeros pasos" (dificultad 1).
 *
 * Enseña lo mínimo en orden: andar, una rampa con cornisa, un muro que saltar,
 * un foso que cruzar y unos pinchos. La meta está al final y no exige monedas,
 * así que se puede terminar sin recoger nada: es el nivel que hace de tutorial.
 *
 * Nada de esto es código: es DATA. El motor (Mundo) no sabe que este nivel
 * existe; se lo encuentra por el catálogo (./index.js).
 */
export const NIVEL_1 = Object.freeze({
  id: 'nivel-1',
  orden: 1,
  nombre: 'Primeros pasos',
  dificultad: 1,
  ancho: 1280,
  alto: VISTA.ALTO,
  /** Pies del jugador al empezar. */
  inicio: { x: 40, y: SUELO },
  /** Llegar a la meta; las monedas son un extra, no un requisito. */
  objetivo: { tipo: 'meta' },
  objetos: [
    // Suelo partido por un foso de 80 px.
    suelo(0, 480),
    suelo(560, 720),

    // Rampa que sube a una cornisa atravesable desde abajo.
    { tipo: 'rampa', x: 120, y: SUELO, ancho: 64, alto: 32, pendiente: 'sube', material: 'cesped' },
    { tipo: 'plataformaElevada', x: 184, y: 208, ancho: 96, alto: 8, material: 'piedra' },

    // Muro bajo y pinchos: los dos "obstáculos" del tutorial.
    muro(700, 40),
    pinchos(900, 40),

    // Checkpoint tras el foso y meta al final.
    checkpoint(580),
    meta(1180),

    // Monedas: suelo, cornisa, salto sobre el muro y vuelta al suelo.
    ...filaMonedas(56, SUELO - 14, 2, 20),
    moneda(216, 208 - 14),
    moneda(256, 208 - 14),
    moneda(330, SUELO - 14),
    moneda(470, SUELO - 26), // en el aire: anima a saltar el foso
    moneda(700, 200 - 14), // coronando el muro
    moneda(960, SUELO - 14)
  ]
});
