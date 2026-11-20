/**
 * middleware/limite.js — freno sencillo contra el spam de escrituras.
 *
 * Un `Map` en memoria con ventana deslizante por minuto e IP. No pretende ser un
 * rate-limit de producción (para eso están los proxies/CDN), sino evitar que un
 * bucle en el cliente llene el JSON de basura.
 *
 * `LIMITE_PETICIONES=0` lo desactiva. Las cabeceras `RateLimit-*` son las que
 * entiende cualquier cliente HTTP para saber cuánto margen le queda.
 */
export function limitePeticiones({ maximo = 60, ventana = 60_000, ahora = () => Date.now() } = {}) {
  if (!(maximo > 0)) {
    return (req, res, siguiente) => siguiente();
  }

  /** ip → { inicio, cuenta } */
  const visitas = new Map();

  return (req, res, siguiente) => {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'anonimo';
    const momento = ahora();

    let visita = visitas.get(ip);
    if (!visita || momento - visita.inicio >= ventana) {
      visita = { inicio: momento, cuenta: 0 };
      visitas.set(ip, visita);
    }

    visita.cuenta += 1;
    const restantes = Math.max(0, maximo - visita.cuenta);
    res.setHeader('RateLimit-Limit', String(maximo));
    res.setHeader('RateLimit-Remaining', String(restantes));

    if (visita.cuenta > maximo) {
      const espera = Math.max(1, Math.ceil((visita.inicio + ventana - momento) / 1000));
      res.setHeader('Retry-After', String(espera));
      res.status(429).json({
        ok: false,
        error: {
          codigo: 'DEMASIADAS_PETICIONES',
          mensaje: `Demasiadas peticiones: espera ${espera} s antes de volver a intentarlo.`
        }
      });
      return;
    }

    // Poda de memoria: si pasan muchos visitantes distintos, se limpia lo viejo.
    if (visitas.size > 5000) {
      for (const [clave, dato] of visitas) {
        if (momento - dato.inicio >= ventana) visitas.delete(clave);
      }
    }

    siguiente();
  };
}
