import path from 'node:path';

import express from 'express';

import { leerConfig } from './config.js';
import { crearAlmacenJson } from './almacen/almacenJson.js';
import { crearApi } from './rutas/api.js';
import { cors } from './middleware/cors.js';
import { limitePeticiones } from './middleware/limite.js';
import { cabecerasSeguridad, manejarErrores, noEncontradoApi } from './middleware/errores.js';

/**
 * app.js — monta la aplicación Express (sin escuchar en ningún puerto).
 *
 * Se separa de `servidor.js` para que las pruebas puedan levantar la app en un
 * puerto efímero y cerrarla, y para poder inyectar un almacén en memoria.
 *
 * Orden de la cadena (importa):
 *   1. cabeceras de seguridad y CORS       → valen para todo
 *   2. JSON con límite de tamaño           → solo /api
 *   3. límite de peticiones + rutas /api   → contrato HTTP
 *   4. 404 JSON de /api                   → antes que los estáticos
 *   5. estáticos del juego (frontend/)     → index.html, Css/, src/…
 *   6. fallback del juego para rutas sin extensión
 *   7. 404 de texto, y por último el traductor de errores
 */
export function crearApp({ config = leerConfig(), almacen = null, registro = console } = {}) {
  const app = express();
  app.disable('x-powered-by');

  const almacenFinal =
    almacen ?? crearAlmacenJson({ carpeta: config.carpetaDatos, archivo: config.archivoDatos, registro });

  // Accesibles desde las pruebas y desde cualquier ruta (`req.app.locals`).
  app.locals.config = config;
  app.locals.almacen = almacenFinal;

  app.use(cabecerasSeguridad());
  app.use(cors(config.origenes));

  app.use(
    '/api',
    express.json({ limit: config.limiteCuerpo }),
    limitePeticiones({ maximo: config.limitePeticiones }),
    crearApi({ config, almacen: almacenFinal })
  );
  app.use('/api', noEncontradoApi);

  app.use(
    express.static(config.carpetaFrontend, {
      index: ['index.html'],
      etag: true,
      lastModified: true,
      // En producción los estáticos se cachean 1 h; en local, siempre frescos.
      maxAge: config.produccion ? '1h' : 0
    })
  );

  /**
   * Atajos del juego: cualquier GET sin extensión (por ejemplo `/nivel-2`)
   * devuelve el index.html y `main.js` decide qué nivel cargar con la URL.
   * Los recursos reales (`/Css/x.css`, `/src/main.js`) ya se han servido arriba;
   * si no existen, esto NO los tapa: llevan extensión y caen al 404.
   */
  app.get(/^\/(?!api(\/|$)).*$/, (req, res, siguiente) => {
    if (path.extname(req.path)) {
      siguiente();
      return;
    }
    res.sendFile(path.join(config.carpetaFrontend, 'index.html'), (error) => {
      if (error) siguiente();
    });
  });

  app.use((req, res) => {
    res.status(404).type('text/plain; charset=utf-8').send(`No encontrado: ${req.path}`);
  });

  app.use(manejarErrores(registro, { produccion: config.produccion }));

  return app;
}
