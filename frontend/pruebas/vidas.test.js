import test from 'node:test';
import assert from 'node:assert/strict';

import { Vidas } from '../src/nucleo/Vidas.js';
import { JUEGO } from '../src/config/ajustes.js';

/**
 * Vidas de la partida: duran más que un nivel y nunca se pueden quedar en
 * negativo. Aquí se fija ese contrato sin escena, sin DOM y sin canvas.
 */

test('se empieza con las vidas configuradas', () => {
  const vidas = new Vidas();

  assert.equal(vidas.restantes, JUEGO.VIDAS_INICIALES);
  assert.equal(vidas.iniciales, JUEGO.VIDAS_INICIALES);
  assert.equal(vidas.maximo, JUEGO.VIDAS_INICIALES);
  assert.equal(vidas.agotadas, false);
  assert.equal(vidas.llenas, true);
});

test('perder() gasta una vida y devuelve cuántas quedan', () => {
  const vidas = new Vidas({ iniciales: 3 });

  assert.equal(vidas.perder(), 2);
  assert.equal(vidas.restantes, 2);
  assert.equal(vidas.llenas, false);
  assert.equal(vidas.agotadas, false);

  assert.equal(vidas.perder(2), 0);
  assert.equal(vidas.agotadas, true);
});

test('perder() nunca deja el contador en negativo', () => {
  const vidas = new Vidas({ iniciales: 1 });

  assert.equal(vidas.perder(), 0);
  assert.equal(vidas.perder(5), 0, 'avisar dos veces de la misma muerte no resta dos veces');
  assert.equal(vidas.restantes, 0);
});

test('ganar() no pasa del máximo y reiniciar() vuelve a las iniciales', () => {
  const vidas = new Vidas({ iniciales: 2, maximo: 4 });

  assert.equal(vidas.ganar(), 3);
  assert.equal(vidas.ganar(10), 4, 'el máximo es un tope duro');
  assert.equal(vidas.maximo, 4);

  vidas.perder(3);
  assert.equal(vidas.restantes, 1);
  vidas.reiniciar();
  assert.equal(vidas.restantes, 2, 'reiniciar vuelve a las vidas iniciales, no al máximo');
});

test('los datos sucios se normalizan (enteros ≥ 1)', () => {
  assert.equal(new Vidas({ iniciales: 0 }).restantes, JUEGO.VIDAS_INICIALES);
  assert.equal(new Vidas({ iniciales: NaN }).restantes, JUEGO.VIDAS_INICIALES);
  assert.equal(new Vidas({ iniciales: -4 }).restantes, JUEGO.VIDAS_INICIALES);
  assert.equal(new Vidas({ iniciales: 'tres' }).restantes, JUEGO.VIDAS_INICIALES);
  assert.equal(new Vidas({ iniciales: 2, maximo: 1 }).maximo, 2, 'el máximo nunca baja de las iniciales');

  const vidas = new Vidas({ iniciales: 3 });
  assert.equal(vidas.perder(0), 3, 'perder 0 vidas no hace nada raro');
  assert.equal(vidas.perder(NaN), 2);
});
