import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { leerConfig, RAIZ_BACKEND, RAIZ_PROYECTO, VERSION_API } from '../src/config.js';

/**
 * config.js se lee del entorno, pero cada variable tiene un valor por defecto:
 * `npm start` sin `.env` tiene que arrancar. Aquí se fijan los dos casos y los
 * límites (un PORT imposible no puede tumbar el servidor).
 */

test('sin entorno, todo tiene un valor por defecto usable', () => {
  const config = leerConfig({});

  assert.equal(config.puerto, 3000);
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.entorno, 'development');
  assert.equal(config.produccion, false);
  assert.equal(config.archivoDatos, 'redball.json');
  assert.deepEqual(config.origenes, ['*']);
  assert.equal(config.limiteCuerpo, '64kb');
  assert.equal(config.limitePeticiones, 60);
  assert.equal(config.limiteRanking, 50);
  assert.equal(config.versionApi, VERSION_API);
  assert.equal(config.carpetaFrontend, path.join(RAIZ_PROYECTO, 'frontend'));
  assert.equal(config.carpetaDatos, path.join(RAIZ_BACKEND, 'datos'));
});

test('la configuración resultante no se puede modificar por accidente', () => {
  const config = leerConfig({});

  assert.ok(Object.isFrozen(config));
  assert.throws(() => {
    'use strict';
    config.puerto = 1;
  }, TypeError);
});

test('las variables de entorno se leen y se limpian', () => {
  const config = leerConfig({
    PORT: ' 8080 ',
    HOST: '127.0.0.1',
    NODE_ENV: 'production',
    DATOS_ARCHIVO: '  otra.json  ',
    LIMITE_CUERPO: '16kb',
    LIMITE_PETICIONES: '0',
    LIMITE_RANKING: '10'
  });

  assert.equal(config.puerto, 8080);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.produccion, true);
  assert.equal(config.archivoDatos, 'otra.json');
  assert.equal(config.limiteCuerpo, '16kb');
  assert.equal(config.limitePeticiones, 0, '0 significa sin límite');
  assert.equal(config.limiteRanking, 10);
});

test('un PORT imposible cae al valor por defecto o al límite', () => {
  assert.equal(leerConfig({ PORT: 'ochenta' }).puerto, 3000);
  assert.equal(leerConfig({ PORT: '' }).puerto, 3000);
  assert.equal(leerConfig({ PORT: '-1' }).puerto, 0, 'se recorta al mínimo válido');
  assert.equal(leerConfig({ PORT: '70000' }).puerto, 65535);
});

test('el límite del ranking no puede quedar en cero ni dispararse', () => {
  assert.equal(leerConfig({ LIMITE_RANKING: '0' }).limiteRanking, 1);
  assert.equal(leerConfig({ LIMITE_RANKING: '9999' }).limiteRanking, 500);
  assert.equal(leerConfig({ LIMITE_RANKING: 'muchas' }).limiteRanking, 50);
});

test('los orígenes de CORS se separan por comas', () => {
  const config = leerConfig({
    CORS_ORIGENES: 'https://a.example, https://b.example ,,https://c.example'
  });

  assert.deepEqual(config.origenes, ['https://a.example', 'https://b.example', 'https://c.example']);
  assert.deepEqual(leerConfig({ CORS_ORIGENES: '   ' }).origenes, ['*']);
});

test('las rutas relativas se resuelven contra la raíz del repo, no contra el cwd', () => {
  const config = leerConfig({ DATOS_DIR: 'backend/datos', FRONTEND_DIR: 'frontend' });

  assert.equal(config.carpetaDatos, path.join(RAIZ_PROYECTO, 'backend', 'datos'));
  assert.equal(config.carpetaFrontend, path.join(RAIZ_PROYECTO, 'frontend'));
});
