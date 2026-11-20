import test from 'node:test';
import assert from 'node:assert/strict';

import {
  baseApi,
  CLAVE_JUGADOR,
  crearClienteApi,
  generarIdJugador,
  idDeJugador
} from '../src/interfaz/clienteApi.js';
import { almacenFalso, almacenRoto } from './ayudas/almacen-falso.js';

/**
 * clienteApi.js es la frontera de red del juego. Aquí se fija su contrato:
 * nunca lanza, siempre devuelve `{ ok, …error }`, y sin servidor el juego sigue
 * funcionando (solo se queda sin tabla de récords).
 */

/* ── De dónde sale la URL ────────────────────────────────────────────────── */

test('baseApi respeta el meta del HTML (frontend y API en dominios distintos)', () => {
  const documento = {
    querySelector: (selector) =>
      selector.includes('redball-api') ? { content: ' https://api.ejemplo.com/api/ ' } : null
  };
  const ventana = { location: { protocol: 'https:', origin: 'https://juego.ejemplo.com' } };

  assert.equal(baseApi({ documento, ventana }), 'https://api.ejemplo.com/api');
});

test('baseApi usa el mismo origen cuando no hay meta', () => {
  const documento = { querySelector: () => ({ content: '   ' }) };
  const ventana = { location: { protocol: 'http:', origin: 'http://localhost:3000' } };

  assert.equal(baseApi({ documento, ventana }), 'http://localhost:3000/api');
});

test('baseApi no inventa servidor si el juego se abrió como archivo', () => {
  const ventana = { location: { protocol: 'file:', origin: 'null' } };
  assert.equal(baseApi({ ventana }), null);

  // Sin `window` ni `document` (Node, pruebas) tampoco hay API.
  assert.equal(baseApi({ documento: null, ventana: null }), null);
  // Un `document` sin querySelector (doble de pruebas) no puede romper nada.
  assert.equal(baseApi({ documento: {}, ventana: null }), null);
});

/* ── Identidad del jugador ───────────────────────────────────────────────── */

test('el id de jugador se genera una vez y se reutiliza', () => {
  const almacen = almacenFalso();

  const primero = idDeJugador({ almacen });
  assert.match(primero, /^jug-[a-z0-9]{8}$/);
  assert.equal(almacen.getItem(CLAVE_JUGADOR), primero);
  assert.equal(idDeJugador({ almacen }), primero, 'el id guardado se reutiliza tal cual');
});

test('un id guardado inválido se reemplaza por uno nuevo', () => {
  const almacen = almacenFalso({ inicial: { [CLAVE_JUGADOR]: 'no vale' } });

  const nuevo = idDeJugador({ almacen });
  assert.match(nuevo, /^jug-[a-z0-9]{8}$/);
  assert.equal(almacen.getItem(CLAVE_JUGADOR), nuevo);
});

test('con el almacén bloqueado el id sigue existiendo (solo dura la sesión)', () => {
  const primero = idDeJugador({ almacen: almacenRoto() });
  const segundo = idDeJugador({ almacen: almacenRoto() });

  assert.match(primero, /^jug-[a-z0-9]{8}$/);
  assert.notEqual(primero, segundo, 'sin almacén no se puede recordar el id');
});

test('generarIdJugador cumple el patrón que valida el backend', () => {
  for (const azar of [0, 0.5, 0.999999]) {
    const id = generarIdJugador(() => azar);
    assert.match(id, /^[A-Za-z0-9_-]{3,32}$/);
  }
});

/* ── Peticiones ──────────────────────────────────────────────────────────── */

/** `fetch` de mentira: apunta las llamadas y responde lo que se le diga. */
function fetchFalso(respuesta = { ok: true, datos: { ok: true } }) {
  const llamadas = [];
  const impl = async (url, opciones = {}) => {
    llamadas.push({ url, opciones });
    if (respuesta.lanza) throw respuesta.lanza;
    return {
      ok: respuesta.ok ?? true,
      status: respuesta.status ?? 200,
      json: async () => respuesta.datos
    };
  };
  return { impl, llamadas };
}

test('sin base no hay cliente: todo devuelve API_NO_DISPONIBLE y no se llama a fetch', async () => {
  const { impl, llamadas } = fetchFalso();
  const api = crearClienteApi({ base: null, fetchImpl: impl });

  assert.equal(api.disponible, false);
  assert.equal(api.base, null);

  for (const respuesta of [await api.records(), await api.salud(), await api.niveles()]) {
    assert.equal(respuesta.ok, false);
    assert.equal(respuesta.error.codigo, 'API_NO_DISPONIBLE');
  }
  assert.equal(llamadas.length, 0, 'sin servidor no se abre ni un socket');
});

test('records() construye la URL con nivel y límite', async () => {
  const { impl, llamadas } = fetchFalso({
    datos: { ok: true, nivel: 'nivel-2', total: 1, records: [{ posicion: 1, jugador: 'jug-abc', puntos: 10 }] }
  });
  const api = crearClienteApi({ base: 'http://localhost:3000/api/', fetchImpl: impl });

  const resultado = await api.records({ nivel: 'nivel-2', limite: 5 });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.total, 1);
  assert.equal(resultado.estado, 200);
  assert.equal(llamadas[0].url, 'http://localhost:3000/api/records?nivel=nivel-2&limite=5');
  assert.equal(llamadas[0].opciones.method, 'GET');
});

test('anotarPartida envía el cuerpo que valida el backend', async () => {
  const { impl, llamadas } = fetchFalso({ status: 201, datos: { ok: true, nuevo: true, posicion: 1 } });
  const api = crearClienteApi({ base: 'http://localhost:3000/api', fetchImpl: impl });

  const resultado = await api.anotarPartida({
    jugador: 'jug-abc',
    nombre: 'YO',
    partida: { nivel: 'nivel-1', puntos: 70, monedas: 7, totalMonedas: 9, completado: true }
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.posicion, 1);
  assert.equal(llamadas[0].opciones.method, 'POST');
  assert.equal(llamadas[0].opciones.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(llamadas[0].opciones.body), {
    jugador: 'jug-abc',
    nombre: 'YO',
    nivel: 'nivel-1',
    puntos: 70,
    monedas: 7,
    totalMonedas: 9,
    completado: true
  });
});

test('subirProgreso y perfil codifican el id en la ruta', async () => {
  const { impl, llamadas } = fetchFalso({ datos: { ok: true, perfil: { progreso: {} } } });
  const api = crearClienteApi({ base: 'http://localhost:3000/api', fetchImpl: impl });

  await api.perfil('jug-abc');
  await api.subirProgreso({ jugador: 'jug-abc', progreso: { niveles: {} } });

  assert.equal(llamadas[0].url, 'http://localhost:3000/api/perfiles/jug-abc');
  assert.equal(llamadas[1].url, 'http://localhost:3000/api/perfiles/jug-abc/progreso');
  assert.equal(llamadas[1].opciones.method, 'PUT');
});

test('un error del servidor se devuelve tal cual, sin lanzar', async () => {
  const { impl } = fetchFalso({
    ok: false,
    status: 400,
    datos: { ok: false, error: { codigo: 'DATOS_INCOHERENTES', mensaje: 'Monedas de más.' } }
  });
  const api = crearClienteApi({ base: 'http://localhost:3000/api', fetchImpl: impl });

  const resultado = await api.records();

  assert.equal(resultado.ok, false);
  assert.equal(resultado.estado, 400);
  assert.equal(resultado.error.codigo, 'DATOS_INCOHERENTES');
  assert.equal(resultado.error.mensaje, 'Monedas de más.');
});

test('una respuesta sin JSON válido no rompe el cliente', async () => {
  const apiSinJson = crearClienteApi({
    base: 'http://localhost:3000/api',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => null })
  });

  const resultado = await apiSinJson.records();
  assert.equal(resultado.ok, false);
  assert.equal(resultado.error.codigo, 'ERROR_HTTP');
});

test('si el servidor no contesta, el aviso es SIN_CONEXION', async () => {
  const { impl } = fetchFalso({ lanza: new TypeError('fetch failed') });
  const api = crearClienteApi({ base: 'http://localhost:3000/api', fetchImpl: impl });

  const resultado = await api.records();

  assert.equal(resultado.ok, false);
  assert.equal(resultado.error.codigo, 'SIN_CONEXION');
  assert.match(resultado.error.mensaje, /conectar/i);
});
