/**
 * aabb.js — geometría de cajas alineadas a los ejes (AABB) y aritmética de
 * movimiento. Puro cálculo: sin estado, sin DOM, sin conocimiento del juego.
 *
 * CONVENIO: el eje Y CRECE HACIA ABAJO (igual que el lienzo), así que caer es
 * vy > 0 y saltar es vy < 0.
 */

/** Crea una caja. */
export const caja = (x = 0, y = 0, ancho = 0, alto = 0) => ({ x, y, ancho, alto });

/** Borde derecho de una caja. */
export const derecha = (c) => c.x + c.ancho;

/** Borde inferior de una caja. */
export const abajo = (c) => c.y + c.alto;

/** Centro de una caja. */
export const centro = (c) => ({ x: c.x + c.ancho / 2, y: c.y + c.alto / 2 });

/** Limita `valor` al intervalo [minimo, maximo]. */
export function limitar(valor, minimo, maximo) {
  return valor < minimo ? minimo : valor > maximo ? maximo : valor;
}

/**
 * Lleva `valor` hacia `objetivo` como máximo `maximo` unidades.
 *
 * Es la base de toda aceleración y desaceleración:
 *   vx = moverHacia(vx, objetivo, aceleracion * dt)
 * Nunca sobrepasa el objetivo, así que el resultado es exacto y no hay
 * sobreoscilación (nada de "rebase y vuelta").
 */
export function moverHacia(valor, objetivo, maximo) {
  if (!(maximo > 0)) return valor;
  if (valor < objetivo) return Math.min(valor + maximo, objetivo);
  if (valor > objetivo) return Math.max(valor - maximo, objetivo);
  return objetivo;
}

/**
 * ¿Se solapan dos cajas? `margen` separa los bordes para que un contacto
 * exacto (borde con borde) NO cuente como solape.
 */
export function solapan(a, b, margen = 0) {
  return (
    a.x < b.x + b.ancho - margen &&
    a.x + a.ancho > b.x + margen &&
    a.y < b.y + b.alto - margen &&
    a.y + a.alto > b.y + margen
  );
}

/** Rectángulo de intersección, o null si no se tocan. */
export function interseccion(a, b, margen = 0) {
  if (!solapan(a, b, margen)) return null;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return caja(
    x,
    y,
    Math.min(a.x + a.ancho, b.x + b.ancho) - x,
    Math.min(a.y + a.alto, b.y + b.alto) - y
  );
}

/**
 * ¿Se cruzan en este paso la caja `cuerpo` (que se mueve) y `objetivo` (quieto)?
 *
 * Es la versión CONTINUA de `solapan`: en vez de comparar dos fotogramas, se
 * compara todo el recorrido. Así no se escapa nada aunque el cuerpo avance más
 * que el tamaño del objetivo en un solo paso (a 620 px/s son 10,3 px por paso,
 * pero un paso largo —o un objeto diminuto— sí podría saltárselo).
 *
 * MÉTODO: la suma de Minkowski de dos AABB es otro AABB, así que el problema se
 * reduce a "¿el segmento centro→centro+desplazamiento toca el rectángulo
 * `objetivo` expandido por media caja?". Se resuelve con el test de franjas
 * (slab method): se calcula el intervalo de t ∈ [0,1] en el que el segmento
 * está dentro de cada eje y se comprueba que ambos intervalos se solapan.
 * Es exacto: no da falsos positivos al moverse en diagonal.
 *
 * `desplazamiento` son los px DE ESTE PASO ({ dx, dy }), no una velocidad.
 */
export function barreHasta(cuerpo, { dx = 0, dy = 0 } = {}, objetivo, margen = 0) {
  if (solapan(cuerpo, objetivo, margen)) return true;

  const mitadX = cuerpo.ancho / 2;
  const mitadY = cuerpo.alto / 2;
  // Rectángulo expandido: posiciones válidas del CENTRO de `cuerpo` para tocar.
  const limite = [
    [cuerpo.x + mitadX, dx, objetivo.x + margen - mitadX, objetivo.x + objetivo.ancho - margen + mitadX],
    [cuerpo.y + mitadY, dy, objetivo.y + margen - mitadY, objetivo.y + objetivo.alto - margen + mitadY]
  ];

  let entrada = 0;
  let salida = 1;

  for (const [origen, delta, minimo, maximo] of limite) {
    if (Math.abs(delta) < 1e-9) {
      // Sin avance en este eje: o ya está dentro de la franja, o no hay cruce.
      if (origen < minimo || origen > maximo) return false;
      continue;
    }
    const t1 = (minimo - origen) / delta;
    const t2 = (maximo - origen) / delta;
    entrada = Math.max(entrada, Math.min(t1, t2));
    salida = Math.min(salida, Math.max(t1, t2));
    if (entrada > salida) return false;
  }

  return entrada <= 1 && salida >= 0;
}
