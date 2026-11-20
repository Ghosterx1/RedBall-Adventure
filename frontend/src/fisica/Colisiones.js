import { FISICA, MUNDO } from '../config/ajustes.js';
import { material } from '../config/materiales.js';

/**
 * Colisiones.js — resolución de colisiones AABB contra sólidos estáticos.
 *
 * No conoce puntuación, entidades, escenas ni dibujo: entra una caja y una
 * lista de rectángulos, y salen contactos. Qué significa cada contacto (rebotar,
 * morir, sumar puntos) se decide fuera, en la entidad o la escena.
 *
 * MÉTODO: barrido por eje (swept AABB), primero X y luego Y.
 * Para cada eje se calcula la distancia MÍNIMA hasta el primer borde que
 * bloquea, y el desplazamiento se recorta a ese valor. Consecuencias:
 *
 *  - IMPOSIBLE ATRAVESAR: no se pregunta "¿estoy solapado?" sino "¿cuánto puedo
 *    avanzar antes de chocar?", así que da igual que el paso sea de 5 px o 400.
 *  - IMPOSIBLE VIBRAR: la caja se queda EXACTAMENTE en el borde; no se empuja
 *    hacia fuera una penetración ya consumida (eso es lo que produce temblor).
 *  - El resultado no depende del orden de la lista de sólidos.
 *  - Separar X e Y elimina la ambigüedad de las esquinas.
 *
 * El eje perpendicular al movimiento se comprueba con desigualdad ESTRICTA
 * (+ margen): por eso el suelo no bloquea el movimiento horizontal cuando la
 * bola está justo encima.
 */

/** Dirección en la que empuja la superficie (no la del movimiento). */
export const NORMAL = Object.freeze({
  ARRIBA: Object.freeze({ x: 0, y: -1 }), // suelo: empuja hacia arriba
  ABAJO: Object.freeze({ x: 0, y: 1 }), // techo: empuja hacia abajo
  IZQUIERDA: Object.freeze({ x: -1, y: 0 }), // pared a la derecha
  DERECHA: Object.freeze({ x: 1, y: 0 }) // pared a la izquierda
});

/** Marca interna para los bordes del mundo (no son sólidos, solo topes). */
const LIMITE_MUNDO = Object.freeze({ limite: true });

/** ¿Este sólido bloquea el paso? El agua (y `{bloquea:false}`) no bloquea. */
export function esSolido(solido) {
  if (!solido || solido.bloquea === false || solido.solido === false) return false;
  return material(solido.material).solido !== false;
}

/** ¿Se solapan caja y sólido en el eje PERPENDICULAR al movimiento? */
function solapaPerpendicular(caja, solido, eje, margen) {
  return eje === 'x'
    ? caja.y < solido.y + solido.alto - margen && caja.y + caja.alto > solido.y + margen
    : caja.x < solido.x + solido.ancho - margen && caja.x + caja.ancho > solido.x + margen;
}

/**
 * Desplaza `caja` en un eje recortando el movimiento contra los sólidos.
 * MUTA `caja` (x o y) y devuelve los contactos producidos.
 *
 * @param {object} caja            cuerpo con x, y, ancho, alto
 * @param {'x'|'y'} eje
 * @param {number} desplazamiento  píxeles a avanzar (puede ser negativo)
 * @param {Array}  solidos         rectángulos { x, y, ancho, alto, material? }
 * @param {object} opciones        { limites: {ancho, alto}, margen }
 * @returns {Array<{eje, normal, solido, material, esLimite}>}
 */
export function moverEnEje(caja, eje, desplazamiento, solidos = [], opciones = {}) {
  const {
    limites = null,
    margen = FISICA.MARGEN_CONTACTO,
    escalon = MUNDO.ESCALON_MAXIMO
  } = opciones;
  const contactos = [];
  if (!Number.isFinite(desplazamiento) || desplazamiento === 0) return contactos;

  const signo = desplazamiento > 0 ? 1 : -1;
  let permitido = Math.abs(desplazamiento);
  let bloqueador = null;

  // Como mucho dos intentos: el primero puede descubrir un ESCALÓN. En ese caso
  // se sube la caja al canto y se recalcula; el movimiento aún no se ha
  // aplicado, así que no hay nada que deshacer.
  for (let intento = 0; intento < 2; intento++) {
    permitido = Math.abs(desplazamiento);
    bloqueador = null;

    // 1) Bordes del mundo: laterales y techo. No hay suelo implícito: se puede caer.
    if (limites) {
      let disponible = Infinity;
      if (eje === 'x') {
        disponible = signo > 0 ? limites.ancho - (caja.x + caja.ancho) : caja.x;
      } else if (signo < 0) {
        disponible = caja.y;
      }
      if (disponible < permitido) {
        permitido = Math.max(0, disponible);
        bloqueador = LIMITE_MUNDO;
      }
    }

    // 2) Sólidos: distancia al primer borde que corta el paso.
    for (const solido of solidos) {
      if (!esSolido(solido)) continue;
      if (!solapaPerpendicular(caja, solido, eje, margen)) continue;

      if (solido.unSoloSentido) {
        // Plataforma atravesable: solo bloquea al caer y viniendo de arriba.
        if (eje !== 'y' || signo < 0) continue;
        if (caja.y + caja.alto > solido.y + margen) continue;
      }

      const distancia =
        eje === 'x'
          ? (signo > 0 ? solido.x - (caja.x + caja.ancho) : solido.x + solido.ancho - caja.x) * signo
          : (signo > 0 ? solido.y - (caja.y + caja.alto) : solido.y + solido.alto - caja.y) * signo;

      if (distancia < 0) continue; // ya solapado o a la espalda: no puede frenarnos
      if (distancia < permitido) {
        permitido = distancia;
        bloqueador = solido;
      }
    }

    // 3) Escalón: si lo que frena es el canto de un sólido cuya cara superior
    //    queda como mucho `escalon` px por encima de los pies, se sube y se
    //    sigue andando. Sin esto, una rampa que acaba en una cornisa se queda
    //    clavada contra el canto (llega unos píxeles por debajo del borde).
    if (eje === 'x' && escalon > 0 && bloqueador && bloqueador !== LIMITE_MUNDO) {
      const desnivel = caja.y + caja.alto - bloqueador.y;
      if (desnivel > 0 && desnivel <= escalon) {
        caja.y -= desnivel;
        continue;
      }
    }

    break;
  }

  // 3) Aplicar el movimiento permitido y emitir el contacto.
  if (eje === 'x') caja.x += signo * permitido;
  else caja.y += signo * permitido;

  if (bloqueador !== null) {
    const normal =
      eje === 'x'
        ? signo > 0
          ? NORMAL.IZQUIERDA
          : NORMAL.DERECHA
        : signo > 0
          ? NORMAL.ARRIBA
          : NORMAL.ABAJO;

    contactos.push({
      eje,
      normal,
      solido: bloqueador === LIMITE_MUNDO ? null : bloqueador,
      material: bloqueador === LIMITE_MUNDO ? null : bloqueador.material,
      esLimite: bloqueador === LIMITE_MUNDO
    });
  }

  return contactos;
}

/**
 * Mueve la caja en los dos ejes y devuelve todos los contactos.
 * X primero y luego Y: el orden clásico que evita enganchones en las esquinas.
 *
 * @param {object} caja  cuerpo con x, y, ancho, alto (se muta)
 * @param {{dx?: number, dy?: number}} desplazamiento
 */
export function resolver(caja, { dx = 0, dy = 0 } = {}, solidos = [], opciones = {}) {
  const contactos = moverEnEje(caja, 'x', dx, solidos, opciones);
  contactos.push(...moverEnEje(caja, 'y', dy, solidos, opciones));
  return contactos;
}

/** Primer contacto del eje indicado, o null. */
export function contactoEn(contactos, eje) {
  return contactos.find((contacto) => contacto.eje === eje) ?? null;
}

/** ¿Hay apoyo (suelo) entre estos contactos? */
export function haySuelo(contactos) {
  return contactos.some((contacto) => contacto.eje === 'y' && contacto.normal.y < 0);
}

/**
 * Superficies inclinadas (rampas) — capacidad OPCIONAL del motor.
 *
 * Una superficie declara dos funciones puras:
 *   alturaEn(x)  → y de la superficie en esa x, o null si la x queda fuera
 *   normalEn(x)  → vector unitario que empuja hacia fuera de la pendiente
 *
 * MÉTODO: tras el barrido de los rectángulos, se "asienta" el cuerpo sobre la
 * pendiente. Solo se corrige si el desnivel entra en ±tolerancia:
 *   - positivo (los pies están por ENCIMA de la pendiente) → se baja: así la
 *     bola no se despega al bajar una cuesta, porque la gravedad por sí sola
 *     (0,32 px/paso) nunca alcanzaría la pendiente (2,5 px/paso).
 *   - negativo (los pies están por DEBAJO) → se sube: así se sube la cuesta
 *     andando, sin escalones ni bloqueos horizontales.
 *   - fuera de la tolerancia no se hace nada: se puede saltar por encima y
 *     atravesarla desde abajo (una sola dirección).
 * Si el cuerpo sube (vy < 0) no se pega a la pendiente: saltar la suelta.
 *
 * No conoce rampas concretas: cualquier objeto con `alturaEn`/`normalEn` sirve.
 */
export function asentarEnSuperficies(cuerpo, superficies = [], opciones = {}) {
  const contactos = [];
  if (!superficies || superficies.length === 0) return contactos;

  const { margen = FISICA.MARGEN_CONTACTO, tolerancia = MUNDO.RAMPA_TOLERANCIA } = opciones;
  const centroX = cuerpo.x + cuerpo.ancho / 2;

  for (const superficie of superficies) {
    if (!superficie) continue;
    const altura = superficie.alturaEn(centroX);
    if (!Number.isFinite(altura)) continue;

    const desnivel = altura - (cuerpo.y + cuerpo.alto);
    if (desnivel > tolerancia) continue; // aún vuela por encima
    if (desnivel < -tolerancia) continue; // pasa por debajo (atravesable)
    if (desnivel > margen && cuerpo.vy < 0) continue; // subiendo no se pega

    cuerpo.y = altura - cuerpo.alto;
    contactos.push({
      eje: 'y',
      normal: superficie.normalEn(centroX),
      solido: superficie,
      material: superficie.material ?? null,
      superficie: true
    });
  }

  return contactos;
}
