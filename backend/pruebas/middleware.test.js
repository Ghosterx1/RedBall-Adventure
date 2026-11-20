import test from 'node:test';
import assert from 'node:assert/strict';

import { cabecerasSeguridad, manejarErrores, noEncontradoApi } from '../src/middleware/errores.js';
import { cors } from '../src/middleware/cors.js';
import { limitePeticiones } from '../src/middleware/limite.js';
import { ErrorHttp, noEncontrado, peticionInvalida } from '../src/errores.js';
import { peticionFalsa, respuestaFalsa, siguienteFalso } from './ayudas/respuesta.js';

/**
 * Los middlewares son la otra frontera del backend: cabeceras, CORS, freno de
 * peticiones y traducción de errores a JSON. Se prueban con `req`/`res` falsos.
 */

/** Registro que apunta lo que le llega. */
function registroFalso() {
  const errores = [];
  return { errores, error: (...datos) => errores.push(datos), warn: () => {}, log: () => {} };
}

/* ── Cabeceras de seguridad y 404 de la API ──────────────────────────────── */

test('las cabeceras de seguridad se ponen en todas las respuestas', () => {
  const res = respuestaFalsa();
  const siguiente = siguienteFalso();

  cabecerasSeguridad()(peticionFalsa(), res, siguiente);

  assert.equal(res.cabeceras['x-content-type-options'], 'nosniff');
  assert.equal(res.cabeceras['x-frame-options'], 'SAMEORIGIN');
  assert.equal(res.cabeceras['referrer-policy'], 'no-referrer');
  assert.ok(siguiente.llamado());
});

test('una ruta /api que no existe contesta 404 en JSON', () => {
  const res = respuestaFalsa();

  noEncontradoApi(peticionFalsa({ metodo: 'GET', ruta: '/inventada' }), res);

  assert.equal(res.estado, 404);
  assert.equal(res.cuerpo.ok, false);
  assert.equal(res.cuerpo.error.codigo, 'NO_ENCONTRADO');
  assert.match(res.cuerpo.error.mensaje, /GET \/api\/inventada/);
});

/* ── Traducción de errores ───────────────────────────────────────────────── */

test('un ErrorHttp sale con su estado, su código y sus detalles', () => {
  const res = respuestaFalsa();
  const registro = registroFalso();

  manejarErrores(registro)(
    new ErrorHttp(400, 'NIVEL_DESCONOCIDO', 'Ese nivel no existe.', { niveles: ['nivel-1'] }),
    peticionFalsa(),
    res,
    siguienteFalso()
  );

  assert.equal(res.estado, 400);
  assert.deepEqual(res.cuerpo, {
    ok: false,
    error: {
      codigo: 'NIVEL_DESCONOCIDO',
      mensaje: 'Ese nivel no existe.',
      detalles: { niveles: ['nivel-1'] }
    }
  });
  assert.equal(registro.errores.length, 0, 'un 400 no es un fallo del servidor');
});

test('los atajos peticionInvalida y noEncontrado ya traen su código', () => {
  assert.equal(peticionInvalida('X', 'mensaje').estado, 400);
  assert.equal(peticionInvalida('X', 'mensaje').codigo, 'X');
  assert.equal(noEncontrado('no está').estado, 404);
  assert.equal(noEncontrado('no está').codigo, 'NO_ENCONTRADO');
});

test('un fallo inesperado es un 500 y se registra', () => {
  const res = respuestaFalsa();
  const registro = registroFalso();

  manejarErrores(registro)(new Error('se rompió todo'), peticionFalsa(), res, siguienteFalso());

  assert.equal(res.estado, 500);
  assert.equal(res.cuerpo.error.codigo, 'ERROR_INTERNO');
  assert.equal(res.cuerpo.error.mensaje, 'se rompió todo');
  assert.equal(registro.errores.length, 1, 'los 500 van al log');
});

test('en producción un 500 no cuenta lo que pasó por dentro', () => {
  const res = respuestaFalsa();

  manejarErrores(registroFalso(), { produccion: true })(
    new Error('la ruta /etc/secrets no existe'),
    peticionFalsa(),
    res,
    siguienteFalso()
  );

  assert.equal(res.estado, 500);
  assert.doesNotMatch(res.cuerpo.error.mensaje, /secrets/);
  assert.match(res.cuerpo.error.mensaje, /Vuelve a intentarlo/);
});

test('los errores de Express se traducen a códigos estables', () => {
  const casos = [
    [{ type: 'entity.parse.failed', status: 400 }, 400, 'JSON_INVALIDO'],
    [{ type: 'entity.too.large', status: 413 }, 413, 'CUERPO_DEMASIADO_GRANDE'],
    [{ status: 404 }, 404, 'NO_ENCONTRADO'],
    [{ status: 42 }, 500, 'ERROR_INTERNO'],
    [{ status: 'mucho' }, 500, 'ERROR_INTERNO']
  ];

  for (const [error, estado, codigo] of casos) {
    const res = respuestaFalsa();
    manejarErrores(registroFalso())(Object.assign(error, { message: 'x' }), peticionFalsa(), res, siguienteFalso());
    assert.equal(res.estado, estado, `estado de ${codigo}`);
    assert.equal(res.cuerpo.error.codigo, codigo);
  }
});

test('si ya se enviaron cabeceras, el error sigue su curso', () => {
  const res = respuestaFalsa();
  res.headersSent = true;
  const siguiente = siguienteFalso();
  const error = new Error('tarde');

  manejarErrores(registroFalso())(error, peticionFalsa(), res, siguiente);

  assert.deepEqual(siguiente.llamadas, [error]);
  assert.equal(res.cuerpo, null);
});

/* ── CORS ────────────────────────────────────────────────────────────────── */

test('con CORS abierto cualquier origen puede llamar a la API', () => {
  const res = respuestaFalsa();
  const siguiente = siguienteFalso();

  cors(['*'])(peticionFalsa({ cabeceras: { origin: 'https://juego.example' } }), res, siguiente);

  assert.equal(res.cabeceras['access-control-allow-origin'], '*');
  assert.equal(res.cabeceras.vary, 'Origin');
  assert.equal(res.cabeceras['access-control-allow-methods'], 'GET, POST, PUT, OPTIONS');
  assert.ok(siguiente.llamado());
});

test('con una lista de orígenes solo se permite lo que está en la lista', () => {
  const permitidos = cors(['https://redball.example']);

  const dentro = respuestaFalsa();
  permitidos(peticionFalsa({ cabeceras: { origin: 'https://redball.example' } }), dentro, siguienteFalso());
  assert.equal(dentro.cabeceras['access-control-allow-origin'], 'https://redball.example');

  const fuera = respuestaFalsa();
  permitidos(peticionFalsa({ cabeceras: { origin: 'https://intruso.example' } }), fuera, siguienteFalso());
  assert.equal(fuera.cabeceras['access-control-allow-origin'], undefined);
});

test('el preflight se contesta aquí mismo, sin llegar a la ruta', () => {
  const res = respuestaFalsa();
  const siguiente = siguienteFalso();

  cors(['*'])(peticionFalsa({ metodo: 'OPTIONS', cabeceras: { origin: 'https://x.example' } }), res, siguiente);

  assert.equal(res.estado, 204);
  assert.ok(res.terminada);
  assert.equal(siguiente.llamado(), false);
});

/* ── Límite de peticiones ────────────────────────────────────────────────── */

test('el límite deja pasar hasta el máximo y luego corta con 429', () => {
  const limitar = limitePeticiones({ maximo: 2, ahora: () => 1_000 });
  const cabeceras = [];
  const estados = [];

  for (let i = 0; i < 3; i += 1) {
    const res = respuestaFalsa();
    const siguiente = siguienteFalso();
    limitar(peticionFalsa({ ip: '10.0.0.1' }), res, siguiente);
    cabeceras.push(res.cabeceras['ratelimit-remaining']);
    estados.push(res.estado);
    if (i < 2) assert.ok(siguiente.llamado(), `la petición ${i + 1} debería pasar`);
    else assert.equal(siguiente.llamado(), false, 'la tercera ya no pasa');
  }

  assert.deepEqual(cabeceras, ['1', '0', '0']);
  assert.deepEqual(estados, [200, 200, 429]);

  const res = respuestaFalsa();
  limitar(peticionFalsa({ ip: '10.0.0.1' }), res, siguienteFalso());
  assert.equal(res.estado, 429);
  assert.equal(res.cuerpo.error.codigo, 'DEMASIADAS_PETICIONES');
  assert.match(res.cabeceras['retry-after'], /^\d+$/);
});

test('cada IP lleva su propia cuenta y la ventana se reinicia', () => {
  let momento = 0;
  const limitar = limitePeticiones({ maximo: 1, ventana: 1_000, ahora: () => momento });

  const primera = respuestaFalsa();
  limitar(peticionFalsa({ ip: '10.0.0.1' }), primera, siguienteFalso());
  assert.equal(primera.estado, 200);

  const otraIp = respuestaFalsa();
  limitar(peticionFalsa({ ip: '10.0.0.2' }), otraIp, siguienteFalso());
  assert.equal(otraIp.estado, 200, 'otra IP no paga el pato');

  const repetida = respuestaFalsa();
  limitar(peticionFalsa({ ip: '10.0.0.1' }), repetida, siguienteFalso());
  assert.equal(repetida.estado, 429);

  momento = 1_500; // pasó la ventana
  const despues = respuestaFalsa();
  limitar(peticionFalsa({ ip: '10.0.0.1' }), despues, siguienteFalso());
  assert.equal(despues.estado, 200);
});

test('limitePeticiones=0 desactiva el freno del todo', () => {
  const limitar = limitePeticiones({ maximo: 0 });
  const siguiente = siguienteFalso();
  const res = respuestaFalsa();

  for (let i = 0; i < 100; i += 1) limitar(peticionFalsa(), res, siguiente);

  assert.equal(siguiente.llamadas.length, 100);
  assert.equal(res.cabeceras['ratelimit-limit'], undefined, 'sin límite no se anuncian cabeceras');
});
