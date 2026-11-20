import { ErrorHttp, peticionInvalida } from './errores.js';
import { existeNivel, idsDeNiveles } from './dominio.js';

/**
 * validar.js — la frontera de entrada de la API.
 *
 * Todo lo que llega del cliente es texto y puede ser cualquier cosa: un número
 * negativo, un objeto donde va un string, un `NaN`, un array de 10 000 monedas.
 * Estas funciones convierten eso en datos seguros o lanzan un `ErrorHttp` 400
 * con un código estable, de modo que las rutas se quedan en dos líneas.
 */

export const MAXIMO_PUNTOS = 1_000_000;
export const MAXIMO_MONEDAS = 9999;
export const MAXIMO_NOMBRE = 16;

/** Id de jugador (3..32 caracteres: letras, números, guion, guion bajo). */
export function leerJugador(valor) {
  const id = typeof valor === 'string' ? valor.trim() : '';
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(id)) {
    throw peticionInvalida(
      'JUGADOR_INVALIDO',
      'El id de jugador debe tener entre 3 y 32 caracteres: letras, números, guion o guion bajo.',
      { recibido: typeof valor === 'string' ? id.slice(0, 40) : typeof valor }
    );
  }
  return id;
}

/** Nivel del catálogo real del juego. */
export function leerNivel(valor) {
  const id = typeof valor === 'string' ? valor.trim() : '';
  if (!existeNivel(id)) {
    throw peticionInvalida('NIVEL_DESCONOCIDO', `El nivel "${id}" no existe en el catálogo.`, {
      niveles: idsDeNiveles()
    });
  }
  return id;
}

/** Entero >= 0 (acepta `"12"` o `12`, rechaza `12.5`, `-1`, `"doce"`, `true`). */
export function leerEntero(valor, { campo, maximo = MAXIMO_PUNTOS, porDefecto = null } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (porDefecto !== null) return porDefecto;
    throw peticionInvalida('CAMPO_OBLIGATORIO', `Falta el campo "${campo}".`);
  }

  const numero = typeof valor === 'string' ? Number(valor.trim()) : valor;
  if (typeof numero !== 'number' || !Number.isInteger(numero) || numero < 0 || numero > maximo) {
    throw peticionInvalida(
      'CAMPO_INVALIDO',
      `"${campo}" debe ser un número entero entre 0 y ${maximo}.`,
      { campo, maximo }
    );
  }
  return numero;
}

/** Booleano estricto. */
export function leerBooleano(valor, { campo, porDefecto = false } = {}) {
  if (valor === undefined || valor === null) return porDefecto;
  if (typeof valor !== 'boolean') {
    throw peticionInvalida('CAMPO_INVALIDO', `"${campo}" debe ser true o false.`, { campo });
  }
  return valor;
}

/** Texto corto opcional (nombre visible). */
export function leerTexto(valor, { campo, maximo = MAXIMO_NOMBRE, porDefecto = '' } = {}) {
  if (valor === undefined || valor === null) return porDefecto;
  if (typeof valor !== 'string') {
    throw peticionInvalida('CAMPO_INVALIDO', `"${campo}" debe ser texto.`, { campo });
  }
  const limpio = valor.trim();
  if (limpio.length > maximo) {
    throw peticionInvalida('CAMPO_INVALIDO', `"${campo}" no puede pasar de ${maximo} caracteres.`, {
      campo,
      maximo
    });
  }
  return limpio;
}

/** Objeto obligatorio (el cuerpo tiene que ser un objeto JSON, no un array). */
export function leerObjeto(valor, campo) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    throw peticionInvalida('CAMPO_INVALIDO', `"${campo}" debe ser un objeto.`, { campo });
  }
  return valor;
}

/**
 * Cuerpo de `POST /api/records`.
 *
 * Comprobación de coherencia: no se pueden haber cogido más monedas que las que
 * tiene el nivel, ni declarar "completado" sin nivel válido. No es un
 * anti-cheat serio (un juego en el navegador no puede tenerlo), pero corta los
 * envíos absurdos.
 */
export function leerPartida(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    throw new ErrorHttp(400, 'CUERPO_INVALIDO', 'El cuerpo debe ser un objeto JSON.');
  }

  const nivel = leerNivel(cuerpo.nivel);
  const puntos = leerEntero(cuerpo.puntos, { campo: 'puntos' });
  const monedas = leerEntero(cuerpo.monedas, { campo: 'monedas', maximo: MAXIMO_MONEDAS, porDefecto: 0 });
  const totalMonedas = leerEntero(cuerpo.totalMonedas, {
    campo: 'totalMonedas',
    maximo: MAXIMO_MONEDAS,
    porDefecto: 0
  });
  const completado = leerBooleano(cuerpo.completado, { campo: 'completado' });

  if (monedas > totalMonedas) {
    throw peticionInvalida(
      'DATOS_INCOHERENTES',
      'No se pueden recoger más monedas que las que tiene el nivel.',
      { monedas, totalMonedas }
    );
  }

  return { nivel, puntos, monedas, totalMonedas, completado };
}
