import { VISTA } from '../../config/ajustes.js';
import { SUELO, agua, filaMonedas, meta, moneda, muro, checkpoint, pinchos, suelo } from './ayudas.js';

/**
 * nivel-2.js — "Saltos y agua" (dificultad 2).
 *
 * Dos fosos con agua y una isla en medio: hay que medir los saltos (100 px de
 * agua, 60 px de caída). Aparece el primer objetivo con monedas: llegar a la
 * meta llevando al menos 3 de las 8.
 */
export const NIVEL_2 = Object.freeze({
  id: 'nivel-2',
  orden: 2,
  nombre: 'Saltos y agua',
  dificultad: 2,
  ancho: 1600,
  alto: VISTA.ALTO,
  inicio: { x: 40, y: SUELO },
  objetivo: { tipo: 'meta', monedas: 3 },
  objetos: [
    suelo(0, 420),
    agua(420, 100),

    // Isla flotante: se salta a ella y desde ella.
    { tipo: 'plataformaElevada', x: 520, y: 208, ancho: 120, alto: 8, material: 'piedra' },
    agua(640, 60),

    suelo(700, 900),

    muro(860, 40),
    // Los pinchos van lejos del muro a propósito: si el salto del muro termina
    // encima de ellos, no hay tiempo de reaccionar y el nivel sería injusto.
    pinchos(1140, 48),
    checkpoint(740, { y: SUELO - 34 }),
    checkpoint(1220, { y: SUELO - 34 }),
    meta(1500),

    ...filaMonedas(56, SUELO - 14, 3, 22),
    moneda(540, 208 - 14),
    moneda(600, 208 - 14),
    moneda(864, 200 - 14), // sobre el muro
    ...filaMonedas(1040, SUELO - 14, 2, 24),
    moneda(1230, SUELO - 30), // en el aire, encadena con el segundo checkpoint
    moneda(1400, SUELO - 14)
  ]
});
