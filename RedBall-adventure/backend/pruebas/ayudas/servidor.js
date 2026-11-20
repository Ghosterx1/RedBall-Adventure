import { crearApp } from '../../src/app.js';
import { leerConfig } from '../../src/config.js';
import { arrancarServidor, cerrarServidor } from '../../src/servidor.js';
import { crearAlmacenMemoria } from '../../src/almacen/almacenMemoria.js';

/**
 * ayudas/servidor.js — levanta la API de verdad, pero en memoria.
 *
 * Las pruebas del backend no usan un cliente HTTP simulado: arrancan `app.js`
 * en un puerto libre (`PORT=0`), le hablan por HTTP como lo haría el navegador y
 * lo cierran al terminar. La única pieza sustituida es el almacén (RAM en vez de
 * disco) y el registro (para no llenar la salida de `console`).
 */

/** Registro que no escribe nada (la API avisa por `console` cuando algo falla). */
export const registroSilencioso = { log() {}, warn() {}, error() {} };

/**
 * Arranca la API en un puerto libre.
 * @returns {Promise<{base:string, almacen:object, app:object, config:object, cerrar:() => Promise<void>}>}
 */
export async function levantarApi({ almacen = crearAlmacenMemoria(), env = {} } = {}) {
  // Sin límite de peticiones: las pruebas hacen muchas y no es lo que se mide.
  const config = leerConfig({ PORT: '0', HOST: '127.0.0.1', LIMITE_PETICIONES: '0', ...env });
  const app = crearApp({ config, almacen, registro: registroSilencioso });

  // `arrancarServidor` saluda por consola; en las pruebas estorba.
  const consola = console.log;
  console.log = () => {};
  let servidor;
  try {
    servidor = await arrancarServidor({ config, app });
  } finally {
    console.log = consola;
  }

  const { port } = servidor.address();
  return {
    base: `http://127.0.0.1:${port}`,
    almacen,
    app,
    config,
    puerto: port,
    cerrar: () => cerrarServidor(servidor)
  };
}

/** Petición HTTP con la respuesta ya leída (JSON si el servidor manda JSON). */
export async function pedir(base, ruta, opciones = {}) {
  const respuesta = await fetch(`${base}${ruta}`, opciones);
  const tipo = respuesta.headers.get('content-type') ?? '';
  const cuerpo = tipo.includes('json') ? await respuesta.json() : await respuesta.text();
  return { estado: respuesta.status, cabeceras: respuesta.headers, cuerpo };
}

/** Opciones de `fetch` para mandar un cuerpo JSON. */
export function conCuerpoJson(metodo, datos) {
  return {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  };
}
