import test from 'node:test';
import assert from 'node:assert/strict';

import { NIVEL } from '../src/config/ajustes.js';
import {
  OBJETIVOS_VALIDOS,
  TIPOS_OBJETIVO,
  esObjetivoValido,
  estadoObjetivo,
  normalizarObjetivo,
  textoObjetivo
} from '../src/mundo/objetivo.js';

/**
 * El objetivo de un nivel es DATA y una función pura: (objetivo, estado de la
 * partida) → ¿cumplido?. Aquí se fija el contrato que usan la escena, el HUD y
 * el validador:
 *   - sin `objetivo`, el nivel se supera recogiendo TODAS las monedas,
 *   - "meta" puede exigir un mínimo de monedas encima,
 *   - las monedas exigidas siempre son un entero ≥ 0,
 *   - un nivel de monedas sin monedas NUNCA se supera solo.
 */

test('sin objetivo declarado se superan recogiendo todas las monedas', () => {
  const porDefecto = normalizarObjetivo();

  assert.equal(NIVEL.OBJETIVO_POR_DEFECTO, TIPOS_OBJETIVO.MONEDAS);
  assert.deepEqual({ ...porDefecto }, { tipo: 'monedas', monedas: 0 });
  assert.deepEqual({ ...normalizarObjetivo(undefined) }, { tipo: 'monedas', monedas: 0 });
  assert.deepEqual({ ...normalizarObjetivo(null) }, { tipo: 'monedas', monedas: 0 });
});

test('acepta el objetivo escrito corto ("meta") y escrito largo', () => {
  const corto = normalizarObjetivo('meta');
  const largo = normalizarObjetivo({ tipo: 'meta' });

  assert.deepEqual({ ...corto }, { ...largo });
  assert.deepEqual({ ...corto }, { tipo: 'meta', monedas: 0 });
});

test('solo la meta puede exigir monedas; "monedas" ya exige todas', () => {
  assert.deepEqual({ ...normalizarObjetivo({ tipo: 'meta', monedas: 5 }) }, { tipo: 'meta', monedas: 5 });
  assert.deepEqual({ ...normalizarObjetivo({ tipo: 'monedas', monedas: 5 }) }, { tipo: 'monedas', monedas: 0 });
});

test('un objetivo desconocido cae al de por defecto en vez de romper la partida', () => {
  assert.deepEqual({ ...normalizarObjetivo('volar') }, { tipo: 'monedas', monedas: 0 });
  assert.deepEqual({ ...normalizarObjetivo({ tipo: 'llegar' }) }, { tipo: 'monedas', monedas: 0 });
  assert.deepEqual({ ...normalizarObjetivo({}) }, { tipo: 'monedas', monedas: 0 });
});

test('las monedas exigidas se redondean a un entero mayor o igual que 0', () => {
  const monedas = (valor) => normalizarObjetivo({ tipo: 'meta', monedas: valor }).monedas;

  assert.equal(monedas(-3), 0);
  assert.equal(monedas(2.7), 2);
  assert.equal(monedas('muchas'), 0);
  assert.equal(monedas(Number.NaN), 0);
  assert.equal(monedas(Number.POSITIVE_INFINITY), 0);
});

test('objetivo "monedas": un nivel sin monedas no se supera solo al entrar', () => {
  const estado = estadoObjetivo({ tipo: 'monedas' }, { monedas: 0, totalMonedas: 0 });

  assert.equal(estado.cumplido, false);
  assert.equal(estado.totalMonedas, 0);
  assert.equal(estado.faltanMonedas, 0);
});

test('objetivo "monedas": se cumple al recoger todas, y solo entonces', () => {
  const aMedias = estadoObjetivo({ tipo: 'monedas' }, { monedas: 3, totalMonedas: 6 });
  assert.equal(aMedias.cumplido, false);
  assert.equal(aMedias.faltanMonedas, 3);
  assert.equal(aMedias.requeridas, 6);

  const todas = estadoObjetivo({ tipo: 'monedas' }, { monedas: 6, totalMonedas: 6 });
  assert.equal(todas.cumplido, true);
  assert.equal(todas.faltanMonedas, 0);
});

test('objetivo "meta": llegar sin las monedas exigidas no supera el nivel', () => {
  const estado = estadoObjetivo({ tipo: 'meta', monedas: 5 }, { monedas: 2, metaAlcanzada: true });

  assert.equal(estado.metaAlcanzada, true);
  assert.equal(estado.faltaMeta, false, 'la meta sí se ha tocado');
  assert.equal(estado.cumplido, false, 'pero faltan monedas');
  assert.equal(estado.faltanMonedas, 3);
});

test('objetivo "meta": se cumple al tocarla con las monedas exigidas', () => {
  const conMonedas = estadoObjetivo(
    { tipo: 'meta', monedas: 5 },
    { monedas: 5, metaAlcanzada: true }
  );
  assert.equal(conMonedas.cumplido, true);
  assert.equal(conMonedas.faltanMonedas, 0);

  const sinExigencia = estadoObjetivo({ tipo: 'meta' }, { monedas: 0, metaAlcanzada: true });
  assert.equal(sinExigencia.cumplido, true, 'sin monedas exigidas basta con llegar');

  const antes = estadoObjetivo({ tipo: 'meta' }, { monedas: 9, metaAlcanzada: false });
  assert.equal(antes.cumplido, false, 'las monedas no sustituyen a la meta');
  assert.equal(antes.faltaMeta, true);
});

test('textoObjetivo() describe el objetivo para el HUD', () => {
  const monedas = textoObjetivo(estadoObjetivo({ tipo: 'monedas' }, { monedas: 3, totalMonedas: 8 }));
  assert.match(monedas, /8/, 'dice cuántas monedas hay en total');
  assert.match(monedas, /3/, 'y cuántas llevas');

  const hechas = textoObjetivo(estadoObjetivo({ tipo: 'monedas' }, { monedas: 8, totalMonedas: 8 }));
  assert.notEqual(hechas, monedas, 'el texto cambia al cumplirse');

  const meta = textoObjetivo(estadoObjetivo({ tipo: 'meta', monedas: 2 }, { monedas: 0 }));
  assert.match(meta, /meta/);
  assert.match(meta, /0\/2/);

  assert.equal(textoObjetivo(null), '', 'sin estado no hay texto');
});

test('esObjetivoValido() solo acepta los tipos que entiende el motor', () => {
  assert.deepEqual([...OBJETIVOS_VALIDOS], ['monedas', 'meta']);

  assert.equal(esObjetivoValido('monedas'), true);
  assert.equal(esObjetivoValido('meta'), true);
  assert.equal(esObjetivoValido({ tipo: 'meta', monedas: 3 }), true);

  assert.equal(esObjetivoValido('volar'), false);
  assert.equal(esObjetivoValido({}), false);
  assert.equal(esObjetivoValido(null), false);
  assert.equal(esObjetivoValido(undefined), false);
});
