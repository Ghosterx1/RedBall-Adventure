import { ACCIONES } from '../../src/nucleo/Entrada.js';
import { PASO_FIJO } from '../../src/config/ajustes.js';
import { EscenaMundo } from '../../src/escenas/EscenaMundo.js';

/**
 * bot.js — jugador automático para comprobar que un nivel SE PUEDE TERMINAR.
 *
 * Escribe niveles es fácil; lo difícil es que sean jugables. Este doble de
 * jugador corre el nivel de verdad (misma escena, misma física, mismos datos)
 * con una estrategia mínima: siempre hacia la derecha y saltar cuando hay algo
 * delante (hueco, muro, peligro). Si el bot llega al objetivo, un humano puede.
 *
 * No es un test: es una AYUDA (no lleva `.test.js`). La prueba que lo usa está en
 * `pruebas/niveles-jugables.test.js`.
 *
 * LÍMITE CONOCIDO: el bot no busca monedas a propósito. Si un nivel exige más
 * monedas de las que caen en el camino, el bot no lo completará aunque sea
 * jugable. Por eso los niveles ponen las monedas obligatorias en la ruta.
 */

const MIRA_PELIGRO = 26; // px por delante que se miran para peligros y bordes
const MIRA_MURO = 52; // px por delante para muros (hay que saltar antes)
const MIRA_MONEDA = 72; // px por delante para ver una moneda en alto
const MANTENER = 10; // pasos sujetando el salto (salto variable)
const ATRASO_MAXIMO = 30; // pasos con vx≈0 antes de saltar "por si acaso"

/** ¿Se tocan dos cajas? (borde exacto no cuenta, igual que en el motor) */
function solapan(a, b) {
  return (
    a.x < b.x + b.ancho &&
    a.x + a.ancho > b.x &&
    a.y < b.y + b.alto &&
    a.y + a.alto > b.y
  );
}

/**
 * Juega el nivel completo con el bot.
 * @returns {{ completo: boolean, monedas: number, reinicios: number, x: number,
 *             pasos: number, escena: EscenaMundo }}
 */
export function jugarNivel(datos, { maxSegundos = 90, niveles = [], onPaso = null } = {}) {
  const bot = { eje: 1, saltoNuevo: false, mantener: 0, quieto: 0 };
  const juego = juegoFalso({ bot });
  const escena = new EscenaMundo({ nivel: datos, niveles }).entrar(juego);

  const pasos = Math.round(maxSegundos / PASO_FIJO);
  /** Dónde ha muerto el bot (x de cada reinicio): sirve para depurar niveles. */
  const muertes = [];
  let reiniciosPrevios = escena.reinicios;
  let xUltimo = escena.jugador.x;

  for (let i = 0; i < pasos && !escena.completo; i++) {
    decidir(escena, bot);
    escena.actualizar(PASO_FIJO, juego);
    bot.mantener = Math.max(0, bot.mantener - 1);
    if (escena.reinicios !== reiniciosPrevios) {
      reiniciosPrevios = escena.reinicios;
      muertes.push({ x: Math.round(xUltimo), paso: i });
    }
    xUltimo = escena.jugador.x;
    if (onPaso) onPaso(i, escena, bot);
  }

  return {
    completo: escena.completo,
    monedas: escena.marcador.monedas,
    totalMonedas: escena.marcador.totalMonedas,
    reinicios: escena.reinicios,
    muertes,
    x: Math.round(escena.jugador.x),
    pasos,
    escena
  };
}

/** Entrada falsa que lee las órdenes del bot (misma interfaz que Entrada). */
function juegoFalso({ bot = { eje: 1, saltoNuevo: false, mantener: 0 } } = {}) {
  return {
    almacen: undefined,
    sonido: null,
    entrada: {
      ejeHorizontal: () => bot.eje,
      recienPresionada: (accion) => accion === ACCIONES.SALTO && bot.saltoNuevo,
      estaPresionada: (accion) => accion === ACCIONES.SALTO && bot.mantener > 0
    }
  };
}

/** Una decisión por paso: ¿hacia dónde y salto o no? */
function decidir(escena, bot) {
  const j = escena.jugador;
  const mundo = escena.mundo;
  bot.eje = 1; // el bot solo va hacia delante
  bot.saltoNuevo = false;

  const cuerpo = j.caja;
  const pies = cuerpo.y + cuerpo.alto;
  const borde = cuerpo.x + cuerpo.ancho;
  const caja = (x, y, ancho, alto) => ({ x, y, ancho, alto });

  // Lo que hay delante: peligro y borde del suelo se miran de cerca (26 px) y
  // los muros de lejos (52 px): hay que saltar ANTES para pasar por encima.
  const delantePeligro = caja(borde, cuerpo.y, MIRA_PELIGRO, cuerpo.alto);
  const delanteMuro = caja(borde, cuerpo.y, MIRA_MURO, cuerpo.alto);
  const sueloDelante = caja(borde + 2, pies + 1, MIRA_PELIGRO, 4);

  const peligroDelante = mundo.peligros.some((objeto) => solapan(delantePeligro, objeto));
  // Un muro es un sólido que sobresale del suelo que pisamos (el propio suelo,
  // en cambio, empieza justo en los pies: no hay que saltarlo).
  const muroDelante = mundo.solidos.some(
    (solido) => solido.y < pies - 4 && solapan(delanteMuro, solido)
  );
  const haySuelo = mundo.solidos.some((solido) => solapan(sueloDelante, solido));
  const hayRampa = mundo.superficies.some(
    (superficie) =>
      superficie.alturaEn(sueloDelante.x) !== null ||
      superficie.alturaEn(sueloDelante.x + sueloDelante.ancho) !== null
  );
  const huecoDelante = !haySuelo && !hayRampa;

  // Moneda a la vista por encima: el bot salta a por ella (así las monedas de
  // la ruta principal sí se recogen; no hace desvíos). Solo cuenta si está
  // claramente por encima de los pies: una moneda a ras de suelo se coge andando.
  const monedaEncima = mundo.coleccionables.some(
    (objeto) =>
      objeto.x > borde &&
      objeto.x < borde + MIRA_MONEDA &&
      objeto.y + objeto.alto < pies - 8 &&
      objeto.y > pies - 110
  );

  // Atasco: empujando contra algo que no se mueve.
  bot.quieto = Math.abs(j.vx) < 8 ? bot.quieto + 1 : 0;

  const quiereSaltar =
    peligroDelante ||
    muroDelante ||
    huecoDelante ||
    (monedaEncima && j.enSuelo) ||
    bot.quieto >= ATRASO_MAXIMO;

  // Solo se salta desde el suelo: en el aire no sirve de nada y gastaría el salto.
  if (quiereSaltar && j.enSuelo) {
    bot.saltoNuevo = true;
    bot.mantener = MANTENER; // sujetar el botón = salto alto (salto variable)
    bot.quieto = 0;
  }
}
