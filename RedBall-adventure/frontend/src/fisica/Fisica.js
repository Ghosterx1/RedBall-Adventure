import { FISICA } from '../config/ajustes.js';
import { limitar, moverHacia, solapan } from './aabb.js';
import { resolver, asentarEnSuperficies, esSolido } from './Colisiones.js';

/**
 * Fisica.js — mecánica de un cuerpo con caja: gravedad, aceleración, fricción,
 * velocidad máxima y desplazamiento con colisiones.
 *
 * Es una caja de herramientas SIN estado: recibe el cuerpo (cualquier objeto con
 * vx, vy, x, y, ancho, alto) y lo modifica. La usan el jugador, los enemigos y
 * lo que venga, así que no conoce a ninguno de ellos.
 *
 * Orden recomendado de un paso (ver entidades/Jugador.js):
 *   1. acelerar o frenar en horizontal
 *   2. decidir el salto
 *   3. aplicarGravedad
 *   4. limitarVelocidad
 *   5. desplazar (integra + colisiona + anula velocidades contra el borde)
 */

/** Aplica gravedad y recorta la velocidad de caída. */
export function aplicarGravedad(
  cuerpo,
  dt,
  { gravedad = FISICA.GRAVEDAD, caidaMaxima = FISICA.CAIDA_MAXIMA } = {}
) {
  cuerpo.vy = Math.min(cuerpo.vy + gravedad * dt, caidaMaxima);
  return cuerpo;
}

/**
 * Aceleración horizontal: lleva vx hacia `eje * velocidadMaxima` como mucho
 * `aceleracion * dt` por paso. Nunca sobrepasa el objetivo, así que no oscila.
 * Con `eje = 0` equivale a desacelerar hasta parar.
 */
export function acelerar(
  cuerpo,
  eje,
  dt,
  { aceleracion = FISICA.ACELERACION, velocidadMaxima = FISICA.VELOCIDAD_MAXIMA } = {}
) {
  cuerpo.vx = moverHacia(cuerpo.vx, eje * velocidadMaxima, aceleracion * dt);
  return cuerpo;
}

/**
 * Fricción exponencial: `factor` está expresado "por frame a 60 Hz", así que se
 * eleva a `dt * 60` para que el decaimiento por segundo sea el mismo a cualquier
 * tasa. Por debajo de `umbralParada` se detiene del todo (evita el deslizamiento
 * infinito y las velocidades residuales de 0,3 px/s).
 */
export function frenar(
  cuerpo,
  dt,
  factor = FISICA.AMORTIGUAMIENTO,
  { umbralParada = FISICA.UMBRAL_PARADA } = {}
) {
  cuerpo.vx *= Math.pow(limitar(factor, 0, 1), dt * 60);
  if (Math.abs(cuerpo.vx) < umbralParada) cuerpo.vx = 0;
  return cuerpo;
}

/**
 * Recorta las velocidades a sus topes.
 *
 * - `horizontal` se aplica en los dos signos (es un límite de control).
 * - `caidaMaxima` solo recorta la CAÍDA (vy > 0). La subida NO se recorta aquí:
 *   recortarla limitaría la altura del salto (v0 = −450 supera 420 y el salto
 *   perdería 4 px de ápice). La subida está acotada por el propio salto.
 */
export function limitarVelocidad(
  cuerpo,
  { horizontal = FISICA.VELOCIDAD_MAXIMA, caidaMaxima = FISICA.CAIDA_MAXIMA } = {}
) {
  cuerpo.vx = limitar(cuerpo.vx, -horizontal, horizontal);
  cuerpo.vy = Math.min(cuerpo.vy, caidaMaxima);
  return cuerpo;
}

/**
 * Integra el movimiento del paso y resuelve colisiones.
 *
 * - Anula la velocidad del eje que choca (el rebote se decide fuera, con
 *   `contacto.impacto`, que guarda la velocidad ANTES del choque).
 * - Devuelve los contactos; cada uno lleva `impacto: {vx, vy}`.
 */
export function desplazar(cuerpo, dt, solidos = [], opciones = {}) {
  const impacto = { vx: cuerpo.vx, vy: cuerpo.vy };
  const contactos = resolver(
    cuerpo,
    { dx: cuerpo.vx * dt, dy: cuerpo.vy * dt },
    solidos,
    opciones
  );

  // Capacidad OPCIONAL: rampas y demás superficies inclinadas. Si el mundo no
  // declara `superficies`, este bloque no cuesta nada (ni un bucle vacío).
  const { superficies = null } = opciones;
  if (superficies && superficies.length > 0) {
    const alturaPrevia = cuerpo.y;
    const ajustes = asentarEnSuperficies(cuerpo, superficies, opciones);
    // Guarda: si asentarse en la pendiente metiera el cuerpo dentro de un
    // bloque (una rampa que acaba en una cornisa), se descarta el ajuste. Con
    // esto, la rampa y el canto del bloque no se pelean.
    const choca =
      ajustes.length > 0 &&
      solidos.some((solido) => esSolido(solido) && solapan(cuerpo, solido, FISICA.MARGEN_CONTACTO));

    if (choca) cuerpo.y = alturaPrevia;
    else contactos.push(...ajustes);
  }

  for (const contacto of contactos) {
    contacto.impacto = impacto;
    if (contacto.eje === 'x') cuerpo.vx = 0;
    else cuerpo.vy = 0;
  }

  return contactos;
}

/* ───────────── Relaciones entre salto, gravedad y tiempo ───────────── */

/** Altura del ápice: h = v² / (2g). */
export function alturaMaxima(velocidad, gravedad = FISICA.GRAVEDAD) {
  return (velocidad * velocidad) / (2 * gravedad);
}

/** Tiempo total en el aire: t = 2v / g. */
export function tiempoEnAire(velocidad, gravedad = FISICA.GRAVEDAD) {
  return (2 * Math.abs(velocidad)) / gravedad;
}

/**
 * Diseño inverso del salto: devuelve la velocidad inicial y la gravedad
 * necesarias para subir `altura` px y estar en el aire `tiempo` segundos.
 *
 *   v0 = 4h / t        g = 8h / t²
 *
 * La velocidad se devuelve NEGATIVA porque el eje Y crece hacia abajo.
 */
export function parametrosSalto(altura, tiempo) {
  if (!(altura > 0) || !(tiempo > 0)) {
    throw new RangeError('parametrosSalto necesita altura y tiempo positivos');
  }
  return {
    velocidad: -(4 * altura) / tiempo,
    gravedad: (8 * altura) / (tiempo * tiempo)
  };
}
