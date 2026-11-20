import test from 'node:test';
import assert from 'node:assert/strict';

import { barreHasta, solapan } from '../src/fisica/aabb.js';
import { Mundo } from '../src/mundo/Mundo.js';

/**
 * Recogida de coleccionables. Lo importante: que no se escape ninguna moneda
 * aunque el cuerpo se mueva muy rápido (barrido continuo) y que un salto
 * enorme —reaparición al morir— NO arrase las monedas del camino de vuelta.
 */

const LADO = 24;

/** Cuerpo mínimo con la misma interfaz que usa Mundo.revisar(). */
function cuerpo({ x = 0, y = 0, ancho = LADO, alto = LADO } = {}) {
  const cuerpo = {
    x,
    y,
    ancho,
    alto,
    contactos: [],
    colocar({ x: nuevoX = cuerpo.x, y: nuevoY = cuerpo.y } = {}) {
      cuerpo.x = nuevoX;
      cuerpo.y = nuevoY;
      return cuerpo;
    }
  };
  Object.defineProperty(cuerpo, 'caja', {
    get: () => ({ x: cuerpo.x, y: cuerpo.y, ancho: cuerpo.ancho, alto: cuerpo.alto })
  });
  return cuerpo;
}

const mundoDePrueba = (objetos, extra = {}) =>
  new Mundo({ ancho: 400, alto: 480, inicio: { x: 60, y: 300 }, objetos, ...extra });

test('el mundo cuenta las monedas al construirse, aunque ya estén cogidas', () => {
  const mundo = mundoDePrueba([
    { tipo: 'moneda', x: 10, y: 10 },
    { tipo: 'moneda', x: 40, y: 10 }
  ]);

  assert.equal(mundo.totalColeccionables, 2);
  assert.equal(mundo.coleccionables.length, 2);

  mundo.coleccionables[0].recoger();

  assert.equal(mundo.coleccionables.length, 1, 'cogida ya no está disponible');
  assert.equal(mundo.totalColeccionables, 2, 'el total del nivel no cambia al recoger');
});

test('se recoge al tocarla', () => {
  const mundo = mundoDePrueba([{ tipo: 'moneda', x: 100, y: 226 }]);
  const jugador = cuerpo({ x: 88, y: 216 });

  const evento = mundo.revisar(jugador);

  assert.equal(evento.monedas.length, 1);
  assert.equal(mundo.coleccionablesRestantes, 0);
});

test('a alta velocidad no se escapa: el barrido cubre todo el recorrido', () => {
  const mundo = mundoDePrueba([{ tipo: 'moneda', x: 190, y: 0 }]);
  const jugador = cuerpo({ x: 164, y: 0 });

  mundo.revisar(jugador); // fija la caja del paso anterior (aún no la toca)
  const moneda = mundo.coleccionables[0];
  const antes = jugador.caja;

  jugador.colocar({ x: 205 }); // 41 px en un solo paso: saltaría el solape discreto

  assert.equal(solapan(jugador.caja, moneda.caja), false, 'el solape puntual falla');
  assert.equal(barreHasta(antes, { dx: 41, dy: 0 }, moneda.caja), true, 'el barrido lo ve');

  const evento = mundo.revisar(jugador);
  assert.equal(evento.monedas.length, 1, 'la moneda se recoge igualmente');
});

test('el barrido no inventa choques al moverse en diagonal', () => {
  const caja = { x: 0, y: 0, ancho: 24, alto: 24 };
  const desplazamiento = { dx: 200, dy: 200 };

  assert.equal(barreHasta(caja, desplazamiento, { x: 150, y: 60, ancho: 14, alto: 14 }), false);
  assert.equal(barreHasta(caja, desplazamiento, { x: 150, y: 150, ancho: 14, alto: 14 }), true);
  assert.equal(barreHasta(caja, { dx: 0, dy: 0 }, { x: 150, y: 150, ancho: 14, alto: 14 }), false);
  assert.equal(barreHasta(caja, { dx: 0, dy: 0 }, { x: 0, y: 0, ancho: 4, alto: 4 }), true);
});

test('un teletransporte (reaparición) no arrasa las monedas del camino', () => {
  const mundo = mundoDePrueba([
    { tipo: 'moneda', x: 200, y: 226 },
    { tipo: 'peligro', x: 300, y: 200, ancho: 40, alto: 40 }
  ]);
  const jugador = cuerpo({ x: 20, y: 216 });

  mundo.revisar(jugador); // guarda la caja del paso
  jugador.colocar({ x: 305, y: 210 }); // salto de casi 300 px: imposible andando

  const evento = mundo.revisar(jugador);

  assert.equal(evento.reiniciado, true, 'el peligro lo devuelve al inicio');
  assert.equal(evento.monedas.length, 0, 'no se recoge nada "por el camino"');
  assert.equal(mundo.coleccionablesRestantes, 1, 'la moneda sigue en el nivel');
  assert.equal(jugador.x, 60 - LADO / 2, 'vuelve al punto de inicio');
});

test('cada moneda cuenta una sola vez aunque el cuerpo siga encima', () => {
  const mundo = mundoDePrueba([{ tipo: 'moneda', x: 100, y: 226 }]);
  const jugador = cuerpo({ x: 90, y: 216 });

  assert.equal(mundo.revisar(jugador).monedas.length, 1);
  for (let i = 0; i < 5; i++) {
    assert.equal(mundo.revisar(jugador).monedas.length, 0, 'no se recuenta');
  }
});

test('dos monedas en el mismo paso se recogen las dos', () => {
  const mundo = mundoDePrueba([
    { tipo: 'moneda', x: 100, y: 0 },
    { tipo: 'moneda', x: 130, y: 0 }
  ]);
  const jugador = cuerpo({ x: 68, y: 0 });

  mundo.revisar(jugador);
  jugador.colocar({ x: 112 }); // 44 px: atraviesa las dos en el mismo paso

  const evento = mundo.revisar(jugador);

  assert.equal(evento.monedas.length, 2);
  assert.equal(mundo.coleccionablesRestantes, 0);
});

test('reiniciar() devuelve las monedas y olvida el paso anterior', () => {
  const mundo = mundoDePrueba([
    { tipo: 'moneda', x: 10, y: 10 },
    { tipo: 'moneda', x: 50, y: 10 }
  ]);

  mundo.revisar(cuerpo({ x: 200, y: 200 })); // guarda una caja lejos de las monedas
  mundo.coleccionables[0].recoger();
  assert.equal(mundo.coleccionablesRestantes, 1);

  mundo.reiniciar();

  assert.equal(mundo.coleccionablesRestantes, 2);
  assert.equal(mundo.totalColeccionables, 2);
  assert.equal(mundo.ultimaCajaJugador, null);
});
