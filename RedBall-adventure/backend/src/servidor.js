import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { crearApp } from './app.js';
import { leerConfig } from './config.js';

/**
 * servidor.js — punto de entrada: arranca Express y apaga ordenadamente.
 *
 * `arrancarServidor()` se exporta para que las pruebas levanten el servidor de
 * verdad en un puerto libre (`puerto: 0`) y lo cierren al terminar. El arranque
 * automático solo ocurre si este archivo se ejecuta directamente
 * (`node backend/src/servidor.js`), nunca al importarlo.
 */
export function arrancarServidor({ config = leerConfig(), app = crearApp({ config }) } = {}) {
  return new Promise((resolver, rechazar) => {
    const servidor = app.listen(config.puerto, config.host);

    servidor.once('listening', () => {
      const direccion = servidor.address();
      const puerto = typeof direccion === 'object' && direccion ? direccion.port : config.puerto;
      const visible = config.host === '0.0.0.0' ? 'localhost' : config.host;
      console.log(`[redball] juego en  http://${visible}:${puerto}/`);
      console.log(`[redball] API en    http://${visible}:${puerto}/api/salud`);
      console.log(`[redball] datos en  ${app.locals.almacen?.ruta ?? config.carpetaDatos}`);
      resolver(servidor);
    });

    servidor.once('error', rechazar);
  });
}

/** Cierra el servidor y devuelve una promesa (para SIGINT/SIGTERM y pruebas). */
export function cerrarServidor(servidor) {
  return new Promise((resolver) => {
    if (!servidor) {
      resolver();
      return;
    }
    servidor.close(() => resolver());
  });
}

const ejecutadoDirectamente =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (ejecutadoDirectamente) {
  arrancarServidor()
    .then((servidor) => {
      // Docker manda SIGTERM; Ctrl+C manda SIGINT. En los dos casos se deja de
      // aceptar conexiones y el proceso termina limpio.
      const apagar = (senal) => {
        console.log(`[redball] ${senal}: cerrando…`);
        cerrarServidor(servidor).then(() => process.exit(0));
      };
      process.once('SIGINT', () => apagar('SIGINT'));
      process.once('SIGTERM', () => apagar('SIGTERM'));
    })
    .catch((error) => {
      if (error?.code === 'EADDRINUSE') {
        console.error(`[redball] el puerto ya está ocupado. Prueba con otro: PORT=3001 npm start`);
      } else {
        console.error('[redball] no se pudo arrancar el servidor:', error);
      }
      process.exit(1);
    });
}
