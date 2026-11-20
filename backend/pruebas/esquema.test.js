import test from 'node:test';
import assert from 'node:assert/strict';

import {
  baseVacia,
  jugadorNuevo,
  nombreJugador,
  normalizarBase,
  normalizarJugador,
  PATRON_ID
} from '../src/almacen/esquema.js';

/**
 * esquema.js decide qué entra en la "base de datos" y con qué forma. Es lo que
 * impide que un JSON viejo, corrupto o escrito a mano rompa el ranking.
 */

/* ── Base ────────────────────────────────────────────────────────────────── */

test('la base vacía tiene la forma documentada', () => {
  assert.deepEqual(baseVacia(), { version: 1, actualizado: null, jugadores: {} });
});

test('normalizarBase nunca lanza y siempre devuelve una base usable', () => {
  for (const basura of [null, undefined, 'texto', 42, [], { jugadores: 'nada' }]) {
    assert.deepEqual(normalizarBase(basura), baseVacia());
  }
});

test('normalizarBase descarta ids imposibles y normaliza los buenos', () => {
  const base = normalizarBase({
    version: 99,
    actualizado: '2026-05-11T10:00:00.000Z',
    jugadores: {
      'jug-ab12': { nombre: '  Ana  ', progreso: { niveles: { 'nivel-1': { puntos: 210 } } } },
      ab: { nombre: 'id corto' },
      'con espacio': { nombre: 'id raro' },
      'jug-roto': null
    }
  });

  assert.deepEqual(Object.keys(base.jugadores).sort(), ['jug-ab12', 'jug-roto']);
  assert.equal(base.version, 1, 'la versión del archivo se reescribe, no se copia');
  assert.equal(base.actualizado, '2026-05-11T10:00:00.000Z');
  assert.equal(base.jugadores['jug-ab12'].nombre, 'Ana');
  assert.equal(base.jugadores['jug-ab12'].progreso.niveles['nivel-1'].puntos, 210);
  assert.equal(base.jugadores['jug-roto'].nombre, 'JUG-ROTO', 'un jugador null sigue teniendo alias');
});

test('normalizarBase tira las fechas que no son fechas', () => {
  const base = normalizarBase({
    actualizado: 'ayer',
    jugadores: { 'jug-abc': { creado: '2026-01-01', actualizado: 'nunca' } }
  });

  assert.equal(base.actualizado, null);
  assert.equal(base.jugadores['jug-abc'].creado, '2026-01-01T00:00:00.000Z');
  assert.equal(base.jugadores['jug-abc'].actualizado, null);
});

/* ── Jugadores ───────────────────────────────────────────────────────────── */

test('un jugador nuevo llega con progreso válido y fechas', () => {
  const jugador = jugadorNuevo('jug-ab12', '', '2026-05-11T10:00:00.000Z');

  assert.equal(jugador.id, 'jug-ab12');
  assert.equal(jugador.nombre, 'JUG-AB12');
  assert.deepEqual(jugador.progreso, { version: 1, niveles: {} });
  assert.equal(jugador.creado, '2026-05-11T10:00:00.000Z');
  assert.equal(jugador.actualizado, '2026-05-11T10:00:00.000Z');
});

test('normalizarJugador arregla un progreso destrozado', () => {
  const jugador = normalizarJugador('jug-ab12', { progreso: 'muchas monedas' });

  assert.deepEqual(jugador.progreso, { version: 1, niveles: {} });
  assert.equal(jugador.nombre, 'JUG-AB12');
});

/* ── Nombre visible ──────────────────────────────────────────────────────── */

test('nombreJugador limpia lo que no se puede pintar', () => {
  assert.equal(nombreJugador('  Ana  '), 'Ana');
  assert.equal(nombreJugador('José Ñandú'), 'José Ñandú', 'los acentos se respetan');
  assert.equal(nombreJugador('ana_98'), 'ana_98');
  assert.equal(nombreJugador('A.B-C'), 'A.B-C');
  assert.equal(nombreJugador('Ana<script>'), 'Anascript', 'fuera símbolos');
  assert.equal(nombreJugador('x'.repeat(40)), 'x'.repeat(16), '16 caracteres como máximo');
});

test('sin nombre se usa un alias derivado del id', () => {
  assert.equal(nombreJugador('', 'jug-ab12'), 'JUG-AB12');
  assert.equal(nombreJugador('   ', 'jug-ab12'), 'JUG-AB12');
  assert.equal(nombreJugador(null, 'jug-ab12'), 'JUG-AB12');
  assert.equal(nombreJugador('', ''), 'JUGADOR');
  assert.equal(nombreJugador(undefined), 'JUGADOR');
});

test('el patrón de id del esquema es el mismo que valida la API', () => {
  assert.ok(PATRON_ID.test('jug-abc123'));
  assert.ok(!PATRON_ID.test('ab'));
  assert.ok(!PATRON_ID.test('jug con espacio'));
});
