import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CLAVE_PROGRESO,
  guardarProgreso,
  leerProgreso,
  normalizarProgreso,
  progresoVacio,
  registrarPartida,
  registroDe
} from '../src/nucleo/Progreso.js';
import { almacenFalso, almacenRoto } from './ayudas/almacen-falso.js';

/**
 * Persistencia del récord. Dos reglas que no se pueden romper: nunca lanza
 * (aunque el navegador bloquee el almacén) y nunca empeora el récord.
 */

const partida = (extra = {}) => ({
  nivel: 'demo',
  puntos: 100,
  monedas: 4,
  totalMonedas: 21,
  completado: false,
  ...extra
});

test('sin almacén disponible se juega igual: progreso vacío y guardado fallido', () => {
  assert.deepEqual(leerProgreso(null), progresoVacio());
  assert.deepEqual(leerProgreso(undefined), progresoVacio());
  assert.deepEqual(leerProgreso(almacenRoto()), progresoVacio());
  assert.equal(guardarProgreso(progresoVacio(), null), false);
  assert.equal(guardarProgreso(progresoVacio(), almacenRoto()), false);
});

test('lo guardado se puede volver a leer', () => {
  const almacen = almacenFalso();
  const progreso = registrarPartida(progresoVacio(), partida());

  assert.equal(guardarProgreso(progreso, almacen), true);
  assert.ok(almacen.datos.has(CLAVE_PROGRESO), 'usa una clave versionada');

  const leido = leerProgreso(almacen);
  assert.deepEqual(registroDe(leido, 'demo'), registroDe(progreso, 'demo'));
});

test('un JSON corrupto o de otra forma no rompe nada', () => {
  const roto = almacenFalso({ inicial: { [CLAVE_PROGRESO]: '{esto no es json' } });
  assert.deepEqual(leerProgreso(roto), progresoVacio());

  const raro = almacenFalso({
    inicial: { [CLAVE_PROGRESO]: JSON.stringify({ version: 1, niveles: 'ninguno' }) }
  });
  assert.deepEqual(leerProgreso(raro), progresoVacio());
});

test('registrarPartida() se queda con el récord y suma una partida jugada', () => {
  const primera = registrarPartida(progresoVacio(), partida());
  assert.deepEqual(registroDe(primera, 'demo'), {
    puntos: 100,
    monedas: 4,
    totalMonedas: 21,
    completado: false,
    partidas: 1
  });

  const peor = registrarPartida(primera, partida({ puntos: 40, monedas: 1 }));
  assert.equal(registroDe(peor, 'demo').puntos, 100, 'nunca empeora');
  assert.equal(registroDe(peor, 'demo').monedas, 4);
  assert.equal(registroDe(peor, 'demo').partidas, 2);

  const mejor = registrarPartida(peor, partida({ puntos: 210, monedas: 21, completado: true }));
  assert.equal(registroDe(mejor, 'demo').puntos, 210);
  assert.equal(registroDe(mejor, 'demo').completado, true);
  assert.equal(registroDe(mejor, 'demo').partidas, 3);
});

test('una vez completado el nivel, sigue completado', () => {
  const completo = registrarPartida(progresoVacio(), partida({ completado: true }));
  const otraVez = registrarPartida(completo, partida({ puntos: 0, monedas: 0 }));

  assert.equal(registroDe(otraVez, 'demo').completado, true);
});

test('registrarPartida() no modifica el progreso recibido', () => {
  const original = progresoVacio();
  const copia = JSON.stringify(original);

  registrarPartida(original, partida());

  assert.equal(JSON.stringify(original), copia, 'es una función pura');
  assert.deepEqual(Object.keys(original.niveles), [], 'no se le añaden niveles');
});

test('los niveles son independientes y el que falta vale cero', () => {
  const progreso = registrarPartida(progresoVacio(), partida({ nivel: 'nivel-1' }));

  assert.equal(registroDe(progreso, 'nivel-1').puntos, 100);
  assert.deepEqual(registroDe(progreso, 'nivel-2'), {
    puntos: 0,
    monedas: 0,
    totalMonedas: 0,
    completado: false,
    partidas: 0
  });
});

test('los datos sucios se normalizan a enteros ≥ 0', () => {
  const sucio = {
    version: 1,
    niveles: {
      demo: { puntos: -50, monedas: 'muchas', totalMonedas: 3.7, completado: 'sí', partidas: Number.NaN },
      '': { puntos: 999 }, // clave vacía: se descarta
      otro: null
    }
  };

  const limpio = normalizarProgreso(sucio);

  assert.deepEqual(registroDe(limpio, 'demo'), {
    puntos: 0,
    monedas: 0,
    totalMonedas: 3,
    completado: false,
    partidas: 0
  });
  assert.equal('' in limpio.niveles, false, 'los niveles sin nombre se descartan');
  assert.deepEqual(registroDe(limpio, 'otro').puntos, 0);
});
