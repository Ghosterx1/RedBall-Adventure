/**
 * middleware/errores.js — cabeceras de seguridad, 404 de la API y traducción de
 * errores a JSON.
 *
 * Contrato de error (el mismo en TODOS los endpoints):
 *   { "ok": false, "error": { "codigo": "NIVEL_DESCONOCIDO", "mensaje": "…" } }
 *
 * El cliente puede mirar `codigo` (estable) para decidir qué hacer y `mensaje`
 * para enseñarlo tal cual.
 */

/** Cabeceras mínimas de seguridad (sin dependencias tipo helmet). */
export function cabecerasSeguridad() {
  return (req, res, siguiente) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    siguiente();
  };
}

/** 404 en JSON para cualquier ruta /api/* que no exista. */
export function noEncontradoApi(req, res) {
  res.status(404).json({
    ok: false,
    error: {
      codigo: 'NO_ENCONTRADO',
      mensaje: `No existe la ruta ${req.method} ${req.baseUrl}${req.path}.`
    }
  });
}

/**
 * Middleware final de errores. Debe registrarse el último y con cuatro
 * argumentos (así lo reconoce Express).
 */
export function manejarErrores(registro = console, { produccion = false } = {}) {
  return (error, req, res, siguiente) => {
    if (res.headersSent) {
      siguiente(error);
      return;
    }

    const estadoCrudo = error?.estado ?? error?.status ?? error?.statusCode;
    const estado = Number.isInteger(estadoCrudo) && estadoCrudo >= 400 && estadoCrudo <= 599 ? estadoCrudo : 500;

    const codigo = codigoDe(error, estado);
    if (estado >= 500) registro.error?.('[redball] error no controlado:', error);

    const mensaje =
      estado >= 500 && produccion
        ? 'Algo falló en el servidor. Vuelve a intentarlo en un momento.'
        : error?.message ?? 'Error desconocido.';

    res.status(estado).json({
      ok: false,
      error: {
        codigo,
        mensaje,
        ...(error?.detalles ? { detalles: error.detalles } : {})
      }
    });
  };
}

function codigoDe(error, estado) {
  if (typeof error?.codigo === 'string') return error.codigo;
  if (error?.type === 'entity.parse.failed') return 'JSON_INVALIDO';
  if (error?.type === 'entity.too.large' || estado === 413) return 'CUERPO_DEMASIADO_GRANDE';
  if (estado === 404) return 'NO_ENCONTRADO';
  return 'ERROR_INTERNO';
}
