import { NIVEL } from '../config/ajustes.js';
import { crearObjeto, hayTipo } from './tipos.js';
import {
  OBJETIVOS_VALIDOS,
  TIPOS_OBJETIVO,
  esObjetivoValido,
  normalizarObjetivo
} from './objetivo.js';

/**
 * validar.js — ¿está bien escrito un nivel?
 *
 * Un nivel es DATA, y la data se equivoca: un `tipo` con una letra cambiada, una
 * moneda medio pixel fuera del escenario, un objetivo de meta en un nivel sin
 * meta… Antes, esos fallos solo se veían al jugar (o rompían el juego). Este
 * módulo los convierte en una LISTA de errores y avisos, así que:
 *
 *   - `npm test` valida el catálogo entero (pruebas/catalogo-niveles.test.js),
 *   - quien escribe un nivel puede comprobarlo antes de jugarlo,
 *   - los avisos señalan cosas que funcionan pero huelen mal (peligros flotantes,
 *     nivel sin checkpoint, meta en el aire…).
 *
 * Distinción importante:
 *   ERROR → el nivel no se puede jugar tal cual (el motor fallaría o el objetivo
 *           es imposible).
 *   AVISO → se juega, pero probablemente sea un despiste de diseño.
 *
 * No conoce la escena ni el jugador: solo datos y el catálogo de tipos.
 */

/** Códigos de error estables (los tests y las herramientas se apoyan en ellos). */
export const ERRORES = Object.freeze({
  SIN_DATOS: 'sin-datos',
  SIN_ID: 'sin-id',
  CATALOGO_VACIO: 'catalogo-vacio',
  ID_DUPLICADO: 'id-duplicado',
  DIMENSIONES: 'dimensiones',
  INICIO: 'inicio',
  SIN_OBJETOS: 'sin-objetos',
  OBJETO: 'objeto',
  TIPO_DESCONOCIDO: 'tipo-desconocido',
  CAJA: 'caja',
  FUERA_DEL_NIVEL: 'fuera-del-nivel',
  OBJETIVO: 'objetivo',
  SIN_META: 'sin-meta',
  SIN_MONEDAS: 'sin-monedas',
  MONEDAS_IMPOSIBLES: 'monedas-imposibles',
  DIFICULTAD: 'dificultad',
  ORDEN: 'orden'
});

/** Códigos de aviso estables. */
export const AVISOS = Object.freeze({
  SIN_NOMBRE: 'sin-nombre',
  SIN_DIFICULTAD: 'sin-dificultad',
  NIVEL_PEQUENO: 'nivel-pequeno',
  SIN_CHECKPOINT: 'sin-checkpoint',
  SIN_SUELO_INICIO: 'sin-suelo-inicio',
  PELIGRO_FLOTANTE: 'peligro-flotante',
  META_SIN_APOYO: 'meta-sin-apoyo',
  MULTIPLES_METAS: 'multiples-metas'
});

/** Tipos que sirven de apoyo (el resto se atraviesa o no se pisa). */
const TIPOS_APOYO = new Set([
  'plataforma',
  'plataformaElevada',
  'rampa',
  'elastica',
  'movil',
  'efimera',
  'obstaculo',
  'obstaculoMovil'
]);

/**
 * Valida los datos de UN nivel.
 * Devuelve `{ id, valido, errores, avisos }`; nunca lanza.
 */
export function validarNivel(datos) {
  const errores = [];
  const avisos = [];
  const anota = (lista, codigo, mensaje, extra = {}) => lista.push({ codigo, mensaje, ...extra });

  if (!datos || typeof datos !== 'object') {
    anota(errores, ERRORES.SIN_DATOS, 'el nivel no es un objeto de datos');
    return { id: null, valido: false, errores, avisos };
  }

  const id = typeof datos.id === 'string' && datos.id.length > 0 ? datos.id : null;
  if (!id) anota(errores, ERRORES.SIN_ID, 'el nivel necesita un `id` de texto (identifica su récord)');
  if (!datos.nombre) avisos.push({ codigo: AVISOS.SIN_NOMBRE, mensaje: 'sin `nombre`: el HUD mostrará el id' });

  // ── Dimensiones ──────────────────────────────────────────────────────────
  const ancho = datos.ancho;
  const alto = datos.alto;
  const dimensionesOk = Number.isFinite(ancho) && Number.isFinite(alto) && ancho > 0 && alto > 0;
  if (!dimensionesOk) {
    anota(errores, ERRORES.DIMENSIONES, '`ancho` y `alto` deben ser números mayores que 0');
  } else if (ancho < NIVEL.ANCHO_MINIMO || alto < NIVEL.ALTO_MINIMO) {
    avisos.push({
      codigo: AVISOS.NIVEL_PEQUENO,
      mensaje: `escenario de ${ancho}×${alto}: el mínimo razonable es ${NIVEL.ANCHO_MINIMO}×${NIVEL.ALTO_MINIMO}`
    });
  }

  // ── Punto de inicio ──────────────────────────────────────────────────────
  const inicio = datos.inicio;
  const inicioOk =
    inicio &&
    typeof inicio === 'object' &&
    Number.isFinite(inicio.x) &&
    Number.isFinite(inicio.y) &&
    inicio.x >= 0 &&
    inicio.y >= 0 &&
    (!dimensionesOk || (inicio.x <= ancho && inicio.y <= alto));
  if (!inicioOk) {
    anota(errores, ERRORES.INICIO, '`inicio` debe ser { x, y } (pies del jugador) dentro del escenario');
  }

  // ── Dificultad y orden ───────────────────────────────────────────────────
  if (datos.dificultad === undefined) {
    avisos.push({
      codigo: AVISOS.SIN_DIFICULTAD,
      mensaje: `sin \`dificultad\` (${NIVEL.DIFICULTAD_MINIMA}..${NIVEL.DIFICULTAD_MAXIMA})`
    });
  } else if (
    !Number.isInteger(datos.dificultad) ||
    datos.dificultad < NIVEL.DIFICULTAD_MINIMA ||
    datos.dificultad > NIVEL.DIFICULTAD_MAXIMA
  ) {
    anota(
      errores,
      ERRORES.DIFICULTAD,
      `\`dificultad\` debe ser un entero entre ${NIVEL.DIFICULTAD_MINIMA} y ${NIVEL.DIFICULTAD_MAXIMA}`
    );
  }
  if (datos.orden !== undefined && !(Number.isFinite(datos.orden) && datos.orden >= 0)) {
    anota(errores, ERRORES.ORDEN, '`orden` debe ser un número mayor o igual que 0');
  }

  // ── Objetos ──────────────────────────────────────────────────────────────
  const objetos = datos.objetos;
  if (!Array.isArray(objetos)) {
    anota(errores, ERRORES.SIN_OBJETOS, '`objetos` debe ser un array (aunque esté vacío)');
    return { id, valido: false, errores, avisos };
  }

  /** Cajas válidas: solo con ellas se hacen las comprobaciones de apoyo. */
  const cajas = [];

  objetos.forEach((objeto, indice) => {
    if (!objeto || typeof objeto !== 'object') {
      anota(errores, ERRORES.OBJETO, `objetos[${indice}] no es un objeto`, { indice });
      return;
    }
    const tipo = objeto.tipo;
    if (typeof tipo !== 'string' || !hayTipo(tipo)) {
      anota(
        errores,
        ERRORES.TIPO_DESCONOCIDO,
        `objetos[${indice}]: tipo de objeto desconocido "${tipo}" (¿está en src/mundo/tipos/?)`,
        { indice, tipo: typeof tipo === 'string' ? tipo : null }
      );
      return;
    }

    // Se construye el objeto REAL con los datos: así se comprueban también los
    // tamaños por defecto de cada tipo (una moneda sin `ancho` mide lo que diga
    // el motor, no cero) y que el motor no revienta al fabricarlo.
    let entidad = null;
    try {
      entidad = crearObjeto(objeto);
    } catch (error) {
      anota(
        errores,
        ERRORES.OBJETO,
        `objetos[${indice}] (${tipo}): el motor no puede construirlo (${error.message})`,
        { indice, tipo }
      );
      return;
    }

    const caja = { tipo, x: entidad.x, y: entidad.y, ancho: entidad.ancho, alto: entidad.alto };
    const valores = [caja.x, caja.y, caja.ancho, caja.alto];
    if (!valores.every((valor) => Number.isFinite(valor)) || caja.ancho <= 0 || caja.alto <= 0) {
      anota(
        errores,
        ERRORES.CAJA,
        `objetos[${indice}] (${tipo}): \`x\`, \`y\`, \`ancho\` y \`alto\` deben ser números (ancho/alto > 0)`,
        { indice, tipo }
      );
      return;
    }

    if (
      dimensionesOk &&
      (caja.x < -NIVEL.MARGEN ||
        caja.y < -NIVEL.MARGEN ||
        caja.x + caja.ancho > ancho + NIVEL.MARGEN ||
        caja.y + caja.alto > alto + NIVEL.MARGEN)
    ) {
      anota(
        errores,
        ERRORES.FUERA_DEL_NIVEL,
        `objetos[${indice}] (${tipo}) se sale del escenario ${ancho}×${alto}`,
        { indice, tipo }
      );
    }

    cajas.push(caja);
  });


  const apoyos = cajas.filter((caja) => TIPOS_APOYO.has(caja.tipo));
  const monedas = cajas.filter((caja) => caja.tipo === 'moneda');
  const metas = cajas.filter((caja) => caja.tipo === 'meta');
  const peligros = cajas.filter(
    (caja) => caja.tipo === 'peligro' || caja.tipo === 'obstaculoMovil'
  );

  // ── Objetivo ─────────────────────────────────────────────────────────────
  if (datos.objetivo !== undefined && !esObjetivoValido(datos.objetivo)) {
    anota(errores, ERRORES.OBJETIVO, `\`objetivo\` desconocido: usa ${OBJETIVOS_VALIDOS.join(' | ')}`);
  }
  const objetivo = normalizarObjetivo(datos.objetivo);

  if (objetivo.tipo === TIPOS_OBJETIVO.META) {
    if (metas.length === 0) {
      anota(
        errores,
        ERRORES.SIN_META,
        'el objetivo es "meta" pero el nivel no tiene ningún objeto "meta"'
      );
    }
    if (objetivo.monedas > monedas.length) {
      anota(
        errores,
        ERRORES.MONEDAS_IMPOSIBLES,
        `el objetivo pide ${objetivo.monedas} monedas y el nivel solo tiene ${monedas.length}`
      );
    }
  } else if (monedas.length === 0) {
    anota(errores, ERRORES.SIN_MONEDAS, 'el objetivo es "monedas" pero el nivel no tiene ninguna moneda');
  }

  // ── Avisos de diseño ─────────────────────────────────────────────────────
  if (metas.length > 1) {
    avisos.push({
      codigo: AVISOS.MULTIPLES_METAS,
      mensaje: `hay ${metas.length} metas: cualquiera de ellas supera el nivel`
    });
  }

  if (peligros.length > 0 && !cajas.some((caja) => caja.tipo === 'checkpoint')) {
    avisos.push({
      codigo: AVISOS.SIN_CHECKPOINT,
      mensaje: 'el nivel tiene peligros y ningún checkpoint: cada fallo vuelve al principio'
    });
  }

  if (inicioOk && apoyos.length > 0) {
    const pies = { x: inicio.x - 12, y: inicio.y - 2, ancho: 24, alto: 2 };
    if (!hayApoyo(pies, apoyos)) {
      avisos.push({
        codigo: AVISOS.SIN_SUELO_INICIO,
        mensaje: 'no hay superficie bajo el punto de inicio: el jugador empezará cayendo'
      });
    }
  }

  // Peligros flotando en el aire: funcionan, pero casi siempre son un despiste
  // (es la deuda de los pinchos flotantes del prototipo).
  peligros.forEach((caja, indice) => {
    if (!dimensionesOk) return;
    const enElFondo = caja.y + caja.alto >= alto - 1;
    if (enElFondo || hayApoyo(caja, apoyos)) return;
    avisos.push({
      codigo: AVISOS.PELIGRO_FLOTANTE,
      mensaje: `peligro en (${caja.x}, ${caja.y}) no se apoya en nada: queda flotando`,
      indice
    });
  });

  metas.forEach((caja, indice) => {
    if (apoyos.length === 0 || hayApoyo(caja, apoyos)) return;
    avisos.push({
      codigo: AVISOS.META_SIN_APOYO,
      mensaje: `la meta en (${caja.x}, ${caja.y}) está en el aire: comprueba que se llega a ella`,
      indice
    });
  });

  return { id, valido: errores.length === 0, errores, avisos };
}

/**
 * Valida una LISTA de niveles (el catálogo) y añade los errores de conjunto:
 * catálogo vacío e identificadores repetidos (romperían el récord guardado).
 */
export function validarCatalogo(niveles = []) {
  const errores = [];
  const avisos = [];
  const resultados = [];

  if (!Array.isArray(niveles) || niveles.length === 0) {
    errores.push({ codigo: ERRORES.CATALOGO_VACIO, mensaje: 'el catálogo de niveles está vacío' });
    return { valido: false, errores, avisos, resultados };
  }

  const vistos = new Map();

  niveles.forEach((nivel, indice) => {
    const resultado = validarNivel(nivel);
    resultados.push(resultado);

    const etiqueta = resultado.id ?? nivel?.id ?? `#${indice}`;
    if (vistos.has(etiqueta)) {
      errores.push({
        codigo: ERRORES.ID_DUPLICADO,
        nivel: etiqueta,
        mensaje: `el id "${etiqueta}" está repetido (índices ${vistos.get(etiqueta)} y ${indice})`
      });
    } else {
      vistos.set(etiqueta, indice);
    }

    for (const error of resultado.errores) errores.push({ ...error, nivel: etiqueta });
    for (const aviso of resultado.avisos) avisos.push({ ...aviso, nivel: etiqueta });
  });

  return { valido: errores.length === 0, errores, avisos, resultados };
}

/** Solape horizontal (px) entre dos cajas; negativo si no se tocan. */
function solapeHorizontal(a, b) {
  return Math.min(a.x + a.ancho, b.x + b.ancho) - Math.max(a.x, b.x);
}

/**
 * ¿La caja se apoya en alguna superficie? Se compara la CARA INFERIOR de la caja
 * con la cara superior del apoyo, con `NIVEL.APOYO_MARGEN` de tolerancia.
 */
function hayApoyo(caja, apoyos, { margen = NIVEL.APOYO_MARGEN } = {}) {
  const pies = caja.y + caja.alto;
  return apoyos.some(
    (apoyo) =>
      Math.abs(apoyo.y - pies) <= margen && solapeHorizontal(apoyo, caja) >= NIVEL.APOYO_ANCHO_MINIMO
  );
}

