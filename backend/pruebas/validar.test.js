import test from 'node:test';
import assert from 'node:assert/strict';

import {
  leerBooleano,
  leerEntero,
  leerJugador,
  leerNivel,
  leerObjeto,
  leerPartida,
  leerTexto,
  MAXIMO_MONEDAS,
  MAXIMO_NOMBRE
} from '../src/validar.js';

/**
 * validar.js es la frontera de entrada: todo lo que llega por HTTP es texto y
 * puede ser cualquier cosa. Estas pruebas fijan qué se acepta y con qué código
 * de error se rechaza (los códigos son el contrato que lee el cliente).
 */

/** Comprueba que `fn` lanza un error con ese estado y ese código. */
function fallaCon(fn, { estado, codigo }) {
  assert.throws(fn, (error) => {
    assert.equal(error.estado, estado, `estado esperado ${estado} en ${codigo}`);
    assert.equal(error.codigo, codigo);
    assert.equal(typeof error.message, 'string');
    assert.ok(error.message.length > 0, 'todo error lleva mensaje legible');
    return true;
  });
}

/* ── Id de jugador ───────────────────────────────────────────────────────── */

test('leerJugador acepta ids del patrón y recorta los espacios', () => {
  assert.equal(leerJugador('jug-abc123'), 'jug-abc123');
  assert.equal(leerJugador('  jug-abc123  '), 'jug-abc123');
  assert.equal(leerJugador('abc'), 'abc', 'el mínimo son 3 caracteres');
  assert.equal(leerJugador('a_b-C9'), 'a_b-C9');
});

test('leerJugador rechaza cualquier cosa que no sea un id', () => {
  for (const valor of ['', 'ab', 'a'.repeat(33), 'jug con espacio', 'jug/../x', 'ñandú']) {
    fallaCon(() => leerJugador(valor), { estado: 400, codigo: 'JUGADOR_INVALIDO' });
  }

  for (const valor of [null, undefined, 42, {}, ['jug-abc']]) {
    fallaCon(() => leerJugador(valor), { estado: 400, codigo: 'JUGADOR_INVALIDO' });
  }
});

/* ── Nivel ──────────────────────────────────────────────────────────────── */

test('leerNivel solo admite niveles del catálogo real', () => {
  assert.equal(leerNivel('nivel-1'), 'nivel-1');
  assert.equal(leerNivel(' nivel-5 '), 'nivel-5');
});

test('un nivel inventado cuenta qué niveles existen', () => {
  assert.throws(
    () => leerNivel('nivel-99'),
    (error) => {
      assert.equal(error.estado, 400);
      assert.equal(error.codigo, 'NIVEL_DESCONOCIDO');
      assert.ok(Array.isArray(error.detalles.niveles));
      assert.ok(error.detalles.niveles.includes('nivel-1'));
      return true;
    }
  );
});

/* ── Números ────────────────────────────────────────────────────────────── */

test('leerEntero acepta números y textos numéricos', () => {
  assert.equal(leerEntero(0, { campo: 'puntos' }), 0);
  assert.equal(leerEntero(120, { campo: 'puntos' }), 120);
  assert.equal(leerEntero(' 120 ', { campo: 'puntos' }), 120);
});

test('leerEntero rechaza negativos, decimales y basura', () => {
  for (const valor of [-1, 12.5, '12.5', 'doce', true, {}, []]) {
    fallaCon(() => leerEntero(valor, { campo: 'puntos' }), { estado: 400, codigo: 'CAMPO_INVALIDO' });
  }
});

test('leerEntero respeta el máximo y el valor por defecto', () => {
  assert.equal(leerEntero(9999, { campo: 'monedas', maximo: MAXIMO_MONEDAS }), 9999);
  fallaCon(() => leerEntero(10_000, { campo: 'monedas', maximo: MAXIMO_MONEDAS }), {
    estado: 400,
    codigo: 'CAMPO_INVALIDO'
  });

  assert.equal(leerEntero(undefined, { campo: 'monedas', porDefecto: 0 }), 0);
  assert.equal(leerEntero('', { campo: 'monedas', porDefecto: 7 }), 7);
  fallaCon(() => leerEntero(undefined, { campo: 'puntos' }), {
    estado: 400,
    codigo: 'CAMPO_OBLIGATORIO'
  });
});

/* ── Booleanos, textos y objetos ────────────────────────────────────────── */

test('leerBooleano no acepta el texto "true"', () => {
  assert.equal(leerBooleano(true, { campo: 'completado' }), true);
  assert.equal(leerBooleano(false, { campo: 'completado' }), false);
  assert.equal(leerBooleano(undefined, { campo: 'completado' }), false);
  fallaCon(() => leerBooleano('true', { campo: 'completado' }), {
    estado: 400,
    codigo: 'CAMPO_INVALIDO'
  });
});

test('leerTexto recorta, limita y rechaza lo que no es texto', () => {
  assert.equal(leerTexto('  ANA  ', { campo: 'nombre' }), 'ANA');
  assert.equal(leerTexto(undefined, { campo: 'nombre' }), '');
  assert.equal(leerTexto('x'.repeat(MAXIMO_NOMBRE), { campo: 'nombre' }), 'x'.repeat(MAXIMO_NOMBRE));

  fallaCon(() => leerTexto('x'.repeat(MAXIMO_NOMBRE + 1), { campo: 'nombre' }), {
    estado: 400,
    codigo: 'CAMPO_INVALIDO'
  });
  fallaCon(() => leerTexto(12, { campo: 'nombre' }), { estado: 400, codigo: 'CAMPO_INVALIDO' });
});

test('leerObjeto exige un objeto JSON de verdad', () => {
  assert.deepEqual(leerObjeto({ niveles: {} }, 'progreso'), { niveles: {} });

  for (const valor of [null, undefined, [], 'texto', 7]) {
    fallaCon(() => leerObjeto(valor, 'progreso'), { estado: 400, codigo: 'CAMPO_INVALIDO' });
  }
});

/* ── Cuerpo de una partida ──────────────────────────────────────────────── */

test('leerPartida devuelve la partida ya limpia', () => {
  const partida = leerPartida({
    nivel: 'nivel-2',
    puntos: '210',
    monedas: 3,
    totalMonedas: 5,
    completado: true
  });

  assert.deepEqual(partida, {
    nivel: 'nivel-2',
    puntos: 210,
    monedas: 3,
    totalMonedas: 5,
    completado: true
  });
});

test('leerPartida pone a cero las monedas que no se envían', () => {
  const partida = leerPartida({ nivel: 'nivel-1', puntos: 40 });

  assert.equal(partida.monedas, 0);
  assert.equal(partida.totalMonedas, 0);
  assert.equal(partida.completado, false);
});

test('leerPartida corta los envíos imposibles', () => {
  // Más monedas cogidas que monedas tiene el nivel.
  fallaCon(() => leerPartida({ nivel: 'nivel-1', puntos: 10, monedas: 9, totalMonedas: 3 }), {
    estado: 400,
    codigo: 'DATOS_INCOHERENTES'
  });

  // Sin nivel, sin puntos o con un cuerpo que no es un objeto.
  fallaCon(() => leerPartida({ puntos: 10 }), { estado: 400, codigo: 'NIVEL_DESCONOCIDO' });
  fallaCon(() => leerPartida({ nivel: 'nivel-1' }), { estado: 400, codigo: 'CAMPO_OBLIGATORIO' });
  fallaCon(() => leerPartida([]), { estado: 400, codigo: 'CUERPO_INVALIDO' });
  fallaCon(() => leerPartida(null), { estado: 400, codigo: 'CUERPO_INVALIDO' });
});
