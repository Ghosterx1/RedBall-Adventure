import test from 'node:test';
import assert from 'node:assert/strict';

import { progresoVacio, registrarPartida } from '../src/nucleo/Progreso.js';
import {
  avance,
  estaCompletado,
  estaDesbloqueado,
  nivelInicial,
  nivelesCompletados,
  nivelesDesbloqueados,
  siguienteDesbloqueado
} from '../src/nucleo/Progresion.js';
import { idsDeNiveles } from '../src/mundo/niveles/index.js';

/**
 * La progresión es UNA regla, no un montón de banderas: el primer nivel siempre
 * está abierto y cada nivel completado abre el siguiente. La lista de
 * desbloqueados se DEDUCE del progreso guardado, así que aquí se comprueba que
 * no hay estado propio que se pueda contradecir.
 */

const IDS = idsDeNiveles(); // nivel-1 … nivel-5 (orden de juego)

/** Progreso con esos niveles superados (el resto sin tocar). */
function progresoCon(...completados) {
  return completados.reduce(
    (progreso, id) =>
      registrarPartida(progreso, {
        nivel: id,
        puntos: 100,
        monedas: 3,
        totalMonedas: 8,
        completado: true
      }),
    progresoVacio()
  );
}

test('sin progreso solo está abierto el primer nivel', () => {
  const progreso = progresoVacio();

  assert.deepEqual(nivelesDesbloqueados(progreso, IDS), [IDS[0]]);
  assert.equal(estaDesbloqueado(progreso, IDS[0], IDS), true);
  assert.equal(estaDesbloqueado(progreso, IDS[1], IDS), false, 'no se puede saltar al segundo');
});

test('cada nivel completado abre exactamente el siguiente', () => {
  const progreso = progresoCon('nivel-1');

  assert.deepEqual(nivelesDesbloqueados(progreso, IDS), ['nivel-1', 'nivel-2']);
  assert.equal(estaDesbloqueado(progreso, 'nivel-3'), false);

  const todos = progresoCon(...IDS);
  assert.deepEqual(nivelesDesbloqueados(todos, IDS), IDS, 'con todo superado, todo abierto');
});

test('una partida sin completar no desbloquea nada', () => {
  const progreso = registrarPartida(progresoVacio(), {
    nivel: 'nivel-1',
    puntos: 40,
    monedas: 1,
    totalMonedas: 8,
    completado: false
  });

  assert.equal(estaCompletado(progreso, 'nivel-1'), false);
  assert.deepEqual(nivelesDesbloqueados(progreso, IDS), ['nivel-1']);
});

test('el desbloqueo se deduce: no se guarda ninguna lista de desbloqueados', () => {
  const progreso = progresoCon('nivel-1', 'nivel-2');

  assert.equal('desbloqueados' in progreso, false, 'no hay estado propio de progresión');
  assert.doesNotMatch(JSON.stringify(progreso), /desbloqueados/);
  // La misma verdad se recalcula en cada llamada, sin memoria escondida.
  assert.deepEqual(nivelesDesbloqueados(progreso, IDS), nivelesDesbloqueados(progreso, IDS));
});

test('nivelInicial() propone el primero desbloqueado sin completar', () => {
  assert.equal(nivelInicial(progresoVacio(), IDS), 'nivel-1');
  assert.equal(nivelInicial(progresoCon('nivel-1'), IDS), 'nivel-2');
  assert.equal(nivelInicial(progresoCon('nivel-1', 'nivel-2'), IDS), 'nivel-3');
  assert.equal(
    nivelInicial(progresoCon(...IDS), IDS),
    IDS.at(-1),
    'con todo superado se ofrece el último para repetirlo'
  );
  assert.equal(nivelInicial(progresoVacio(), []), null, 'sin catálogo no hay nada que jugar');
});

test('siguienteDesbloqueado() no deja saltarse niveles', () => {
  assert.equal(siguienteDesbloqueado(progresoVacio(), 'nivel-1', IDS), null, 'sin superarlo, no hay siguiente');
  assert.equal(siguienteDesbloqueado(progresoCon('nivel-1'), 'nivel-1', IDS), 'nivel-2');
  assert.equal(siguienteDesbloqueado(progresoCon(...IDS), IDS.at(-1), IDS), null, 'el último no tiene siguiente');
  assert.equal(siguienteDesbloqueado(progresoVacio(), 'no-existe', IDS), null);
});

test('nivelesCompletados() y avance() resumen el estado para el HUD', () => {
  assert.equal(nivelesCompletados(progresoVacio(), IDS), 0);
  assert.equal(avance(progresoVacio(), IDS), 0);
  assert.equal(avance(progresoVacio(), []), 0, 'sin catálogo no se divide por cero');

  const dos = progresoCon('nivel-1', 'nivel-2');
  assert.equal(nivelesCompletados(dos, IDS), 2);
  assert.equal(avance(dos, IDS), 2 / IDS.length);

  const todos = progresoCon(...IDS);
  assert.equal(nivelesCompletados(todos, IDS), IDS.length);
  assert.equal(avance(todos, IDS), 1, 'el juego completo llega a 1');
});

test('un nivel completado fuera del catálogo no abre nada', () => {
  const progreso = progresoCon('nivel-suelto');

  assert.equal(estaCompletado(progreso, 'nivel-suelto'), true);
  assert.deepEqual(nivelesDesbloqueados(progreso, IDS), ['nivel-1'], 'el catálogo manda');
  assert.equal(nivelesCompletados(progreso, IDS), 0);
});
