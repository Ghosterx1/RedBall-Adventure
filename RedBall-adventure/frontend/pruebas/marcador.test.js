import test from 'node:test';
import assert from 'node:assert/strict';

import { JUEGO } from '../src/config/ajustes.js';
import { Marcador } from '../src/nucleo/Marcador.js';

/**
 * El marcador es la única fuente de verdad de puntos y monedas. Debe ser puro,
 * no desbordarse con datos sucios y servir tanto al HUD como al récord.
 */

test('arranca a cero y conoce el total del nivel', () => {
  const marcador = new Marcador({ totalMonedas: 21 });

  assert.equal(marcador.puntos, 0);
  assert.equal(marcador.monedas, 0);
  assert.equal(marcador.restantes, 21);
  assert.equal(marcador.completo, false);
  assert.equal(marcador.porcentaje, 0);
  assert.equal(marcador.texto, 'monedas 0/21  puntos 0');
});

test('cada moneda suma su valor y descuenta del total', () => {
  const marcador = new Marcador({ totalMonedas: 3 });

  assert.equal(marcador.contarMoneda(), JUEGO.VALOR_MONEDA);
  assert.equal(marcador.contarMoneda(5), 5);

  assert.equal(marcador.monedas, 2);
  assert.equal(marcador.puntos, JUEGO.VALOR_MONEDA + 5);
  assert.equal(marcador.restantes, 1);
  assert.equal(marcador.ultimaGanancia, 5);
  assert.ok(Math.abs(marcador.porcentaje - 2 / 3) < 1e-9);

  marcador.contarMoneda();
  assert.equal(marcador.completo, true);
  assert.equal(marcador.restantes, 0);
  assert.equal(marcador.porcentaje, 1);
});

test('un nivel sin monedas nunca se considera completo', () => {
  const marcador = new Marcador();
  assert.equal(marcador.completo, false);
  assert.equal(marcador.porcentaje, 0);
  assert.equal(marcador.restantes, 0);
});

test('sumar() acepta puntos sueltos y descarta basura', () => {
  const marcador = new Marcador();

  assert.equal(marcador.sumar(25), 25);
  assert.equal(marcador.sumar(-10), 0, 'no se restan puntos');
  assert.equal(marcador.sumar(Number.NaN), 0);
  assert.equal(marcador.sumar(undefined), 0);
  assert.equal(marcador.puntos, 25, 'los valores inválidos no ensucian el total');
});

test('los valores iniciales sucios se normalizan a enteros ≥ 0', () => {
  const marcador = new Marcador({
    puntos: Number.NaN,
    monedas: -3,
    totalMonedas: 4.9
  });

  assert.equal(marcador.puntos, 0);
  assert.equal(marcador.monedas, 0);
  assert.equal(marcador.totalMonedas, 4);
});

test('reiniciar() deja la partida a cero sin perder el total', () => {
  const marcador = new Marcador({ totalMonedas: 5 });
  marcador.contarMoneda();
  marcador.contarMoneda();

  marcador.reiniciar();

  assert.equal(marcador.puntos, 0);
  assert.equal(marcador.monedas, 0);
  assert.equal(marcador.totalMonedas, 5);
});

test('aJSON() resume la partida para guardar el récord', () => {
  const marcador = new Marcador({ totalMonedas: 4 });
  marcador.contarMoneda();
  marcador.contarMoneda();

  assert.deepEqual(marcador.aJSON(), {
    puntos: JUEGO.VALOR_MONEDA * 2,
    monedas: 2,
    totalMonedas: 4
  });
});
