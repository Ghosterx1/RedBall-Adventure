import { registroDe, registrarPartida as registrarPartidaEnProgreso } from '../dominio.js';
import { normalizarBase, jugadorNuevo, nombreJugador } from '../almacen/esquema.js';
import { fusionarProgreso, recordDeNivel, resumenProgreso } from './progreso.js';

/**
 * servicios/records.js — lo que pasa cuando alguien termina un nivel.
 *
 * Todo se calcula sobre `progreso` (formato v1, el mismo del navegador) usando
 * `registrarPartida()` del frontend, así el récord del servidor y el del
 * `localStorage` no pueden discrepar: si el jugador borra su progreso local y
 * sincroniza, recibe el mismo resultado que tenía.
 *
 * `ranking()` es una función PURA sobre la base ya normalizada: se prueba sin
 * servidor y sin disco.
 */

/** Estado de un jugador recién creado, para devolverlo junto al récord. */
function perfil(jugador) {
  return {
    id: jugador.id,
    nombre: jugador.nombre,
    progreso: jugador.progreso,
    resumen: resumenProgreso(jugador.progreso),
    creado: jugador.creado,
    actualizado: jugador.actualizado
  };
}

/**
 * Anota una partida terminada (victoria o derrota) en el perfil del jugador.
 *
 * Es un "upsert": si el jugador no existe se crea. El récord nunca empeora
 * porque la fusión la hace `Progreso.registrarPartida()`.
 *
 * @returns {Promise<{nuevo:boolean, mejorado:boolean, record:object,
 *   posicion:number|null, perfil:object}>}
 */
export async function anotarPartida({
  almacen,
  id,
  nombre = '',
  nivel,
  puntos,
  monedas = 0,
  totalMonedas = 0,
  completado = false,
  fecha = new Date().toISOString(),
  limite = 10
}) {
  let anotado = null;

  const base = await almacen.actualizar((datos) => {
    const nueva = normalizarBase(datos);
    const existente = nueva.jugadores[id];
    const nuevo = existente === undefined;
    const jugador = existente ?? jugadorNuevo(id, nombre, fecha);

    if (nombre) jugador.nombre = nombreJugador(nombre, id);

    const antes = registroDe(jugador.progreso, nivel);
    jugador.progreso = registrarPartidaEnProgreso(jugador.progreso, {
      nivel,
      puntos,
      monedas,
      totalMonedas,
      completado
    });
    jugador.actualizado = fecha;

    nueva.jugadores[id] = jugador;
    nueva.actualizado = fecha;

    const despues = registroDe(jugador.progreso, nivel);
    anotado = {
      nuevo,
      jugador,
      record: { ...recordDeNivel(jugador.progreso, nivel), fecha },
      mejorado:
        despues.puntos > antes.puntos ||
        despues.monedas > antes.monedas ||
        (despues.completado && !antes.completado)
    };
    return nueva;
  });

  const puesto = ranking(base, { nivel, limite }).findIndex((fila) => fila.jugador === id);

  return {
    nuevo: anotado.nuevo,
    mejorado: anotado.mejorado,
    record: anotado.record,
    posicion: puesto >= 0 ? puesto + 1 : null,
    perfil: perfil(anotado.jugador)
  };
}

/**
 * Sincroniza un progreso completo (por ejemplo, el del portátil hacia el móvil).
 * La fusión es de máximos, así que enviarlo dos veces no cambia nada.
 */
export async function guardarProgreso({
  almacen,
  id,
  nombre = '',
  progreso,
  fecha = new Date().toISOString()
}) {
  let nuevo = false;

  const base = await almacen.actualizar((datos) => {
    const nueva = normalizarBase(datos);
    const existente = nueva.jugadores[id];
    nuevo = existente === undefined;
    const jugador = existente ?? jugadorNuevo(id, nombre, fecha);

    if (nombre) jugador.nombre = nombreJugador(nombre, id);
    jugador.progreso = fusionarProgreso(jugador.progreso, progreso);
    jugador.actualizado = fecha;

    nueva.jugadores[id] = jugador;
    nueva.actualizado = fecha;
    return nueva;
  });

  return { nuevo, perfil: perfil(base.jugadores[id]) };
}

/** Jugador guardado, o null. */
export function buscarJugador(base, id) {
  return base?.jugadores?.[id] ?? null;
}

/**
 * Tabla de mejores jugadores. Función pura: recibe la base normalizada.
 *
 * - `nivel` null → ranking global por PUNTOS TOTALES (suma de los récords de
 *   todos los niveles), con desempate por niveles completados y luego por id
 *   (para que el orden sea siempre el mismo entre peticiones iguales).
 * - `nivel` concreto → solo quien ha jugado ese nivel.
 *
 * Quien no ha jugado nada se queda fuera: un 0 no es un récord.
 */
export function ranking(base, { nivel = null, limite = 10 } = {}) {
  if (!base || typeof base !== 'object' || !base.jugadores) return [];

  const filas = [];
  for (const jugador of Object.values(base.jugadores)) {
    if (nivel) {
      const registro = registroDe(jugador.progreso, nivel);
      if (registro.partidas === 0) continue;
      filas.push({
        jugador: jugador.id,
        nombre: jugador.nombre,
        nivel,
        puntos: registro.puntos,
        monedas: registro.monedas,
        totalMonedas: registro.totalMonedas,
        completado: registro.completado,
        actualizado: jugador.actualizado
      });
      continue;
    }

    const resumen = resumenProgreso(jugador.progreso);
    if (resumen.partidas === 0) continue;
    filas.push({
      jugador: jugador.id,
      nombre: jugador.nombre,
      puntos: resumen.puntos,
      completados: resumen.completados,
      total: resumen.total,
      partidas: resumen.partidas,
      actualizado: jugador.actualizado
    });
  }

  filas.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    const completadosA = a.completados ?? (a.completado ? 1 : 0);
    const completadosB = b.completados ?? (b.completado ? 1 : 0);
    if (completadosB !== completadosA) return completadosB - completadosA;
    return String(a.jugador).localeCompare(String(b.jugador));
  });

  const tope = Number.isFinite(limite) ? Math.max(0, Math.floor(limite)) : 10;
  return filas.slice(0, tope).map((fila, indice) => ({ posicion: indice + 1, ...fila }));
}

/** Perfil en formato API. */
export function perfilPublico(jugador) {
  return perfil(jugador);
}
