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

/* ── Récords globales (vienen del backend) ───────────────────────────────── */

/**
 * Filas listas para pintar la tabla de récords.
 *
 * Los datos llegan de `GET /api/records` (ver `docs/BACKEND.md`) y NO se
 * recalculan aquí: el servidor ya ordenó y ya decidió quién entra. Este modelo
 * solo normaliza la forma para que la capa DOM no tenga que pensar, y marca la
 * fila del jugador actual para poder resaltarla.
 *
 * @param {object[]} registros filas del servidor (`posicion`, `nombre`, `puntos`…)
 * @param {object}   [opciones]
 * @param {string|null} [opciones.jugador] id local, para resaltar la propia fila
 * @returns {object[]} filas listas para `Interfaz.pintarRecords()`
 */
export function filasDeRanking(registros = [], { jugador = null } = {}) {
  const lista = Array.isArray(registros) ? registros : [];
  return lista.map((registro, indice) => ({
    posicion: Number.isFinite(registro?.posicion) ? registro.posicion : indice + 1,
    nombre: registro?.nombre ?? registro?.jugador ?? 'JUGADOR',
    puntos: entero(registro?.puntos, 0),
    detalle: detalleDeRegistro(registro),
    propio: jugador !== null && registro?.jugador === jugador
  }));
}

/** Línea de apoyo de una fila: niveles superados o monedas del nivel. */
function detalleDeRegistro(registro) {
  if (Number.isFinite(registro?.completados) && Number.isFinite(registro?.total)) {
    return `NIVELES ${registro.completados}/${registro.total}`;
  }
  if (Number.isFinite(registro?.monedas) && Number.isFinite(registro?.totalMonedas)) {
    return `MONEDAS ${registro.monedas}/${registro.totalMonedas}`;
  }
  return '';
}

/**
 * Texto de estado de la pantalla de récords (cargando, vacío, sin conexión…).
 * Se escribe tal cual en el HTML: mayúsculas y sin acentos raros porque la
 * fuente del juego es pixel.
 */
export function textoEstadoRecords({ cargando = false, error = null, total = 0, nivel = null } = {}) {
  if (cargando) return 'CARGANDO RÉCORDS...';
  if (error) return `SIN RÉCORDS: ${String(error).toUpperCase()}`;
  if (!Number.isFinite(total) || total <= 0) {
    return nivel ? 'NADIE HA JUGADO ESTE NIVEL TODAVÍA' : 'TODAVÍA NO HAY RÉCORDS: SÉ EL PRIMERO';
  }
  return nivel ? `MEJORES EN ${String(nivel).toUpperCase()}` : 'MEJORES JUGADORES';
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
