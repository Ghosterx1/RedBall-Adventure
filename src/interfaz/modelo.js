import { JUEGO, NIVEL } from '../config/ajustes.js';
import { estaCompletado, nivelesCompletados, nivelesDesbloqueados } from '../nucleo/Progresion.js';
import { registroDe } from '../nucleo/Progreso.js';
import { idDeNivel } from '../mundo/niveles/index.js';

/**
 * modelo.js — lo que se PINTA en la interfaz, calculado sin DOM.
 *
 * La capa DOM (`Interfaz.js`) no decide nada: recibe estos objetos ya cocinados
 * y los escribe en el HTML. Así las reglas de "qué nivel está bloqueado", "qué
 * dice el resumen de la partida" o "cuántas monedas tiene el nivel" se prueban
 * con `node --test`, sin navegador y sin tocar el almacén de verdad.
 *
 * Nada de aquí muta el progreso ni el récord: son funciones puras de
 * (progreso guardado, catálogo de niveles) → datos de vista.
 */

/**
 * Una tarjeta por nivel, en orden de juego, para la pantalla de selección.
 *
 * El desbloqueo NO se guarda: se deduce del récord (`Progresion.js`), y las
 * monedas del nivel se cuentan de su propia data (`objetos`), así la tarjeta
 * puede enseñar "3/21" incluso antes de haberlo jugado.
 *
 * @param {object}   progreso récord guardado (ver nucleo/Progreso.js)
 * @param {object[]} niveles  catálogo en orden de juego
 * @returns {object[]} tarjetas listas para pintar
 */
export function tarjetasDeNiveles(progreso, niveles = []) {
  const ids = niveles.map((nivel, indice) => idDeNivel(nivel, indice));
  const desbloqueados = new Set(nivelesDesbloqueados(progreso, ids));

  return niveles.map((nivel, indice) => {
    const id = ids[indice];
    const registro = registroDe(progreso, id);
    const monedasDelNivel = contarMonedas(nivel);
    return {
      id,
      numero: indice + 1,
      total: niveles.length,
      nombre: nivel?.nombre ?? id,
      dificultad: limitar(entero(nivel?.dificultad, NIVEL.DIFICULTAD_MINIMA), 0, NIVEL.DIFICULTAD_MAXIMA),
      dificultadMaxima: NIVEL.DIFICULTAD_MAXIMA,
      /** true → se pinta con candado y no se puede pulsar */
      bloqueado: !desbloqueados.has(id),
      completado: estaCompletado(progreso, id),
      /** Récord: monedas y puntos de la mejor partida, más el total del nivel */
      monedas: registro.monedas,
      totalMonedas: Math.max(registro.totalMonedas, monedasDelNivel),
      puntos: registro.puntos,
      partidas: registro.partidas
    };
  });
}

/** Resumen de la campaña para la cabecera de la selección de niveles. */
export function resumenJuego(progreso, niveles = []) {
  const total = niveles.length;
  const completados = nivelesCompletados(progreso, niveles.map((nivel, i) => idDeNivel(nivel, i)));
  const fraccion = total > 0 ? completados / total : 0;
  return {
    completados,
    total,
    /** 0..1, para la barra de progreso */
    avance: fraccion,
    /** 0..100 entero, para el atributo aria-valuenow */
    porcentaje: Math.round(fraccion * 100),
    todosCompletados: total > 0 && completados === total
  };
}

/**
 * Línea de estado de una partida (pausa, victoria, derrota).
 * Se escribe tal cual en el HTML: sin iconos raros, que la fuente es pixel.
 */
export function resumenPartida(datos) {
  if (!datos) return '';
  const partes = [
    `NIVEL ${datos.numero ?? 1}/${datos.total ?? 1}`,
    `MONEDAS ${datos.monedas ?? 0}/${datos.totalMonedas ?? 0}`,
    `PUNTOS ${datos.puntos ?? 0}`
  ];
  if (Number.isFinite(datos.vidas)) partes.push(`VIDAS ${datos.vidas}`);
  if (datos.completo) partes.push('NIVEL COMPLETADO');
  return partes.join(' · ');
}

/** Cuántas monedas tiene un nivel, según su propia data. */
export function contarMonedas(nivel) {
  const objetos = Array.isArray(nivel?.objetos) ? nivel.objetos : [];
  return objetos.filter((objeto) => objeto?.tipo === 'moneda').length;
}

/** Precio en puntos de las monedas de un nivel (la tarjeta lo puede enseñar). */
export function puntosPotenciales(nivel) {
  return contarMonedas(nivel) * JUEGO.VALOR_MONEDA;
}

function entero(valor, porDefecto) {
  return Number.isFinite(valor) ? Math.floor(valor) : porDefecto;
}

function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}
