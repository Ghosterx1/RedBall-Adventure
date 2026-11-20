import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NIVELES,
  crearCatalogo,
  idDeNivel,
  idsDeNiveles,
  indiceDeNivel,
  nivelPorId,
  siguienteNivel,
  totalNiveles
} from '../src/mundo/niveles/index.js';
import { normalizarObjetivo } from '../src/mundo/objetivo.js';
import { validarCatalogo, validarNivel } from '../src/mundo/validar.js';

/**
 * El catálogo (src/mundo/niveles/index.js) es la frontera entre motor y
 * contenido. Estas pruebas son la RED DE SEGURIDAD al añadir niveles: si un
 * nivel nuevo trae un id repetido, un tipo que no existe o un objetivo
 * imposible, la suite falla sin necesidad de jugarlo.
 */

const monedasDe = (nivel) => (nivel.objetos ?? []).filter((objeto) => objeto.tipo === 'moneda').length;
const metasDe = (nivel) => (nivel.objetos ?? []).filter((objeto) => objeto.tipo === 'meta').length;

test('el catálogo tiene cinco niveles con ids únicos y en orden de juego', () => {
  assert.equal(totalNiveles(), 5);

  const ids = idsDeNiveles();
  assert.deepEqual(ids, ['nivel-1', 'nivel-2', 'nivel-3', 'nivel-4', 'nivel-5']);
  assert.equal(new Set(ids).size, ids.length, 'los ids no se pueden repetir');

  const ordenes = NIVELES.map((nivel) => nivel.orden);
  for (let i = 1; i < ordenes.length; i++) {
    assert.ok(ordenes[i] > ordenes[i - 1], `el orden debe crecer: ${ordenes.join(' < ')}`);
  }
});

test('todos los niveles del catálogo pasan el validador sin errores ni avisos', () => {
  const resultado = validarCatalogo(NIVELES);

  assert.deepEqual(
    resultado.errores.map((error) => `${error.nivel}: ${error.codigo} ${error.mensaje}`),
    [],
    'hay errores de datos en el catálogo'
  );
  assert.deepEqual(
    resultado.avisos.map((aviso) => `${aviso.nivel}: ${aviso.codigo} ${aviso.mensaje}`),
    [],
    'hay avisos de diseño en el catálogo'
  );
  assert.equal(resultado.valido, true);
});

test('cada nivel declara nombre, dificultad y un objetivo alcanzable', () => {
  for (const nivel of NIVELES) {
    assert.equal(typeof nivel.nombre, 'string', `${nivel.id} necesita nombre para el HUD`);
    assert.ok(nivel.nombre.length > 0);
    assert.ok(
      Number.isInteger(nivel.dificultad) && nivel.dificultad >= 1 && nivel.dificultad <= 5,
      `${nivel.id}: dificultad ${nivel.dificultad}`
    );

    const objetivo = normalizarObjetivo(nivel.objetivo);
    if (objetivo.tipo === 'meta') {
      assert.ok(metasDe(nivel) >= 1, `${nivel.id} pide la meta pero no tiene ninguna`);
    }
    assert.ok(
      monedasDe(nivel) >= objetivo.monedas,
      `${nivel.id} exige ${objetivo.monedas} monedas y solo tiene ${monedasDe(nivel)}`
    );
  }
});

test('la dificultad y la longitud crecen nivel a nivel', () => {
  for (let i = 1; i < NIVELES.length; i++) {
    const anterior = NIVELES[i - 1];
    const actual = NIVELES[i];

    assert.ok(
      actual.dificultad >= anterior.dificultad,
      `${actual.id} (dificultad ${actual.dificultad}) no puede ser más fácil que ${anterior.id}`
    );
    assert.ok(
      actual.ancho >= anterior.ancho,
      `${actual.id} (${actual.ancho} px) no puede ser más corto que ${anterior.id}`
    );
  }
});

test('el primer nivel no exige monedas: sirve de tutorial', () => {
  assert.equal(normalizarObjetivo(NIVELES[0].objetivo).monedas, 0);
});

test('nivelPorId() e indiceDeNivel() encuentran el nivel en el catálogo', () => {
  assert.equal(nivelPorId('nivel-3'), NIVELES[2]);
  assert.equal(nivelPorId('no-existe'), null);
  assert.equal(indiceDeNivel('nivel-3'), 2);
  assert.equal(indiceDeNivel('no-existe'), -1);
  assert.equal(nivelPorId('nivel-3', []), null, 'un catálogo vacío no encuentra nada');
});

test('siguienteNivel() encadena el catálogo y termina en null', () => {
  assert.equal(siguienteNivel('nivel-1'), NIVELES[1]);
  assert.equal(siguienteNivel('nivel-4'), NIVELES[4]);

  const ultimo = idsDeNiveles().at(-1);
  assert.equal(siguienteNivel(ultimo), null, 'tras el último nivel no hay nada');
  assert.equal(siguienteNivel('no-existe'), null);
});

test('crearCatalogo() ordena por `orden` y congela el resultado', () => {
  const desordenado = [
    { id: 'b', orden: 2 },
    { id: 'a', orden: 1 }
  ];

  const catalogo = crearCatalogo(desordenado);
  assert.deepEqual(idsDeNiveles(catalogo), ['a', 'b']);
  assert.ok(Object.isFrozen(catalogo), 'el catálogo es de solo lectura');

  const sinOrden = crearCatalogo([{ id: 'primero' }, { id: 'segundo' }]);
  assert.deepEqual(idsDeNiveles(sinOrden), ['primero', 'segundo'], 'sin `orden` manda la posición');
});

test('idDeNivel() cae al nombre o a la posición cuando falta el id', () => {
  assert.equal(idDeNivel({ id: 'x' }), 'x');
  assert.equal(idDeNivel({ nombre: 'Suelto' }), 'Suelto');
  assert.equal(idDeNivel({}, 2), 'nivel-3');
});

test('añadir un nivel es solo datos: el catálogo acepta uno más sin tocar el motor', () => {
  const extra = { ...NIVELES[0], id: 'nivel-extra', orden: 9, nombre: 'Extra' };
  const catalogo = crearCatalogo([...NIVELES, extra]);

  assert.equal(totalNiveles(catalogo), 6);
  assert.equal(idsDeNiveles(catalogo).at(-1), 'nivel-extra');
  assert.equal(validarNivel(extra).valido, true);
  assert.equal(validarCatalogo(catalogo).valido, true, 'y el catálogo sigue siendo válido');
});
