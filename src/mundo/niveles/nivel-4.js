import { VISTA } from '../../config/ajustes.js';
import { SUELO, agua, filaMonedas, meta, moneda, muro, checkpoint, pinchos, suelo } from './ayudas.js';

/**
 * nivel-4.js — "Carrera" (dificultad 4).
 *
 * Tres fosos de agua seguidos de 100 px, un trampolín para coger altura, un muro
 * alto y un obstáculo móvil. El objetivo pide 8 de las 15 monedas: hay que
 * arriesgar en los arcos, no solo correr.
 */
export const NIVEL_4 = Object.freeze({
  id: 'nivel-4',
  orden: 4,
  nombre: 'Carrera',
  dificultad: 4,
  ancho: 2000,
  alto: VISTA.ALTO,
  inicio: { x: 40, y: SUELO },
  objetivo: { tipo: 'meta', monedas: 8 },
  objetos: [
    suelo(0, 360),
    agua(360, 80),

    suelo(440, 320),
    // Trampolín a ras de suelo: el rebote es la forma más rápida de subir.
    { tipo: 'elastica', x: 600, y: SUELO - 8, ancho: 48, alto: 8, etiqueta: 'elastica' },
    agua(760, 120),

    suelo(880, 420),
    muro(1000, 56),
    // Los pinchos van al borde del barranco, lejos del salto del muro: si
    // caes justo encima de ellos no hay tiempo de reaccionar (es injusto).
    pinchos(1240, 48),
    agua(1300, 120),

    suelo(1420, 580),
    {
      tipo: 'obstaculoMovil',
      x: 1550,
      y: SUELO - 16,
      ancho: 16,
      alto: 16,
      eje: 'x',
      recorrido: 100,
      velocidad: 65
    },
    checkpoint(460, { y: SUELO - 34 }),
    checkpoint(900, { y: SUELO - 34 }),
    checkpoint(1440, { y: SUELO - 34 }),
    meta(1900),

    ...filaMonedas(56, SUELO - 14, 3, 22),
    moneda(370, SUELO - 34), // sobre el primer foso
    moneda(520, SUELO - 14),
    moneda(624, SUELO - 70), // la altura del trampolín
    moneda(700, SUELO - 30), // en el aire, camino del segundo foso
    moneda(820, SUELO - 40), // sobre el agua
    ...filaMonedas(940, SUELO - 14, 2, 24),
    moneda(1008, 184 - 14), // coronando el muro alto
    moneda(1360, SUELO - 44), // sobre el tercer foso
    ...filaMonedas(1480, SUELO - 14, 2, 24),
    moneda(1600, SUELO - 44), // sobre el obstáculo móvil
    moneda(1750, SUELO - 14)
  ]
});
