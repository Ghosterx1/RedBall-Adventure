import test from 'node:test';
import assert from 'node:assert/strict';

import { baseVacia, jugadorNuevo } from '../src/almacen/esquema.js';
import { registrarPartida } from '../src/dominio.js';
import { fusionarProgreso, recordDeNivel, resumenProgreso } from '../src/servicios/progreso.js';
import { buscarJugador, ranking } from '../src/servicios/records.js';

/**
 * El ranking y la fusión de progresos son funciones PURAS sobre la base ya
 * normalizada: se prueban sin servidor, sin disco y sin esperas.
 */

/** Jugador de mentira que ha jugado estas partidas, en orden. */
function jugador(id, partidas = []) {
  const nuevo = jugadorNuevo(id, '', '2026-05-11T10:00:00.000Z');
  for (const partida of partidas) nuevo.progreso = registrarPartida(nuevo.progreso, partida);
  return nuevo;
}

/** Base normalizada con esos jugadores. */
function baseCon(...jugadores) {
  const base = baseVacia();
  for (const quien of jugadores) base.jugadores[quien.id] = quien;
  return base;
}

/* ── fusión de dos progresos ─────────────────────────────────────────────── */

test('fusionarProgreso se queda con lo mejor de cada nivel', () => {
  const portatil = jugador('jug-uno', [
    { nivel: 'nivel-1', puntos: 100, monedas: 3, totalMonedas: 3, completado: true }
  ]).progreso;
  const movil = jugador('jug-uno', [
    { nivel: 'nivel-1', puntos: 40, monedas: 1, totalMonedas: 3 },
    { nivel: 'nivel-2', puntos: 210, monedas: 5, totalMonedas: 5 }
  ]).progreso;

  const fusionado = fusionarProgreso(portatil, movil);

  assert.deepEqual(fusionado.niveles['nivel-1'], {
    puntos: 100,
    monedas: 3,
    totalMonedas: 3,
    completado: true,
    partidas: 1
  });
  assert.deepEqual(fusionado.niveles['nivel-2'], {
    puntos: 210,
    monedas: 5,
    totalMonedas: 5,
    completado: false,
    partidas: 1
  });
});

test('sincronizar no multiplica las partidas jugadas', () => {
  const uno = jugador('jug-uno', [{ nivel: 'nivel-1', puntos: 100 }]).progreso;
  const dos = jugador('jug-uno', [{ nivel: 'nivel-1', puntos: 100 }]).progreso;

  const fusionado = fusionarProgreso(uno, dos);

  assert.equal(fusionado.niveles['nivel-1'].partidas, 1, 'el máximo, no la suma');
});

test('fusionarProgreso no toca lo que recibe y aguanta basura', () => {
  const original = jugador('jug-uno', [{ nivel: 'nivel-1', puntos: 100 }]).progreso;
  const copia = structuredClone(original);

  assert.deepEqual(fusionarProgreso(null, null), { version: 1, niveles: {} });
  assert.deepEqual(fusionarProgreso('basura', 42), { version: 1, niveles: {} });
  assert.deepEqual(fusionarProgreso(original, null), original);
  assert.deepEqual(original, copia, 'la fusión no muta la entrada');
});

/* ── resumen y récord de nivel ───────────────────────────────────────────── */

test('resumenProgreso suma los puntos del catálogo entero', () => {
  const quien = jugador('jug-uno', [
    { nivel: 'nivel-1', puntos: 100, completado: true },
    { nivel: 'nivel-2', puntos: 210, completado: true },
    { nivel: 'nivel-2', puntos: 50 }
  ]);

  const resumen = resumenProgreso(quien.progreso);

  assert.deepEqual(resumen, { puntos: 310, completados: 2, total: 5, partidas: 3 });
});

test('un progreso vacío se resume en ceros', () => {
  assert.deepEqual(resumenProgreso(null), { puntos: 0, completados: 0, total: 5, partidas: 0 });
});

test('recordDeNivel devuelve los campos que pinta el cliente', () => {
  const quien = jugador('jug-uno', [
    { nivel: 'nivel-2', puntos: 210, monedas: 4, totalMonedas: 5, completado: true }
  ]);

  assert.deepEqual(recordDeNivel(quien.progreso, 'nivel-2'), {
    nivel: 'nivel-2',
    puntos: 210,
    monedas: 4,
    totalMonedas: 5,
    completado: true,
    partidas: 1
  });

  // Un nivel sin jugar no es un error: es un récord a cero.
  assert.deepEqual(recordDeNivel(quien.progreso, 'nivel-5'), {
    nivel: 'nivel-5',
    puntos: 0,
    monedas: 0,
    totalMonedas: 0,
    completado: false,
    partidas: 0
  });
});

/* ── Ranking global ──────────────────────────────────────────────────────── */

test('el ranking global ordena por puntos y numera las filas', () => {
  const base = baseCon(
    jugador('jug-ana', [{ nivel: 'nivel-1', puntos: 100, completado: true }]),
    jugador('jug-beto', [{ nivel: 'nivel-1', puntos: 60, completado: true }]),
    jugador('jug-caro', [{ nivel: 'nivel-3', puntos: 30 }])
  );

  const filas = ranking(base);

  assert.deepEqual(
    filas.map((fila) => [fila.posicion, fila.jugador, fila.puntos]),
    [
      [1, 'jug-ana', 100],
      [2, 'jug-beto', 60],
      [3, 'jug-caro', 30]
    ]
  );
  assert.equal(filas[0].completados, 1);
  assert.equal(filas[0].total, 5);
  assert.equal(filas[0].partidas, 1);
});

test('quien no ha jugado nada no sale en el ranking', () => {
  const base = baseCon(jugador('jug-ana', [{ nivel: 'nivel-1', puntos: 100 }]), jugador('jug-zoe'));
  assert.deepEqual(
    ranking(base).map((fila) => fila.jugador),
    ['jug-ana']
  );
});

test('a igualdad de puntos gana quien más niveles ha completado', () => {
  const base = baseCon(
    jugador('jug-ana', [{ nivel: 'nivel-1', puntos: 100, completado: true }]),
    jugador('jug-beto', [
      { nivel: 'nivel-1', puntos: 60, completado: true },
      { nivel: 'nivel-2', puntos: 40, completado: true }
    ])
  );

  const filas = ranking(base);

  assert.deepEqual(
    filas.map((fila) => fila.jugador),
    ['jug-beto', 'jug-ana']
  );
  assert.equal(filas[0].puntos, 100);
});

test('el orden es estable entre peticiones iguales (desempate por id)', () => {
  const base = baseCon(
    jugador('jug-zzz', [{ nivel: 'nivel-1', puntos: 50 }]),
    jugador('jug-aaa', [{ nivel: 'nivel-1', puntos: 50 }])
  );

  const uno = ranking(base).map((fila) => fila.jugador);
  const dos = ranking(base).map((fila) => fila.jugador);

  assert.deepEqual(uno, ['jug-aaa', 'jug-zzz']);
  assert.deepEqual(uno, dos);
});

test('el límite recorta la tabla sin cambiar las posiciones', () => {
  const base = baseCon(
    jugador('jug-ana', [{ nivel: 'nivel-1', puntos: 300 }]),
    jugador('jug-beto', [{ nivel: 'nivel-1', puntos: 200 }]),
    jugador('jug-caro', [{ nivel: 'nivel-1', puntos: 100 }])
  );

  const filas = ranking(base, { limite: 2 });

  assert.deepEqual(
    filas.map((fila) => `${fila.posicion}:${fila.jugador}`),
    ['1:jug-ana', '2:jug-beto']
  );
  assert.deepEqual(ranking(base, { limite: 0 }), []);
});

/* ── Ranking por nivel ───────────────────────────────────────────────────── */

test('el ranking de un nivel solo tiene a quien lo ha jugado', () => {
  const base = baseCon(
    jugador('jug-ab12', [{ nivel: 'nivel-1', puntos: 70, monedas: 7, totalMonedas: 9 }]),
    jugador('jug-beto', [{ nivel: 'nivel-2', puntos: 500, completado: true }])
  );

  const filas = ranking(base, { nivel: 'nivel-1' });

  assert.equal(filas.length, 1);
  assert.deepEqual(filas[0], {
    posicion: 1,
    jugador: 'jug-ab12',
    nombre: 'JUG-AB12',
    nivel: 'nivel-1',
    puntos: 70,
    monedas: 7,
    totalMonedas: 9,
    completado: false,
    actualizado: '2026-05-11T10:00:00.000Z'
  });
});

test('el ranking aguanta una base rota sin lanzar', () => {
  for (const basura of [null, undefined, 'texto', {}, { jugadores: null }]) {
    assert.deepEqual(ranking(basura), []);
  }
});

/* ── Búsqueda de perfil ──────────────────────────────────────────────────── */

test('buscarJugador devuelve el jugador guardado o null', () => {
  const base = baseCon(jugador('jug-ana', [{ nivel: 'nivel-1', puntos: 10 }]));

  assert.equal(buscarJugador(base, 'jug-ana').id, 'jug-ana');
  assert.equal(buscarJugador(base, 'jug-nadie'), null);
  assert.equal(buscarJugador(null, 'jug-ana'), null);
});
