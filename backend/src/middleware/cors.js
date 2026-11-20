/**
 * middleware/cors.js — CORS configurable sin dependencias.
 *
 * El caso normal es el "todo en uno": el mismo Express sirve el juego y la API,
 * así que el navegador no hace peticiones cruzadas y CORS no interviene. Se
 * configura para el caso "frontend en otro sitio" (GitHub Pages, Netlify…):
 *
 *   CORS_ORIGENES=https://tudominio.com,https://www.tudominio.com
 *   CORS_ORIGENES=*                → cualquiera (por defecto, cómodo en local)
 *
 * El preflight (`OPTIONS`) se contesta aquí mismo con 204.
 */
export function cors(origenes = ['*']) {
  const comodin = origenes.includes('*');
  const permitidos = new Set(origenes);

  return (req, res, siguiente) => {
    const origen = req.headers.origin;

    // `Vary: Origin` evita que una caché intermedia sirva a un origen la
    // respuesta calculada para otro.
    res.setHeader('Vary', 'Origin');

    if (origen && (comodin || permitidos.has(origen))) {
      res.setHeader('Access-Control-Allow-Origin', comodin ? '*' : origen);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    siguiente();
  };
}
