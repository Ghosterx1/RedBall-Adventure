import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { crearAlmacenMemoria } from '../src/almacen/almacenMemoria.js';
import { crearAlmacenJson } from '../src/almacen/almacenJson.js';

/**
 * Los dos almacenes (RAM y JSON) comparten contrato: `leer`, `guardar` y
 * `actualizar`. Aquí se prueba ese contrato en los dos, incluidos los detalles
 * que de verdad importan: aislamiento de las copias, una escritura a la vez y
 * tolerancia a un archivo corrupto.
 */

const temporal = await fs.mkdtemp(path.join(os.tmpdir(), 'redball-pruebas-'));
after(() => fs.rm(temporal, { recursive: true, force: true }));

/** Almacén de mentira que apunta los avisos de `warn`. */
function registroFalso() {
  const avisos = [];
  return { avisos, warn: (texto) => avisos.push(texto), error: () => {}, log: () => {} };
}

/* ── Almacén en memoria ──────────────────────────────────────────────────── */

test('el almacén en memoria empieza vacío y guarda lo que se le da', async () => {
  const almacen = crearAlmacenMemoria();

  assert.equal(await almacen.leer(), null);
  assert.equal(almacen.tipo, 'memoria');

  await almacen.guardar({ jugadores: { 'jug-abc': { puntos: 10 } } });

  assert.deepEqual(await almacen.leer(), { jugadores: { 'jug-abc': { puntos: 10 } } });
});

test('lo que devuelve el almacén es una copia (mutarla no toca el dato)', async () => {
  const almacen = crearAlmacenMemoria({ jugadores: {} });

  const copia = await almacen.leer();
  copia.jugadores['jug-intruso'] = { puntos: 999 };

  assert.deepEqual(await almacen.leer(), { jugadores: {} });
});

test('actualizar lee, deja mutar y guarda', async () => {
  const almacen = crearAlmacenMemoria();

  const resultado = await almacen.actualizar((datos) => {
    assert.equal(datos, null, 'la primera vez no hay nada guardado');
    return { jugadores: { 'jug-abc': { puntos: 10 } } };
  });

  assert.deepEqual(resultado, { jugadores: { 'jug-abc': { puntos: 10 } } });
  assert.deepEqual(await almacen.leer(), resultado);
});

test('si el mutador no devuelve nada, no se guarda nada', async () => {
  const almacen = crearAlmacenMemoria({ version: 1 });

  const resultado = await almacen.actualizar(() => undefined);

  assert.deepEqual(resultado, { version: 1 });
  assert.equal(almacen.escrituras, 1, 'se cuenta el intento, pero el dato no cambia');
});

test('los contadores distinguen lecturas de escrituras', async () => {
  const almacen = crearAlmacenMemoria();

  await almacen.leer();
  await almacen.leer();
  await almacen.guardar({ version: 1 });

  assert.equal(almacen.lecturas, 2);
  assert.equal(almacen.escrituras, 1);
});

test('dos actualizaciones a la vez no se pisan (se encadenan)', async () => {
  const almacen = crearAlmacenMemoria({ contador: 0 });

  const sumar = () =>
    almacen.actualizar((datos) => {
      datos.contador += 1;
      return datos;
    });

  await Promise.all([sumar(), sumar(), sumar()]);

  assert.equal((await almacen.leer()).contador, 3);
});

/* ── Almacén en JSON ─────────────────────────────────────────────────────── */

test('el almacén JSON necesita una carpeta de datos', () => {
  assert.throws(() => crearAlmacenJson({}), /carpeta de datos/);
});

test('el almacén JSON empieza sin archivo y lo crea al guardar', async () => {
  const carpeta = path.join(temporal, 'basico');
  const almacen = crearAlmacenJson({ carpeta, archivo: 'redball.json' });

  assert.equal(almacen.tipo, 'json');
  assert.equal(await almacen.leer(), null, 'sin archivo no hay datos, y no es un error');

  await almacen.guardar({ version: 1, jugadores: { 'jug-abc': { puntos: 10 } } });

  const crudo = await fs.readFile(path.join(carpeta, 'redball.json'), 'utf8');
  assert.match(crudo, /\n {2}"version": 1/, 'el archivo se escribe legible, no en una línea');
  assert.deepEqual(await fs.readdir(carpeta), ['redball.json'], 'no queda ningún .tmp suelto');
});

test('lo guardado sobrevive a reiniciar el servidor', async () => {
  const carpeta = path.join(temporal, 'persistente');

  await crearAlmacenJson({ carpeta, archivo: 'redball.json' }).guardar({ version: 1, jugadores: {} });
  const otraVez = crearAlmacenJson({ carpeta, archivo: 'redball.json' });

  assert.deepEqual(await otraVez.leer(), { version: 1, jugadores: {} });
});

test('actualizar en JSON lee, deja mutar y escribe', async () => {
  const carpeta = path.join(temporal, 'actualizar');
  const almacen = crearAlmacenJson({ carpeta, archivo: 'redball.json' });

  const resultado = await almacen.actualizar((datos) => {
    assert.equal(datos, null);
    return { version: 1, jugadores: { 'jug-abc': { puntos: 10 } } };
  });

  assert.deepEqual(resultado, { version: 1, jugadores: { 'jug-abc': { puntos: 10 } } });
  assert.deepEqual(await almacen.leer(), resultado);
});

test('un archivador roto avisa y se empieza de cero, sin caerse', async () => {
  const carpeta = path.join(temporal, 'corrupto');
  await fs.mkdir(carpeta, { recursive: true });
  await fs.writeFile(path.join(carpeta, 'redball.json'), 'esto no es JSON {', 'utf8');

  const registro = registroFalso();
  const almacen = crearAlmacenJson({ carpeta, archivo: 'redball.json', registro });

  assert.equal(await almacen.leer(), null);
  assert.equal(registro.avisos.length, 1);
  assert.match(registro.avisos[0], /no se pudo leer/);

  // Y sigue siendo utilizable: el siguiente guardado arregla el archivo.
  await almacen.guardar({ version: 1, jugadores: {} });
  assert.deepEqual(await almacen.leer(), { version: 1, jugadores: {} });
});

test('si el mutador lanza, el archivo se queda como estaba', async () => {
  const carpeta = path.join(temporal, 'intacto');
  const almacen = crearAlmacenJson({ carpeta, archivo: 'redball.json' });
  await almacen.guardar({ version: 1, jugadores: {} });

  await assert.rejects(
    almacen.actualizar(() => {
      throw new Error('se cae a mitad');
    }),
    /se cae a mitad/
  );

  assert.deepEqual(await almacen.leer(), { version: 1, jugadores: {} });
});

test('una escritura a la vez: dos mutaciones simultáneas no se pierden', async () => {
  const carpeta = path.join(temporal, 'concurrente');
  const almacen = crearAlmacenJson({ carpeta, archivo: 'redball.json' });
  await almacen.guardar({ version: 1, contador: 0 });

  const sumar = () =>
    almacen.actualizar((datos) => {
      datos.contador += 1;
      return datos;
    });

  await Promise.all([sumar(), sumar(), sumar()]);

  assert.equal((await almacen.leer()).contador, 3);
  assert.deepEqual(await fs.readdir(carpeta), ['redball.json'], 'sin temporales huérfanos');
});
