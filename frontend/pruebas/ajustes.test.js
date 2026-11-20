import test from 'node:test';
import assert from 'node:assert/strict';

import { FISICA, PASO_FIJO, TOPE_TIEMPO, MAX_PASOS, VISTA, JUEGO } from '../src/config/ajustes.js';
import { PALETA } from '../src/config/paleta.js';
import { MATERIALES, material } from '../src/config/materiales.js';

/**
 * Estas pruebas son el contrato de "no romper el juego" al refactorizar:
 * las constantes nuevas en unidades reales (px/s) deben reproducir EXACTAMENTE
 * lo que medía el prototipo (px/frame a 60 Hz) en el harness headless.
 */
test('las constantes conservan el salto original: ápice 84,18 px en 46 frames', () => {
  let vy = FISICA.SALTO_VELOCIDAD;
  let y = 0;
  let apice = 0;
  let framesEnAire = 0;

  for (let i = 0; i < 600; i++) {
    vy = Math.min(vy + FISICA.GRAVEDAD * PASO_FIJO, FISICA.CAIDA_MAXIMA);
    y += vy * PASO_FIJO;
    if (y < 0) {
      framesEnAire++;
      if (y < apice) apice = y;
    } else if (framesEnAire > 0) {
      break;
    }
  }

  assert.ok(Math.abs(-apice - 84.18) < 0.01, `ápice medido: ${(-apice).toFixed(3)} px`);
  assert.ok(Math.abs(framesEnAire - 46) <= 1, `frames en aire: ${framesEnAire}`);
});

test('el alcance horizontal del salto ronda los 230 px', () => {
  const distancia = 46 * FISICA.VELOCIDAD_MAXIMA * PASO_FIJO;
  assert.ok(Math.abs(distancia - 230) <= 5, `alcance: ${distancia.toFixed(1)} px`);
});

test('la conversión px/frame → px/s es coherente', () => {
  assert.ok(Math.abs(FISICA.GRAVEDAD / 3600 - 0.32) < 1e-12);
  assert.ok(Math.abs(FISICA.SALTO_VELOCIDAD / 60 + 7.5) < 1e-12);
  assert.ok(Math.abs(FISICA.CAIDA_MAXIMA / 60 - 7) < 1e-12);
  assert.ok(Math.abs(FISICA.VELOCIDAD_MAXIMA / 60 - 5) < 1e-12);
  assert.ok(Math.abs(FISICA.ACELERACION / 3600 - 0.5) < 1e-12);
});

test('los valores del bucle son seguros', () => {
  assert.ok(PASO_FIJO > 0 && PASO_FIJO < 0.1);
  assert.ok(TOPE_TIEMPO >= PASO_FIJO);
  assert.ok(MAX_PASOS * PASO_FIJO >= TOPE_TIEMPO * 0.5);
  assert.equal(VISTA.ANCHO / VISTA.ALTO, 16 / 9);
  assert.ok(Number.isInteger(VISTA.TILE));
  assert.ok(JUEGO.VIDAS_INICIALES > 0);
});

test('la paleta solo contiene colores válidos e inmutables', () => {
  const hex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  const claves = Object.keys(PALETA);

  assert.ok(claves.length >= 30, 'faltan colores migrados de Interfaz.js');
  for (const clave of claves) {
    assert.match(PALETA[clave], hex, `color inválido en PALETA.${clave}`);
  }
  assert.equal(Object.isFrozen(PALETA), true);
});

test('los materiales tienen todos sus propiedades y hay respaldo seguro', () => {
  for (const [nombre, mat] of Object.entries(MATERIALES)) {
    assert.equal(typeof mat.friccion, 'number', `${nombre}.friccion`);
    assert.equal(typeof mat.restitucion, 'number', `${nombre}.restitucion`);
    assert.equal(typeof mat.solido, 'boolean', `${nombre}.solido`);
    assert.ok(Object.isFrozen(mat), `${nombre} debe ser inmutable`);
  }

  assert.equal(material('no-existe'), MATERIALES.cesped);
  assert.equal(material(), MATERIALES.cesped);
  assert.equal(material('hielo'), MATERIALES.hielo);
});
