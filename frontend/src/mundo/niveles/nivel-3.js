import { VISTA } from '../../config/ajustes.js';
import { SUELO, agua, filaMonedas, meta, moneda, checkpoint, pinchos, suelo } from './ayudas.js';

/**
 * nivel-3.js — "Cuidado" (dificultad 3).
 *
 * El agua empieza a pesar: un foso ancho con un puente efímero en medio, un
 * obstáculo que se mueve y una plataforma móvil sobre otro foso. El objetivo
 * sube a 6 de las 12 monedas, así que ya no basta con llegar corriendo.
 */
export const NIVEL_3 = Object.freeze({
  id: 'nivel-3',
  orden: 3,
  nombre: 'Cuidado',
  dificultad: 3,
  ancho: 1800,
  alto: VISTA.ALTO,
  inicio: { x: 40, y: SUELO },
  objetivo: { tipo: 'meta', monedas: 6 },
  objetos: [
    suelo(0, 400),
    agua(400, 120),
    // Puente efímero: aguanta lo justo para apoyarse en mitad del salto.
    { tipo: 'efimera', x: 430, y: SUELO - 4, ancho: 60, alto: 8, etiqueta: 'efimera' },

    suelo(520, 380),

    // Obstáculo que va y viene a ras de suelo: hay que pasar cuando no esté.
    {
      tipo: 'obstaculoMovil',
      x: 640,
      y: SUELO - 16,
      ancho: 16,
      alto: 16,
      eje: 'x',
      recorrido: 80,
      velocidad: 55
    },
    checkpoint(560, { y: SUELO - 34 }),
    checkpoint(820, { y: SUELO - 34 }),

    // Foso seco con plataforma móvil encima (opcional: también se salta).
    { tipo: 'movil', x: 905, y: SUELO - 46, ancho: 60, alto: 8, eje: 'x', recorrido: 60, velocidad: 45 },

    suelo(1000, 800),
    pinchos(1200, 48),
    meta(1700),

    ...filaMonedas(56, SUELO - 14, 3, 22),
    moneda(406, SUELO - 34), // encima del agua: obliga a saltar con decisión
    moneda(460, SUELO - 40), // sobre el puente efímero
    moneda(600, SUELO - 14),
    moneda(700, SUELO - 44), // arco sobre el obstáculo móvil
    moneda(860, SUELO - 14),
    moneda(935, SUELO - 60), // la paga la plataforma móvil
    ...filaMonedas(1060, SUELO - 14, 2, 24),
    moneda(1240, SUELO - 34), // en el aire, pasado los pinchos
    moneda(1500, SUELO - 14)
  ]
});
