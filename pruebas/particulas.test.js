import test from 'node:test';
import assert from 'node:assert/strict';

import { Particulas } from '../src/render/particulas.js';
import { PALETA } from '../src/config/paleta.js';
import { contextoFalso } from './ayudas/contexto-falso.js';

/**
 * Partículas de la recogida y del polvo. El azar se inyecta para que las
 * pruebas sean deterministas: con `() => 0.5` el abanico siempre es el mismo.
 */

const azarFijo = () => 0.5;

test('un estallido crea las partículas pedidas y las cuenta', () => {
  const particulas = new Particulas({ aleatorio: azarFijo });

  assert.equal(particulas.vivas, 0);
  assert.equal(particulas.estallido({ x: 10, y: 20, cuantas: 7 }), 7);
  assert.equal(particulas.vivas, 7);

  for (const particula of particulas.lista) {
    assert.equal(particula.x, 10);
    assert.equal(particula.y, 20);
    assert.equal(particula.tamano, 2);
    assert.ok(particula.vida > 0 && particula.vida <= particula.duracion);
    assert.equal(particula.color, PALETA.ORO_CLARO, 'con azar 0,5 toca el segundo color');
  }
});

test('estallido y polvo abren el abanico hacia lados distintos', () => {
  const estallido = new Particulas({ aleatorio: () => 0.25 });
  estallido.estallido({ cuantas: 1, velocidad: 100 });
  const volteado = new Particulas({ aleatorio: () => 0.75 });
  volteado.estallido({ cuantas: 1, velocidad: 100 });

  const polvo = new Particulas({ aleatorio: () => 0.25 });
  polvo.polvo({ cuantas: 1, velocidad: 100 });

  assert.ok(estallido.lista[0].vy > 0, 'el estallido también lanza hacia abajo');
  assert.ok(volteado.lista[0].vy < 0);
  assert.ok(polvo.lista[0].vy < 0, 'el polvo solo sube');
});

test('actualizar() mueve con gravedad y retira las partículas muertas', () => {
  const particulas = new Particulas({ aleatorio: azarFijo });
  particulas.estallido({ x: 0, y: 0, cuantas: 3, velocidad: 100, duracion: 0.2, gravedad: 100 });

  const antes = particulas.lista.map((p) => ({ x: p.x, y: p.y, vy: p.vy }));
  particulas.actualizar(0.1);

  particulas.lista.forEach((particula, i) => {
    assert.ok(particula.vy > antes[i].vy, 'la gravedad acelera hacia abajo');
    assert.notEqual(particula.x, antes[i].x, 'se mueve horizontalmente');
  });

  particulas.actualizar(0.5);
  assert.equal(particulas.vivas, 0, 'pasado el tiempo de vida no queda ninguna');
});

test('actualizar() con dt inválido no rompe nada', () => {
  const particulas = new Particulas({ aleatorio: azarFijo });
  particulas.estallido({ cuantas: 2 });

  assert.doesNotThrow(() => particulas.actualizar(0));
  assert.doesNotThrow(() => particulas.actualizar(-1));
  assert.doesNotThrow(() => particulas.actualizar(NaN));
  assert.equal(particulas.vivas, 2);
});

test('se respeta el máximo: las más viejas dejan sitio', () => {
  const particulas = new Particulas({ maximo: 5, aleatorio: azarFijo });

  particulas.estallido({ cuantas: 8 });
  assert.equal(particulas.vivas, 5);
  particulas.estallido({ cuantas: 3, x: 99 });
  assert.equal(particulas.vivas, 5, 'nunca se pasa del tope');
  assert.ok(
    particulas.lista.some((particula) => particula.x === 99),
    'las nuevas sí entran'
  );
});

test('dibujar() pinta cuadrados que se encogen al morir', () => {
  const particulas = new Particulas({ aleatorio: azarFijo });
  particulas.estallido({ x: 4.4, y: 6.6, cuantas: 2, tamano: 4, duracion: 1 });

  const ctx = contextoFalso();
  particulas.dibujar(ctx);
  const rectangulos = ctx.llamadas.filter(([nombre]) => nombre === 'fillRect');
  assert.equal(rectangulos.length, 2);
  assert.equal(rectangulos[0][1], 4, 'la posición se redondea a la rejilla del lienzo');
  assert.equal(rectangulos[0][2], 7);
  assert.equal(rectangulos[0][3], 4, 'viva del todo: tamaño completo');

  particulas.actualizar(0.75);
  const ctx2 = contextoFalso();
  particulas.dibujar(ctx2);
  const pequenas = ctx2.llamadas.filter(([nombre]) => nombre === 'fillRect');
  assert.equal(pequenas[0][3], 1, 'al final de su vida mide un píxel');
  assert.ok(pequenas[0][3] < rectangulos[0][3]);
});

test('limpiar() vacía el sistema (al cambiar de nivel)', () => {
  const particulas = new Particulas({ aleatorio: azarFijo });
  particulas.estallido({ cuantas: 4 });

  assert.equal(particulas.limpiar().vivas, 0);
});
