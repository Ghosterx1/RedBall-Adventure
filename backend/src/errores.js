/**
 * errores.js — el único tipo de error que conoce la API.
 *
 * Cualquier fallo "esperable" (un id mal escrito, un nivel que no existe, un
 * campo que falta) se lanza como `ErrorHttp` con su estado y su código. El
 * middleware de errores lo traduce a JSON; el resto de fallos son 500 y se
 * registran en el log. Así las rutas no repiten `res.status(400).json(...)`.
 */
export class ErrorHttp extends Error {
  /**
   * @param {number} estado  código HTTP (400, 404, 413…)
   * @param {string} codigo  código estable para el cliente (`NIVEL_DESCONOCIDO`)
   * @param {string} mensaje texto legible en español
   * @param {object|null} [detalles] datos extra para depurar
   */
  constructor(estado, codigo, mensaje, detalles = null) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

/** 400: la petición no cumple el contrato. */
export function peticionInvalida(codigo, mensaje, detalles = null) {
  return new ErrorHttp(400, codigo, mensaje, detalles);
}

/** 404: el recurso no existe. */
export function noEncontrado(mensaje, detalles = null) {
  return new ErrorHttp(404, 'NO_ENCONTRADO', mensaje, detalles);
}
