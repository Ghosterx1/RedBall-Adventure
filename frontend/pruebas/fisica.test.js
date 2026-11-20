import test from 'node:test';
import assert from 'node:assert/strict';

import { FISICA, PASO_FIJO } from '../src/config/ajustes.js';
import {
  acelerar,
  alturaMaxima,
  frenar,
  limitarVelocidad,
  parametrosSalto,
  tiempoEnAire
} from '../src/fisica/Fisica.js';

/**
 * Contrato de Fisica: las fórmulas y los modelos de movimiento.
 * Aquí se comprueba la matemática, no la integración con el juego
 * (eso lo cubren jugador.test.js y escena-prueba.test.js).
 */

test('las fórmulas del salto describen las constantes del juego', () => {
  const v0 = Math.abs(FISICA.SALTO_VELOCIDAD);

  // h = v² / (2g) → 450² / (2 · 1152) = 87,89 px
  assert.ok(Math.abs(alturaMaxima(v0) - 87.890625) < 1e-9);
  // t = 2v / g → 900 / 1152 = 0,78125 s = 46,9 frames
  assert.ok(Math.abs(tiempoEnAire(v0) - 0.78125) < 1e-9);
});

test('parametrosSalto es la inversa exacta: altura y duración son ajustables', () => {
  const { velocidad, gravedad } = parametrosSalto(84, 0.8);

  assert.ok(Math.abs(alturaMaxima(velocidad, gravedad) - 84) < 1e-9);
  assert.ok(Math.abs(tiempoEnAire(velocidad, gravedad) - 0.8) < 1e-9);
  assert.ok(velocidad < 0, 'la velocidad de salto apunta hacia arriba');

  // Y con las constantes reales se recupera el salto original:
  const real = parametrosSalto(87.890625, 0.78125);
  assert.ok(Math.abs(real.velocidad - FISICA.SALTO_VELOCIDAD) < 1e-9);
  assert.ok(Math.abs(real.gravedad - FISICA.GRAVEDAD) < 1e-9);

  assert.throws(() => parametrosSalto(0, 1), RangeError);
  assert.throws(() => parametrosSalto(10, 0), RangeError);
});

test('la aceleración llega al máximo exacto y no lo sobrepasa', () => {
  const cuerpo = { vx: 0, vy: 0 };
  const pasos = FISICA.VELOCIDAD_MAXIMA / (FISICA.ACELERACION * PASO_FIJO); // 10 pasos

  for (let i = 0; i < pasos; i++) acelerar(cuerpo, 1, PASO_FIJO);
  assert.equal(cuerpo.vx, FISICA.VELOCIDAD_MAXIMA);

  for (let i = 0; i < 30; i++) acelerar(cuerpo, 1, PASO_FIJO);
  assert.equal(cuerpo.vx, FISICA.VELOCIDAD_MAXIMA, 'acelerar de más no rompe el límite');
});

test('cambiar de dirección desacelera pasando por cero', () => {
  const cuerpo = { vx: FISICA.VELOCIDAD_MAXIMA, vy: 0 };
  let cruzoCero = false;

  for (let i = 0; i < 40; i++) {
    acelerar(cuerpo, -1, PASO_FIJO);
    if (cuerpo.vx === 0) cruzoCero = true;
  }

  assert.ok(cruzoCero, 'debe pasar por cero, no teletransportarse al otro lado');
  assert.equal(cuerpo.vx, -FISICA.VELOCIDAD_MAXIMA);
});

test('la fricción del césped detiene y la del hielo deja deslizar', () => {
  const cesped = { vx: FISICA.VELOCIDAD_MAXIMA };
  const hielo = { vx: FISICA.VELOCIDAD_MAXIMA };

  for (let i = 0; i < 60; i++) {
    frenar(cesped, PASO_FIJO, 0.8);
    frenar(hielo, PASO_FIJO, 0.98);
  }

  assert.equal(cesped.vx, 0, 'el césped debe detener la bola en 1 s');
  assert.ok(hielo.vx > 60, `el hielo debe seguir deslizando (vx = ${hielo.vx.toFixed(1)})`);
});

test('la fricción por segundo no depende de dt (factor^(dt·60))', () => {
  const a60 = { vx: 300 };
  const a120 = { vx: 300 };

  for (let i = 0; i < 60; i++) frenar(a60, 1 / 60, 0.8, { umbralParada: 0 });
  for (let i = 0; i < 120; i++) frenar(a120, 1 / 120, 0.8, { umbralParada: 0 });

  assert.ok(Math.abs(a60.vx - a120.vx) < 1e-6, `${a60.vx} vs ${a120.vx}`);
});

test('limitarVelocidad topa el avance y la caída, pero nunca el salto', () => {
  const cuerpo = { vx: 9999, vy: 9999 };
  limitarVelocidad(cuerpo);
  assert.equal(cuerpo.vx, FISICA.VELOCIDAD_MAXIMA);
  assert.equal(cuerpo.vy, FISICA.CAIDA_MAXIMA);

  cuerpo.vx = 9999;
  cuerpo.vy = 9999;
  limitarVelocidad(cuerpo, { horizontal: 600, caidaMaxima: 1000 });
  assert.equal(cuerpo.vx, 600);
  assert.equal(cuerpo.vy, 1000);

  cuerpo.vx = -9999;
  limitarVelocidad(cuerpo);
  assert.equal(cuerpo.vx, -FISICA.VELOCIDAD_MAXIMA, 'el avance se topa en los dos sentidos');

  // La subida NO se recorta: si se recortara, el salto perdería altura.
  cuerpo.vy = FISICA.SALTO_VELOCIDAD;
  limitarVelocidad(cuerpo);
  assert.equal(cuerpo.vy, FISICA.SALTO_VELOCIDAD);
});
