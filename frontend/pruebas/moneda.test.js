import test from 'node:test';
import assert from 'node:assert/strict';

import { contextoFalso } from './ayudas/contexto-falso.js';
import { JUEGO, MUNDO } from '../src/config/ajustes.js';
import { material } from '../src/config/materiales.js';
import { Moneda, crearObjeto, hayTipo, tiposRegistrados } from '../src/mundo/tipos.js';

/**
 * Contrato de la moneda: es un coleccionable que se atraviesa (no es sólida ni
 * peligrosa), gira en función del tiempo, desaparece al recogerse y deja un
 * destello. Nada de esto puede depender del número de fotogramas.
 */

const LADO = MUNDO.MONEDA_LADO;

test('la moneda está registrada y solo declara la capacidad "coleccionable"', () => {
  assert.ok(hayTipo('moneda'));
  assert.ok(tiposRegistrados().includes('moneda'));

  const moneda = crearObjeto({ tipo: 'moneda', x: 10, y: 20 });

  assert.ok(moneda instanceof Moneda);
  assert.equal(moneda.tipo, 'moneda');
  assert.equal(moneda.ancho, LADO);
  assert.equal(moneda.alto, LADO);
  assert.equal(moneda.valor, JUEGO.VALOR_MONEDA);
  assert.equal(moneda.coleccionable, moneda, 'mientras no se coge, se puede recoger');

  assert.equal(moneda.solido, null, 'la moneda no debe bloquear el paso');
  assert.equal(moneda.superficie, null);
  assert.equal(moneda.peligro, null);
  assert.equal(moneda.checkpoint, null);
  assert.equal(material(moneda.material).solido, false, 'su material es atravesable');
});

test('recoger() es idempotente: solo cuenta la primera vez', () => {
  const moneda = new Moneda({ x: 0, y: 0 });

  assert.equal(moneda.recogida, false);
  assert.equal(moneda.visible, true);

  assert.equal(moneda.recoger(), true);
  assert.equal(moneda.recoger(), false, 'la segunda vez ya no da nada');

  assert.equal(moneda.coleccionable, null, 'cogida ya no se ofrece a la recogida');
  assert.equal(moneda.visible, false, 'y deja de dibujarse');
});

test('reiniciar() la devuelve al nivel y reinicia la animación', () => {
  const moneda = new Moneda({ x: 5, y: 5 });
  moneda.actualizar(1);
  moneda.recoger();

  moneda.reiniciar();

  assert.equal(moneda.recogida, false);
  assert.equal(moneda.efecto, 0);
  assert.equal(moneda.tiempo, 0);
  assert.equal(moneda.coleccionable, moneda);
});

test('la animación depende del tiempo, no del número de fotogramas', () => {
  const a = new Moneda({ x: 100, y: 0 });
  const b = new Moneda({ x: 100, y: 0 });

  for (let i = 0; i < 60; i++) a.actualizar(1 / 120); // 0,5 s en 60 pasos de 120 Hz
  for (let i = 0; i < 30; i++) b.actualizar(1 / 60); // 0,5 s en 30 pasos de 60 Hz

  assert.ok(Math.abs(a.tiempo - b.tiempo) < 1e-9, 'mismo tiempo acumulado');
  assert.ok(Math.abs(a.angulo - b.angulo) < 1e-9, 'mismo ángulo de giro');
  assert.ok(Math.abs(a.anchoVisible - b.anchoVisible) < 1e-9, 'mismo ancho aparente');
});

test('el giro abarca de canto a de frente sin pasar del tamaño de la moneda', () => {
  const moneda = new Moneda({ x: 0, y: 0, giro: 1, fase: 0 });

  let minimo = Infinity;
  let maximo = -Infinity;
  for (let i = 0; i < 240; i++) {
    moneda.actualizar(1 / 60);
    minimo = Math.min(minimo, moneda.anchoVisible);
    maximo = Math.max(maximo, moneda.anchoVisible);
  }

  assert.ok(minimo >= 0, `el ancho aparente no puede ser negativo: ${minimo}`);
  assert.ok(maximo <= LADO + 1e-9, `no puede ser mayor que la moneda: ${maximo}`);
  assert.ok(maximo > LADO * 0.9, 'en algún momento se ve de frente');
  assert.ok(minimo < LADO * 0.1, 'en algún momento se ve de canto');
});

test('el balanceo es solo dibujo: no mueve la caja de colisión', () => {
  const moneda = new Moneda({ x: 40, y: 40, balanceo: 6 });
  const cajaInicial = { ...moneda.caja };

  for (let i = 0; i < 120; i++) moneda.actualizar(1 / 60);

  assert.ok(Math.abs(moneda.desplazamientoY) <= 6);
  assert.deepEqual(moneda.caja, cajaInicial, 'la caja no se mueve al animarse');
});

test('se dibuja girando y deja un destello que se apaga', () => {
  const moneda = new Moneda({ x: 10, y: 10 });

  const girando = contextoFalso();
  moneda.dibujar(girando);
  assert.ok(
    girando.llamadas.some(([nombre]) => nombre === 'ellipse'),
    'la moneda se pinta como elipse que se achata al girar'
  );

  moneda.recoger();
  const destello = contextoFalso();
  moneda.dibujar(destello);
  assert.ok(
    destello.llamadas.some(([nombre]) => nombre === 'arc'),
    'al recogerla queda un anillo de destello'
  );

  for (let i = 0; i < 60; i++) moneda.actualizar(1 / 60); // el destello caduca
  const apagada = contextoFalso();
  moneda.dibujar(apagada);
  assert.deepEqual(apagada.llamadas, [], 'cuando el destello acaba no se pinta nada');
});
