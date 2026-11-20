import test from 'node:test';
import assert from 'node:assert/strict';

import { PASO_FIJO } from '../src/config/ajustes.js';
import { Jugador } from '../src/entidades/Jugador.js';
import { asentarEnSuperficies } from '../src/fisica/Colisiones.js';
import * as Fisica from '../src/fisica/Fisica.js';
import { Rampa } from '../src/mundo/tipos.js';

/**
 * Rampas: una superficie inclinada es una función alturaEn(x) + normalEn(x).
 * El motor solo la usa si el mundo la declara, y lo hace DESPUÉS del barrido:
 * asienta el cuerpo sobre la pendiente, sin bloquear el movimiento horizontal.
 */

const LADO = 24;
const cuerpo = (x, y, extra = {}) => ({ x, y, ancho: LADO, alto: LADO, vy: 0, ...extra });

/** Rampa de 100 px de ancho que sube 40 px hacia la derecha: (100,200) → (200,160). */
const rampa = new Rampa({ x: 100, y: 200, ancho: 100, alto: 40, pendiente: 'sube' });

test('una penetración pequeña se corrige: el cuerpo queda sobre la pendiente', () => {
  const bola = cuerpo(138, 160); // centro x = 150 → superficie en y = 180
  const contactos = asentarEnSuperficies(bola, [rampa]);

  assert.equal(bola.y, 180 - LADO, 'se asienta exactamente sobre la superficie');
  assert.equal(contactos.length, 1);
  assert.equal(contactos[0].eje, 'y');
  assert.equal(contactos[0].superficie, true);
  assert.equal(contactos[0].solido, rampa, 'el contacto identifica la superficie');
  assert.ok(contactos[0].normal.y < 0, 'empuja hacia arriba');
});

test('por encima, por debajo y fuera del tramo no se toca nada', () => {
  const volando = cuerpo(138, 120); // 40 px por encima de la superficie
  assert.deepEqual(asentarEnSuperficies(volando, [rampa]), []);
  assert.equal(volando.y, 120, 'no se teletransporta hacia abajo');

  const debajo = cuerpo(138, 260); // muy por debajo: la rampa es atravesable
  assert.deepEqual(asentarEnSuperficies(debajo, [rampa]), []);
  assert.equal(debajo.y, 260);

  const fuera = cuerpo(258, 160); // centro x = 270, fuera de 100..200
  assert.deepEqual(asentarEnSuperficies(fuera, [rampa]), []);
});

test('subiendo no se pega a la pendiente; cayendo justo encima sí', () => {
  // Centro x = 150 → superficie en y = 180. Con y = 152 los pies (176) quedan
  // 4 px POR ENCIMA de la superficie: cabe asentarse.
  const salta = cuerpo(138, 152, { vy: -450 });
  assert.deepEqual(asentarEnSuperficies(salta, [rampa]), [], 'subiendo se suelta');

  const cae = cuerpo(138, 152, { vy: 100 });
  const contactos = asentarEnSuperficies(cae, [rampa]);
  assert.equal(contactos.length, 1, 'bajando se posa');
  assert.equal(cae.y, 180 - LADO);
});

test('sin superficies declaradas el motor no cambia nada', () => {
  const bola = cuerpo(138, 160, { vx: 100, vy: 50 });
  assert.doesNotThrow(() => Fisica.desplazar(bola, PASO_FIJO, []));
  assert.equal(bola.vy, 50, 'sin rampas la velocidad vertical sigue igual');
});


/* ───────────── Integración con el jugador ─────────────────────────────── */

/**
 * Mundo con suelo bajo (240), cornisa 32 px más alta (208) y una rampa en medio.
 * La rampa une los dos niveles: en 'sube' la cornisa queda a la derecha.
 */
const mundoConRampa = (pendiente) => {
  const sube = pendiente === 'sube';
  return {
    solidos: [
      sube
        ? { x: 0, y: 240, ancho: 100, alto: 30, material: 'cesped' }
        : { x: 200, y: 240, ancho: 200, alto: 30, material: 'cesped' },
      sube
        ? { x: 200, y: 208, ancho: 200, alto: 62, material: 'cesped' }
        : { x: 0, y: 208, ancho: 100, alto: 62, material: 'cesped' }
    ],
    superficies: [
      new Rampa({ x: 100, y: sube ? 240 : 208, ancho: 100, alto: 32, pendiente })
    ]
  };
};

const paso = (jugador, mundo, control = {}) =>
  jugador.actualizar(PASO_FIJO, {
    control: { eje: 0, salto: false, saltoMantenido: false, impulso: false, ...control },
    solidos: mundo.solidos,
    superficies: mundo.superficies,
    limites: { ancho: 400, alto: 400 }
  });

test('se sube la rampa andando, sin escalones ni bloqueos', () => {
  const mundo = mundoConRampa('sube');
  const jugador = new Jugador({ x: 40, y: 240 - LADO, ancho: LADO, alto: LADO, enSuelo: true });

  const alturas = [];
  let sinSueloEnRampa = 0;

  for (let i = 0; i < 120; i++) {
    paso(jugador, mundo, { eje: 1 });
    const centro = jugador.x + LADO / 2;
    if (centro > 110 && centro < 190) {
      alturas.push(jugador.y);
      if (!jugador.enSuelo) sinSueloEnRampa++;
    }
  }

  assert.ok(alturas.length > 10, 'debe haber recorrido la rampa');
  assert.equal(sinSueloEnRampa, 0, 'andando por la rampa siempre se toca la pendiente');
  for (let i = 1; i < alturas.length; i++) {
    assert.ok(alturas[i] <= alturas[i - 1] + 1e-9, 'la altura sube (y decrece) sin rebotes');
  }
  assert.ok(jugador.y + LADO <= 208 + 1e-6, `acaba en la cornisa: pies en ${jugador.y + LADO}`);
  assert.ok(jugador.x > 200, 'ha cruzado la rampa');
});

test('se baja la rampa andando sin despegarse de la pendiente', () => {
  const mundo = mundoConRampa('baja');
  const jugador = new Jugador({ x: 60, y: 208 - LADO, ancho: LADO, alto: LADO, enSuelo: true });

  let sinSueloEnRampa = 0;
  for (let i = 0; i < 120; i++) {
    paso(jugador, mundo, { eje: 1 });
    const centro = jugador.x + LADO / 2;
    if (centro > 110 && centro < 190 && !jugador.enSuelo) sinSueloEnRampa++;
  }

  assert.equal(sinSueloEnRampa, 0, 'la gravedad sola no alcanzaría la cuesta: el motor la pega');
  assert.ok(Math.abs(jugador.y + LADO - 240) < 1e-6, `termina en el suelo: ${jugador.y + LADO}`);
});

test('desde la rampa se puede saltar: la pendiente no retiene', () => {
  const mundo = mundoConRampa('sube');
  const jugador = new Jugador({ x: 40, y: 240 - LADO, ancho: LADO, alto: LADO, enSuelo: true });

  // Andando hasta quedar sobre la pendiente.
  for (let i = 0; i < 30; i++) paso(jugador, mundo, { eje: 1 });
  const yEnRampa = jugador.y;
  assert.equal(jugador.enSuelo, true, 'debe ir apoyado en la rampa');
  assert.ok(yEnRampa < 240 - LADO - 4, `ya ha subido algo: y = ${yEnRampa.toFixed(2)}`);

  paso(jugador, mundo, { salto: true, saltoMantenido: true, eje: 1 });
  assert.ok(jugador.vy < 0, 'el salto funciona sobre la pendiente');

  for (let i = 0; i < 10; i++) paso(jugador, mundo, { saltoMantenido: true, eje: 1 });
  assert.ok(jugador.y < yEnRampa - 20, 'se despega de la rampa de verdad');
});

test('desde abajo la rampa es atravesable (una sola dirección)', () => {
  const mundo = mundoConRampa('sube');
  const jugador = new Jugador({ x: 140, y: 320, ancho: LADO, alto: LADO, vy: -450 });

  for (let i = 0; i < 6; i++) paso(jugador, mundo, { saltoMantenido: true });

  assert.equal(jugador.enSuelo, false, 'sigue en el aire: no se asienta desde abajo');
  assert.ok(jugador.y < 320, 'ha subido por su propio salto');
});
