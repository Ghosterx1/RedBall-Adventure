import test from 'node:test';
import assert from 'node:assert/strict';

import { contextoFalso } from './ayudas/contexto-falso.js';
import { MUNDO } from '../src/config/ajustes.js';
import { material } from '../src/config/materiales.js';
import { Meta, crearObjeto, hayTipo, tiposRegistrados } from '../src/mundo/tipos.js';

/**
 * Contrato de la meta: es el portal de LLEGADA. No bloquea, no mata y no puntúa;
 * el mundo solo avisa de que la has tocado y la escena decide si eso supera el
 * nivel (porque "llegar a la meta" es solo uno de los objetivos posibles).
 */

test('la meta está registrada y solo declara la capacidad "meta"', () => {
  assert.ok(hayTipo('meta'));
  assert.ok(tiposRegistrados().includes('meta'));

  const meta = crearObjeto({ tipo: 'meta', x: 100, y: 100 });

  assert.ok(meta instanceof Meta);
  assert.equal(meta.tipo, 'meta');
  assert.equal(meta.ancho, MUNDO.META_ANCHO);
  assert.equal(meta.alto, MUNDO.META_ALTO);
  assert.equal(meta.alcanzada, false);

  assert.equal(meta.meta, meta, 'se identifica como meta');
  assert.equal(meta.solido, null, 'se atraviesa: no bloquea el paso');
  assert.equal(meta.superficie, null);
  assert.equal(meta.peligro, null, 'tocarla no reinicia');
  assert.equal(meta.checkpoint, null);
  assert.equal(meta.coleccionable, null, 'no es una moneda');
  assert.equal(material(meta.material).solido, true, 'su material es de piedra (solo dibujo)');
});

test('alcanzar() es idempotente: solo avisa la primera vez', () => {
  const meta = new Meta({ x: 0, y: 0 });

  assert.equal(meta.alcanzar(), true);
  assert.equal(meta.alcanzada, true);
  assert.equal(meta.alcanzar(), false, 'volver a tocarla no vuelve a avisar');
});

test('reiniciar() la deja otra vez sin alcanzar', () => {
  const meta = new Meta({ x: 5, y: 5 });
  meta.alcanzar();
  meta.delta = { dx: 4, dy: 0 };

  meta.reiniciar();

  assert.equal(meta.alcanzada, false);
  assert.deepEqual(meta.delta, { dx: 0, dy: 0 });
});

test('`apoyo` es la esquina inferior izquierda (se usa para validar el nivel)', () => {
  const meta = new Meta({ x: 40, y: 60 });

  assert.deepEqual(meta.apoyo, { x: 40, y: 60 + MUNDO.META_ALTO });
});

test('se dibuja como portal y, ya alcanzada, se apaga', () => {
  const rects = (ctx) => ctx.llamadas.filter(([nombre]) => nombre === 'fillRect').length;

  const meta = new Meta({ x: 10, y: 10 });
  const abierta = contextoFalso();
  assert.doesNotThrow(() => meta.dibujar(abierta));
  assert.ok(rects(abierta) > 0, 'pinta postes, dintel y banderín');

  meta.alcanzar();
  const superada = contextoFalso();
  assert.doesNotThrow(() => meta.dibujar(superada));
  assert.ok(rects(superada) > 0, 'sigue pintándose (apagada, con una marca)');
  assert.ok(
    rects(superada) < rects(abierta),
    'alcanzada es más sobria: pierde el banderín a cuadros'
  );
});
