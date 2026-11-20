import test from 'node:test';
import assert from 'node:assert/strict';

import { contarMonedas, filasDeRanking, puntosPotenciales, resumenJuego, resumenPartida, tarjetasDeNiveles, textoEstadoRecords } from '../src/interfaz/modelo.js';
import { progresoVacio, registrarPartida } from '../src/nucleo/Progreso.js';
import { NIVELES } from '../src/mundo/niveles/index.js';
import { JUEGO } from '../src/config/ajustes.js';

/**
 * Modelo de la interfaz: lo que se pinta, calculado sin DOM. Aquí se fija qué
 * nivel sale bloqueado, qué dice una tarjeta y cómo se resume la partida.
 */

const niveles = [
  { id: 'uno', orden: 1, nombre: 'Prado', dificultad: 1, objetos: [{ tipo: 'moneda' }, { tipo: 'moneda' }, { tipo: 'plataforma' }] },
  { id: 'dos', orden: 2, nombre: 'Torre', dificultad: 3, objetos: [{ tipo: 'moneda' }] },
  { id: 'tres', orden: 3, nombre: 'Cueva', dificultad: 5, objetos: [] }
];

const completado = (progreso, id, extras = {}) =>
  registrarPartida(progreso, { nivel: id, completado: true, ...extras });

test('una tarjeta por nivel, en orden, con número y dificultad', () => {
  const tarjetas = tarjetasDeNiveles(progresoVacio(), niveles);

  assert.equal(tarjetas.length, 3);
  assert.deepEqual(tarjetas.map((t) => t.numero), [1, 2, 3]);
  assert.deepEqual(tarjetas.map((t) => t.id), ['uno', 'dos', 'tres']);
  assert.deepEqual(tarjetas.map((t) => t.nombre), ['Prado', 'Torre', 'Cueva']);
  assert.deepEqual(tarjetas.map((t) => t.dificultad), [1, 3, 5]);
  assert.equal(tarjetas[0].dificultadMaxima, 5);
});

test('sin récord solo el primer nivel está abierto', () => {
  const tarjetas = tarjetasDeNiveles(progresoVacio(), niveles);

  assert.equal(tarjetas[0].bloqueado, false);
  assert.equal(tarjetas[0].completado, false);
  assert.equal(tarjetas[1].bloqueado, true, 'el segundo se abre al superar el primero');
  assert.equal(tarjetas[2].bloqueado, true);
});

test('cada nivel completado abre el siguiente', () => {
  const progreso = completado(progresoVacio(), 'uno');
  const tarjetas = tarjetasDeNiveles(progreso, niveles);

  assert.equal(tarjetas[0].completado, true);
  assert.equal(tarjetas[1].bloqueado, false);
  assert.equal(tarjetas[2].bloqueado, true);

  const todos = completado(completado(progreso, 'dos'), 'tres');
  assert.deepEqual(
    tarjetasDeNiveles(todos, niveles).map((t) => t.bloqueado),
    [false, false, false]
  );
});

test('la tarjeta lleva el récord y el total de monedas del nivel', () => {
  const progreso = completado(progresoVacio(), 'uno', { monedas: 2, puntos: 20 });
  const [primera, segunda] = tarjetasDeNiveles(progreso, niveles);

  assert.equal(primera.monedas, 2);
  assert.equal(primera.puntos, 20);
  assert.equal(primera.totalMonedas, 2, 'las monedas del nivel salen de su data');
  assert.equal(primera.partidas, 1);

  assert.equal(segunda.monedas, 0, 'un nivel sin jugar no tiene récord');
  assert.equal(segunda.totalMonedas, 1);
});

test('resumenJuego cuenta completados, avance y porcentaje', () => {
  const vacio = resumenJuego(progresoVacio(), niveles);
  assert.deepEqual(vacio, {
    completados: 0,
    total: 3,
    avance: 0,
    porcentaje: 0,
    todosCompletados: false
  });

  const dos = resumenJuego(completado(completado(progresoVacio(), 'uno'), 'dos'), niveles);
  assert.equal(dos.completados, 2);
  assert.equal(dos.total, 3);
  assert.ok(Math.abs(dos.avance - 2 / 3) < 1e-9);
  assert.equal(dos.porcentaje, 67);
  assert.equal(dos.todosCompletados, false);

  assert.equal(resumenJuego(progresoVacio(), []).porcentaje, 0, 'sin catálogo no se divide por cero');
});

test('el catálogo real del juego también se puede pintar', () => {
  const tarjetas = tarjetasDeNiveles(progresoVacio(), NIVELES);

  assert.equal(tarjetas.length, NIVELES.length);
  assert.ok(tarjetas.length >= 5);
  assert.equal(tarjetas[0].bloqueado, false);
  for (const tarjeta of tarjetas) {
    assert.ok(tarjeta.totalMonedas > 0, `"${tarjeta.id}" debería tener monedas`);
    assert.ok(tarjeta.dificultad >= 1 && tarjeta.dificultad <= 5);
  }
});

test('resumenPartida escribe el estado de la partida y aguanta datos vacíos', () => {
  const texto = resumenPartida({
    numero: 2,
    total: 5,
    monedas: 3,
    totalMonedas: 12,
    puntos: 30,
    vidas: 2
  });
  assert.equal(texto, 'NIVEL 2/5 · MONEDAS 3/12 · PUNTOS 30 · VIDAS 2');

  assert.match(resumenPartida({ completo: true, vidas: 1 }), /NIVEL COMPLETADO/);
  assert.equal(resumenPartida(null), '');
  assert.doesNotMatch(resumenPartida({}), /NaN|undefined/, 'sin datos no se cuelan números raros');
});

test('contarMonedas y puntosPotenciales leen la data del nivel', () => {
  assert.equal(contarMonedas(niveles[0]), 2);
  assert.equal(contarMonedas(niveles[2]), 0);
  assert.equal(contarMonedas(null), 0);
  assert.equal(puntosPotenciales(niveles[0]), 2 * JUEGO.VALOR_MONEDA);
});

/* ── Récords globales (respuestas de GET /api/records) ───────────────────── */

test('filasDeRanking normaliza el ranking global del servidor', () => {
  const filas = filasDeRanking(
    [
      { posicion: 1, jugador: 'ana', nombre: 'ANA', puntos: 900, completados: 3, total: 5 },
      { posicion: 2, jugador: 'jug-abc', nombre: 'YO', puntos: 500, completados: 2, total: 5 }
    ],
    { jugador: 'jug-abc' }
  );

  assert.deepEqual(filas, [
    { posicion: 1, nombre: 'ANA', puntos: 900, detalle: 'NIVELES 3/5', propio: false },
    { posicion: 2, nombre: 'YO', puntos: 500, detalle: 'NIVELES 2/5', propio: true }
  ]);
});

test('filasDeRanking usa las monedas cuando el ranking es de un nivel', () => {
  const [fila] = filasDeRanking([
    { posicion: 1, jugador: 'ana', nombre: 'ANA', nivel: 'nivel-1', puntos: 70, monedas: 7, totalMonedas: 9, completado: false }
  ]);

  assert.equal(fila.detalle, 'MONEDAS 7/9');
  assert.equal(fila.propio, false, 'sin id local no se resalta ninguna fila');
});

test('filasDeRanking aguanta filas raras sin romper la tabla', () => {
  assert.deepEqual(filasDeRanking(), []);
  assert.deepEqual(filasDeRanking(null), []);

  const [fila] = filasDeRanking([{ jugador: 'jug-x' }]);
  assert.deepEqual(fila, { posicion: 1, nombre: 'jug-x', puntos: 0, detalle: '', propio: false });
});

test('textoEstadoRecords cuenta qué pasa con la tabla', () => {
  assert.equal(textoEstadoRecords({ cargando: true }), 'CARGANDO RÉCORDS...');
  assert.equal(textoEstadoRecords({ error: 'No hay servidor' }), 'SIN RÉCORDS: NO HAY SERVIDOR');
  assert.equal(textoEstadoRecords({ total: 0 }), 'TODAVÍA NO HAY RÉCORDS: SÉ EL PRIMERO');
  assert.equal(textoEstadoRecords({ total: 0, nivel: 'nivel-2' }), 'NADIE HA JUGADO ESTE NIVEL TODAVÍA');
  assert.equal(textoEstadoRecords({ total: 4 }), 'MEJORES JUGADORES');
  assert.equal(textoEstadoRecords({ total: 4, nivel: 'nivel-2' }), 'MEJORES EN NIVEL-2');
  assert.equal(textoEstadoRecords(), 'TODAVÍA NO HAY RÉCORDS: SÉ EL PRIMERO');
});
