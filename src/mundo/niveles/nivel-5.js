import { VISTA } from '../../config/ajustes.js';
import { SUELO, agua, filaMonedas, meta, moneda, muro, checkpoint, pinchos, suelo } from './ayudas.js';

/**
 * nivel-5.js — "La cumbre" (dificultad 5).
 *
 * Todo a la vez: tres fosos de agua de 140 px, rampa + cornisa, trampolín,
 * obstáculo móvil, pinchos y una plataforma que cruza el segundo foso. El
 * objetivo pide 12 de las 20 monedas, así que hay que desviarse a por ellas.
 */
export const NIVEL_5 = Object.freeze({
  id: 'nivel-5',
  orden: 5,
  nombre: 'La cumbre',
  dificultad: 5,
  ancho: 2200,
  alto: VISTA.ALTO,
  inicio: { x: 40, y: SUELO },
  objetivo: { tipo: 'meta', monedas: 12 },
  objetos: [
    suelo(0, 320),
    agua(320, 140),
    { tipo: 'efimera', x: 350, y: SUELO - 4, ancho: 60, alto: 8, etiqueta: 'efimera' },

    suelo(460, 640),
    checkpoint(480, { y: SUELO - 34 }),

    // Rampa + cornisa: el único tramo elevado del nivel.
    { tipo: 'rampa', x: 700, y: SUELO, ancho: 64, alto: 32, pendiente: 'sube', material: 'cesped' },
    { tipo: 'plataformaElevada', x: 764, y: 208, ancho: 110, alto: 8, material: 'piedra' },
    muro(920, 40),
    pinchos(1000, 48),

    agua(1100, 140),
    { tipo: 'movil', x: 1120, y: SUELO - 46, ancho: 64, alto: 8, eje: 'x', recorrido: 60, velocidad: 50 },

    suelo(1240, 460),
    {
      tipo: 'obstaculoMovil',
      x: 1300,
      y: SUELO - 16,
      ancho: 16,
      alto: 16,
      eje: 'x',
      recorrido: 100,
      velocidad: 70
    },
    { tipo: 'elastica', x: 1450, y: SUELO - 8, ancho: 48, alto: 8, etiqueta: 'elastica' },
    checkpoint(1500, { y: SUELO - 34 }),

    agua(1700, 140),
    suelo(1840, 360),
    pinchos(1950, 48),
    checkpoint(1860, { y: SUELO - 34 }),
    meta(2100),

    ...filaMonedas(56, SUELO - 14, 3, 22),
    moneda(330, SUELO - 40), // sobre el primer foso
    moneda(380, SUELO - 46), // sobre el puente efímero
    ...filaMonedas(520, SUELO - 14, 2, 24),
    moneda(720, SUELO - 70), // en plena rampa
    ...filaMonedas(780, 208 - 14, 2, 26),
    moneda(840, 208 - 14),
    moneda(928, 200 - 14), // coronando el muro
    moneda(1024, SUELO - 36), // pasado los pinchos
    moneda(1130, SUELO - 60), // la paga la plataforma móvil
    moneda(1270, SUELO - 40), // sobre el agua del segundo foso
    moneda(1340, SUELO - 44), // arco sobre el obstáculo móvil
    moneda(1474, SUELO - 70), // altura del trampolín
    moneda(1620, SUELO - 14),
    moneda(1712, SUELO - 46), // sobre el tercer foso
    moneda(1974, SUELO - 40) // pasado los últimos pinchos
  ]
});
