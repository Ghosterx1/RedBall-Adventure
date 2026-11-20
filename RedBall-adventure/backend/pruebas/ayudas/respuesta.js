/**
 * ayudas/respuesta.js — dobles de `req`/`res` para probar los middlewares.
 *
 * Los middlewares del backend solo usan cuatro cosas de Express: leer cabeceras,
 * escribir cabeceras, fijar el estado y responder. Con estos objetos se prueban
 * sin levantar ningún servidor.
 */

/** `res` de mentira: apunta lo que se le pide y termina marcado. */
export function respuestaFalsa() {
  const res = {
    cabeceras: {},
    estado: 200,
    cuerpo: null,
    terminada: false,
    tipo: null,

    setHeader(nombre, valor) {
      res.cabeceras[String(nombre).toLowerCase()] = valor;
      return res;
    },
    status(codigo) {
      res.estado = codigo;
      return res;
    },
    type(valor) {
      res.tipo = valor;
      return res;
    },
    json(datos) {
      res.cuerpo = datos;
      res.terminada = true;
      return res;
    },
    send(texto) {
      res.cuerpo = texto;
      res.terminada = true;
      return res;
    },
    end() {
      res.terminada = true;
      return res;
    }
  };
  return res;
}

/** `req` de mentira, con lo justo que miran los middlewares. */
export function peticionFalsa({ metodo = 'GET', cabeceras = {}, ip = '10.0.0.1', ruta = '/api/x' } = {}) {
  return {
    method: metodo,
    headers: cabeceras,
    ip,
    path: ruta,
    baseUrl: '/api',
    socket: { remoteAddress: ip }
  };
}

/** `next` de mentira: recuerda si se llamó y con qué. */
export function siguienteFalso() {
  const llamadas = [];
  const siguiente = (error) => {
    llamadas.push(error);
  };
  siguiente.llamadas = llamadas;
  siguiente.llamado = () => llamadas.length > 0;
  return siguiente;
}
