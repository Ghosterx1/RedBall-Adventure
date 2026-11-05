import test from 'node:test';
import assert from 'node:assert/strict';

import { Bucle } from '../src/nucleo/Bucle.js';
import { PASO_FIJO, TOPE_TIEMPO, MAX_PASOS } from '../src/config/ajustes.js';

function crearBucle(opciones = {}) {
  return new Bucle({
    actualizar: () => {},
    planificar: () => 0,
    cancelar: () => {},
    ...opciones
  });
}

/**
 * Simula `segundos` de tiempo real a `hercios` de refresco y devuelve el
 * tiempo simulado acumulado y el número de pasos ejecutados.
 */
function simular(hercios, segundos, actualizar = () => {}) {
  let tiempoSimulado = 0;
  const bucle = crearBucle({
    actualizar: (dt) => {
      tiempoSimulado += dt;
      actualizar(dt);
    }
  });

  const cuadros = Math.round(hercios * segundos);
  // El primer avanzarHasta solo toma la referencia temporal (toca con i = 0).
  for (let i = 0; i <= cuadros; i++) {
    bucle.avanzarHasta((i * 1000) / hercios);
  }

  return { tiempoSimulado, pasos: bucle.pasosTotales, cuadros: bucle.cuadrosTotales, bucle };
}

test('el paso fijo simula el mismo tiempo real a cualquier frecuencia', () => {
  const resultados = [30, 60, 75, 120, 144, 240].map((hz) => ({ hz, ...simular(hz, 1) }));

  for (const { hz, tiempoSimulado, pasos } of resultados) {
    assert.ok(
      Math.abs(tiempoSimulado - 1) < 0.02,
      `a ${hz} Hz se simularon ${tiempoSimulado.toFixed(4)} s en vez de 1 s`
    );
    assert.ok(
      Math.abs(pasos - 60) <= 1,
      `a ${hz} Hz se ejecutaron ${pasos} pasos en vez de ~60`
    );
  }
});

test('una posición integrada coincide dentro de un paso a cualquier frecuencia', () => {
  const correr = (hercios, segundos) => {
    let x = 0;
    const resultado = simular(hercios, segundos, (dt) => {
      x += 300 * dt; // velocidad constante de 300 px/s
    });
    return { x, ...resultado };
  };

  const unPasoDeMovimiento = 300 * PASO_FIJO; // 5 px

  for (const hz of [30, 60, 75, 120, 144]) {
    const { x, pasos, tiempoSimulado } = correr(hz, 3);
    assert.ok(
      Math.abs(x - 900) <= unPasoDeMovimiento + 1e-9,
      `a ${hz} Hz x = ${x.toFixed(3)} px en vez de ~900`
    );
    assert.ok(Math.abs(pasos - 180) <= 1, `a ${hz} Hz ${pasos} pasos en vez de ~180`);
    assert.ok(Math.abs(tiempoSimulado - 3) < 0.02);
  }
});

test('no hay deriva acumulada: la diferencia entre 60 y 144 Hz no crece', () => {
  const posicion = (hercios, segundos) => {
    let x = 0;
    simular(hercios, segundos, (dt) => {
      x += 300 * dt;
    });
    return x;
  };

  const diferencia1s = Math.abs(posicion(60, 1) - posicion(144, 1));
  const diferencia10s = Math.abs(posicion(60, 10) - posicion(144, 10));
  const unPasoDeMovimiento = 300 * PASO_FIJO;

  assert.ok(diferencia1s <= unPasoDeMovimiento + 1e-9, `diferencia a 1 s: ${diferencia1s}`);
  assert.ok(diferencia10s <= unPasoDeMovimiento + 1e-9, `diferencia a 10 s: ${diferencia10s}`);
});

test('se descarta el exceso de tiempo por encima del tope', () => {
  const bucle = crearBucle();
  bucle.avanzarHasta(0);
  bucle.avanzarHasta(10_000); // pestaña minimizada 10 s

  const pasosEsperadosMax = Math.ceil(TOPE_TIEMPO / PASO_FIJO);
  assert.ok(
    bucle.pasosTotales <= Math.min(MAX_PASOS, pasosEsperadosMax),
    `se ejecutaron ${bucle.pasosTotales} pasos con un salto de 10 s`
  );
  assert.ok(bucle.acumulador >= 0 && bucle.acumulador < PASO_FIJO);
});

test('nunca se superan los pasos máximos por cuadro', () => {
  const bucle = crearBucle({ maxPasos: 3 });
  bucle.avanzarHasta(0);
  bucle.avanzarHasta(200); // 0,2 s = 12 pasos potenciales
  assert.equal(bucle.pasosTotales, 3);
  assert.equal(bucle.acumulador, 0, 'la deuda de tiempo debe descartarse');
});

test('en pausa no se simula, pero se sigue dibujando', () => {
  let actualizaciones = 0;
  let dibujos = 0;
  const bucle = crearBucle({
    actualizar: () => actualizaciones++,
    dibujar: () => dibujos++
  });

  bucle.avanzarHasta(0);
  bucle.pausar();
  for (let i = 1; i <= 60; i++) bucle.avanzarHasta(i * (1000 / 60));

  assert.equal(actualizaciones, 0);
  assert.equal(dibujos, 60);

  bucle.reanudar();
  bucle.avanzarHasta(2000); // primera marca tras reanudar: solo referencia
  bucle.avanzarHasta(2000 + 1000 / 60);
  assert.equal(actualizaciones, 1, 'al reanudar no debe acumularse el tiempo en pausa');
});

test('un delta negativo o no finito no rompe el bucle', () => {
  const bucle = crearBucle();
  bucle.avanzarHasta(1000);
  bucle.avanzarHasta(500); // retroceso de reloj
  bucle.avanzarHasta(Number.NaN);
  assert.equal(bucle.pasosTotales, 0);
});

test('iniciar programa cuadros y detener cancela la petición pendiente', () => {
  const peticiones = [];
  const cancelaciones = [];
  const bucle = crearBucle({
    planificar: (cb) => {
      peticiones.push(cb);
      return peticiones.length;
    },
    cancelar: (id) => cancelaciones.push(id)
  });

  bucle.iniciar();
  assert.equal(peticiones.length, 1);
  assert.equal(bucle.corriendo, true);

  bucle.detener();
  assert.deepEqual(cancelaciones, [1]);
  assert.equal(bucle.corriendo, false);

  // Un cuadro que llegue tarde tras detener no debe reprogramar nada.
  peticiones[0](16.7);
  assert.equal(peticiones.length, 1);
});
