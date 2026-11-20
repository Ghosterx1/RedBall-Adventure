import test, { after } from 'node:test';
import assert from 'node:assert/strict';

import { conCuerpoJson, levantarApi, pedir } from './ayudas/servidor.js';

/**
 * Pruebas de contrato HTTP: se levanta la API de verdad en un puerto libre y se
 * le habla como lo haría el navegador. El almacén es en memoria, así que cada
 * archivo de pruebas empieza con la base vacía y no deja nada en disco.
 */

const api = await levantarApi();
after(() => api.cerrar());

/** Anota una partida y devuelve la respuesta (201 si el jugador es nuevo). */
function anotar(jugador, partida, extra = {}) {
  return pedir(api.base, '/api/records', conCuerpoJson('POST', { jugador, ...partida, ...extra }));
}

/* ── Estado del servicio ─────────────────────────────────────────────────── */

test('GET /api/salud cuenta que el servicio está vivo', async () => {
  const { estado, cuerpo, cabeceras } = await pedir(api.base, '/api/salud');

  assert.equal(estado, 200);
  assert.equal(cuerpo.ok, true);
  assert.equal(cuerpo.servicio, 'redball-api');
  assert.equal(cuerpo.version, 1);
  assert.equal(cuerpo.niveles, 5);
  assert.equal(typeof cuerpo.jugadores, 'number');
  assert.equal(typeof cuerpo.tiempoActivo, 'number');
  assert.equal(cabeceras.get('x-content-type-options'), 'nosniff', 'las cabeceras de seguridad viajan');
});

test('GET /api/niveles devuelve el catálogo sin desvelar la geometría', async () => {
  const { estado, cuerpo } = await pedir(api.base, '/api/niveles');

  assert.equal(estado, 200);
  assert.equal(cuerpo.total, 5);
  assert.deepEqual(
    cuerpo.niveles.map((nivel) => nivel.id),
    ['nivel-1', 'nivel-2', 'nivel-3', 'nivel-4', 'nivel-5']
  );

  const primero = cuerpo.niveles[0];
  assert.equal(primero.numero, 1);
  assert.equal(typeof primero.nombre, 'string');
  assert.equal(typeof primero.dificultad, 'number');
  assert.equal(primero.objetos, undefined, 'los objetos del nivel son contenido del juego, no API');
});

/* ── Anotar partidas ─────────────────────────────────────────────────────── */

test('sin nadie jugando el ranking está vacío (no es un error)', async () => {
  const { estado, cuerpo } = await pedir(api.base, '/api/records');

  assert.equal(estado, 200);
  assert.equal(cuerpo.ok, true);
  assert.equal(cuerpo.nivel, null);
  assert.equal(cuerpo.total, 0);
  assert.deepEqual(cuerpo.records, []);
});

test('POST /api/records da de alta al jugador y devuelve su puesto', async () => {
  const { estado, cuerpo } = await anotar(
    'jug-uno',
    { nivel: 'nivel-1', puntos: 120, monedas: 2, totalMonedas: 2, completado: true },
    { nombre: '  ANA  ' }
  );

  assert.equal(estado, 201, 'un jugador nuevo entra con 201');
  assert.equal(cuerpo.ok, true);
  assert.equal(cuerpo.nuevo, true);
  assert.equal(cuerpo.mejorado, true);
  assert.equal(cuerpo.posicion, 1);
  assert.equal(cuerpo.record.nivel, 'nivel-1');
  assert.equal(cuerpo.record.puntos, 120);
  assert.equal(cuerpo.record.monedas, 2);
  assert.equal(cuerpo.record.totalMonedas, 2);
  assert.equal(cuerpo.record.completado, true);
  assert.equal(cuerpo.record.partidas, 1);
  assert.equal(typeof cuerpo.record.fecha, 'string', 'cuándo se consiguió el récord');
  assert.equal(cuerpo.perfil.nombre, 'ANA');
  assert.deepEqual(cuerpo.perfil.resumen, { puntos: 120, completados: 1, total: 5, partidas: 1 });

  const ranking = await pedir(api.base, '/api/records');
  assert.equal(ranking.cuerpo.total, 1);
  assert.deepEqual(
    ranking.cuerpo.records.map((fila) => [fila.posicion, fila.nombre, fila.puntos, fila.completados]),
    [[1, 'ANA', 120, 1]]
  );
});

test('el récord nunca empeora, pero la partida sí se cuenta', async () => {
  const mejor = await anotar('jug-uno', {
    nivel: 'nivel-1',
    puntos: 300,
    monedas: 2,
    totalMonedas: 2,
    completado: true
  });
  const peor = await anotar('jug-uno', { nivel: 'nivel-1', puntos: 40, monedas: 1, totalMonedas: 2 });

  assert.equal(peor.estado, 200, 'un jugador que ya existía actualiza, no crea');
  assert.equal(peor.cuerpo.nuevo, false);
  assert.equal(peor.cuerpo.mejorado, false);
  assert.equal(peor.cuerpo.record.puntos, 300, 'se queda el máximo');
  assert.equal(peor.cuerpo.record.completado, true, 'lo completado no se descompleta');
  assert.equal(
    peor.cuerpo.record.partidas,
    mejor.cuerpo.record.partidas + 1,
    'las partidas sí suman, aunque el récord no mejore'
  );
});

test('mejorar el récord se nota en la respuesta', async () => {
  const antes = await pedir(api.base, '/api/perfiles/jug-uno');
  const { estado, cuerpo } = await anotar('jug-uno', {
    nivel: 'nivel-1',
    puntos: 999,
    monedas: 2,
    totalMonedas: 2,
    completado: true
  });

  assert.equal(estado, 200);
  assert.equal(cuerpo.mejorado, true);
  assert.equal(cuerpo.record.puntos, 999);
  assert.equal(cuerpo.record.partidas, antes.cuerpo.perfil.resumen.partidas + 1);
});

test('el ranking por nivel solo cuenta a quien ha jugado ese nivel', async () => {
  await anotar('jug-dos', { nivel: 'nivel-2', puntos: 210, monedas: 3, totalMonedas: 5, completado: true });

  const { estado, cuerpo } = await pedir(api.base, '/api/records?nivel=nivel-2');

  assert.equal(estado, 200);
  assert.equal(cuerpo.nivel, 'nivel-2');
  assert.equal(cuerpo.total, 1);
  assert.equal(cuerpo.records[0].jugador, 'jug-dos');
  assert.equal(cuerpo.records[0].monedas, 3);
  assert.equal(cuerpo.records[0].totalMonedas, 5);
});

test('el ranking se puede recortar con ?limite', async () => {
  const { cuerpo } = await pedir(api.base, '/api/records?limite=1');

  assert.equal(cuerpo.total, 1);
  assert.equal(cuerpo.records[0].posicion, 1);
});

/* ── Entradas imposibles ─────────────────────────────────────────────────── */

test('un nivel que no existe se rechaza con 400 y la lista de niveles', async () => {
  const { estado, cuerpo } = await pedir(api.base, '/api/records?nivel=nivel-99');

  assert.equal(estado, 400);
  assert.equal(cuerpo.ok, false);
  assert.equal(cuerpo.error.codigo, 'NIVEL_DESCONOCIDO');
  assert.ok(cuerpo.error.detalles.niveles.includes('nivel-1'));
});

test('un jugador mal escrito no llega a tocar la base', async () => {
  const antes = (await pedir(api.base, '/api/salud')).cuerpo.jugadores;

  const { estado, cuerpo } = await anotar('ab', { nivel: 'nivel-1', puntos: 10 });

  assert.equal(estado, 400);
  assert.equal(cuerpo.error.codigo, 'JUGADOR_INVALIDO');
  assert.equal((await pedir(api.base, '/api/salud')).cuerpo.jugadores, antes);
});

test('más monedas que las del nivel es un envío incoherente', async () => {
  const { estado, cuerpo } = await anotar('jug-tres', {
    nivel: 'nivel-1',
    puntos: 10,
    monedas: 9,
    totalMonedas: 2
  });

  assert.equal(estado, 400);
  assert.equal(cuerpo.error.codigo, 'DATOS_INCOHERENTES');
});

test('un cuerpo que no es JSON se contesta con JSON_INVALIDO', async () => {
  const respuesta = await fetch(`${api.base}/api/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'esto no es json {'
  });

  assert.equal(respuesta.status, 400);
  assert.equal((await respuesta.json()).error.codigo, 'JSON_INVALIDO');
});

test('un cuerpo enorme se corta con 413', async () => {
  const pequena = await levantarApi({ env: { LIMITE_CUERPO: '1kb' } });
  try {
    const respuesta = await fetch(`${pequena.base}/api/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jugador: 'jug-uno', relleno: 'x'.repeat(4_000) })
    });

    assert.equal(respuesta.status, 413);
    assert.equal((await respuesta.json()).error.codigo, 'CUERPO_DEMASIADO_GRANDE');
  } finally {
    await pequena.cerrar();
  }
});

test('una ruta /api que no existe contesta 404 en JSON, no el index.html', async () => {
  const { estado, cuerpo } = await pedir(api.base, '/api/no-existe');

  assert.equal(estado, 404);
  assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO');
  assert.match(cuerpo.error.mensaje, /\/api\/no-existe/);
});

/* ── Perfiles ────────────────────────────────────────────────────────────── */

test('GET /api/perfiles/:id devuelve el progreso guardado', async () => {
  const { estado, cuerpo } = await pedir(api.base, '/api/perfiles/jug-uno');

  assert.equal(estado, 200);
  assert.equal(cuerpo.perfil.id, 'jug-uno');
  assert.equal(cuerpo.perfil.nombre, 'ANA');
  assert.equal(cuerpo.perfil.resumen.puntos, 999, 'sincroniza con el récord del ranking');
  assert.equal(cuerpo.perfil.resumen.completados, 1);
});

test('un perfil que no existe es 404, con el id en el mensaje', async () => {
  const { estado, cuerpo } = await pedir(api.base, '/api/perfiles/jug-nadie');

  assert.equal(estado, 404);
  assert.equal(cuerpo.error.codigo, 'JUGADOR_DESCONOCIDO');
  assert.match(cuerpo.error.mensaje, /jug-nadie/);
});

test('un id con formato imposible es 400 antes de buscar nada', async () => {
  const { estado, cuerpo } = await pedir(api.base, '/api/perfiles/ab');

  assert.equal(estado, 400);
  assert.equal(cuerpo.error.codigo, 'JUGADOR_INVALIDO');
});

test('PUT de progreso crea al jugador y es idempotente al repetirlo', async () => {
  const progreso = {
    version: 1,
    niveles: {
      'nivel-1': { puntos: 80, monedas: 1, totalMonedas: 2, completado: false, partidas: 1 }
    }
  };

  const crear = await pedir(
    api.base,
    '/api/perfiles/jug-cuatro/progreso',
    conCuerpoJson('PUT', { nombre: 'BEA', progreso })
  );

  assert.equal(crear.estado, 201, 'el perfil es nuevo');
  assert.equal(crear.cuerpo.nuevo, true);
  assert.equal(crear.cuerpo.perfil.nombre, 'BEA');
  assert.equal(crear.cuerpo.perfil.resumen.puntos, 80);
  assert.deepEqual(crear.cuerpo.perfil.resumen, { puntos: 80, completados: 0, total: 5, partidas: 1 });

  const repetir = await pedir(
    api.base,
    '/api/perfiles/jug-cuatro/progreso',
    conCuerpoJson('PUT', { nombre: 'BEA', progreso })
  );

  assert.equal(repetir.estado, 200);
  assert.equal(repetir.cuerpo.nuevo, false);
  assert.deepEqual(repetir.cuerpo.perfil.resumen, crear.cuerpo.perfil.resumen, 'mandarlo dos veces no suma');
});

test('sincronizar un progreso peor no borra el récord del servidor', async () => {
  const flojo = {
    version: 1,
    niveles: { 'nivel-1': { puntos: 1, monedas: 0, totalMonedas: 2, completado: false, partidas: 1 } }
  };

  const { cuerpo } = await pedir(
    api.base,
    '/api/perfiles/jug-cuatro/progreso',
    conCuerpoJson('PUT', { progreso: flojo })
  );

  assert.equal(cuerpo.perfil.resumen.puntos, 80, 'la fusión es de máximos');
  assert.equal(cuerpo.perfil.nombre, 'BEA', 'un nombre vacío no borra el que había');
});

test('sin objeto de progreso no hay nada que sincronizar', async () => {
  const { estado, cuerpo } = await pedir(
    api.base,
    '/api/perfiles/jug-cuatro/progreso',
    conCuerpoJson('PUT', { progreso: 'mucho progreso' })
  );

  assert.equal(estado, 400);
  assert.equal(cuerpo.error.codigo, 'CAMPO_INVALIDO');
});

test('las lecturas no escriben en la base', async () => {
  const antes = api.almacen.escrituras;

  await pedir(api.base, '/api/salud');
  await pedir(api.base, '/api/niveles');
  await pedir(api.base, '/api/records');
  await pedir(api.base, '/api/records?nivel=nivel-1');
  await pedir(api.base, '/api/perfiles/jug-uno');

  assert.equal(api.almacen.escrituras, antes);
  assert.ok(api.almacen.lecturas > antes, 'sí se ha leído');
});

/* ── El juego servido por la misma app ───────────────────────────────────── */

test('GET / devuelve el juego, no un JSON', async () => {
  const { estado, cuerpo, cabeceras } = await pedir(api.base, '/');

  assert.equal(estado, 200);
  assert.match(cabeceras.get('content-type'), /text\/html/);
  assert.match(cuerpo, /RedBall/i);
});

test('los recursos del juego se sirven con su tipo correcto', async () => {
  const modulo = await pedir(api.base, '/src/main.js');

  assert.equal(modulo.estado, 200);
  assert.match(modulo.cabeceras.get('content-type'), /javascript/);
  assert.match(modulo.cuerpo, /import/);
});

test('una URL sin extensión cae al juego (para poder recargar en /nivel-3)', async () => {
  const { estado, cuerpo } = await pedir(api.base, '/nivel-3');

  assert.equal(estado, 200);
  assert.match(cuerpo, /<html/i);
});

test('un archivo que no existe es 404 de texto, no el index.html', async () => {
  const { estado, cuerpo, cabeceras } = await pedir(api.base, '/Css/no-existe.css');

  assert.equal(estado, 404);
  assert.match(cabeceras.get('content-type'), /text\/plain/);
  assert.match(cuerpo, /No encontrado: \/Css\/no-existe\.css/);
});

test('el preflight de CORS se contesta sin llegar a la ruta', async () => {
  const respuesta = await fetch(`${api.base}/api/records`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://juego.example', 'Access-Control-Request-Method': 'POST' }
  });

  assert.equal(respuesta.status, 204);
  assert.equal(respuesta.headers.get('access-control-allow-origin'), '*');
  assert.equal(await respuesta.text(), '');
});

/* ── Freno de peticiones ─────────────────────────────────────────────────── */

test('con el freno activo, pasarse del límite devuelve 429 y Retry-After', async () => {
  const limitada = await levantarApi({ env: { LIMITE_PETICIONES: '2' } });
  try {
    await pedir(limitada.base, '/api/salud');
    await pedir(limitada.base, '/api/salud');
    const tercera = await pedir(limitada.base, '/api/salud');

    assert.equal(tercera.estado, 429);
    assert.equal(tercera.cuerpo.error.codigo, 'DEMASIADAS_PETICIONES');
    assert.ok(Number(tercera.cabeceras.get('retry-after')) >= 1);
    assert.equal(tercera.cabeceras.get('ratelimit-remaining'), '0');
  } finally {
    await limitada.cerrar();
  }
});
