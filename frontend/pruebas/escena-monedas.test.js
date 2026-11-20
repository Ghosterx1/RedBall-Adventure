import test from 'node:test';
import assert from 'node:assert/strict';

import { EscenaMundo } from '../src/escenas/EscenaMundo.js';
import { JUEGO, PASO_FIJO } from '../src/config/ajustes.js';
import {
  guardarProgreso,
  leerProgreso,
  progresoVacio,
  registrarPartida,
  registroDe
} from '../src/nucleo/Progreso.js';
import { contextoFalso } from './ayudas/contexto-falso.js';
import { almacenFalso } from './ayudas/almacen-falso.js';

/**
 * Cableado completo de las monedas: mundo → marcador → HUD → sonido → récord.
 * La escena es quien traduce los eventos del mundo a efectos; los objetos no
 * suenan ni saben puntuar.
 */

function sonidoFalso() {
  const registro = { monedas: 0 };
  return {
    registro,
    moneda() {
      registro.monedas += 1;
      return true;
    }
  };
}

function juegoFalso({ eje = 0, almacen = undefined, sonido = null } = {}) {
  return {
    almacen,
    sonido,
    entrada: {
      ejeHorizontal: () => eje,
      recienPresionada: () => false,
      estaPresionada: () => false
    }
  };
}

function andar(escena, juego, segundos) {
  const pasos = Math.round(60 * segundos);
  for (let i = 0; i < pasos; i++) escena.actualizar(PASO_FIJO, juego);
  return escena;
}

const textos = (ctx) =>
  ctx.llamadas.filter(([nombre]) => nombre === 'fillText').map(([, texto]) => String(texto));

test('al entrar, el marcador conoce el total de monedas del nivel', () => {
  const escena = new EscenaMundo().entrar(juegoFalso());

  assert.ok(escena.mundo.totalColeccionables > 10, 'el nivel debe tener monedas');
  assert.equal(escena.marcador.totalMonedas, escena.mundo.totalColeccionables);
  assert.equal(escena.marcador.monedas, 0);
  assert.equal(escena.marcador.puntos, 0);
  assert.equal(escena.record, 0, 'sin récord guardado se empieza en cero');
});

test('andar sobre las monedas las recoge, suma puntos y suena', () => {
  const sonido = sonidoFalso();
  const juego = juegoFalso({ eje: 1, sonido });
  const escena = andar(new EscenaMundo().entrar(juego), juego, 1.5);

  assert.ok(escena.marcador.monedas >= 1, `debería coger monedas: ${escena.marcador.monedas}`);
  assert.equal(escena.marcador.puntos, escena.marcador.monedas * JUEGO.VALOR_MONEDA);
  assert.ok(sonido.registro.monedas >= 1, 'suena al recoger');
  assert.equal(
    escena.mundo.coleccionablesRestantes,
    escena.mundo.totalColeccionables - escena.marcador.monedas
  );
});

test('el estado del HUD lleva el contador de monedas y la puntuación', () => {
  const juego = juegoFalso({ eje: 1 });
  const escena = andar(new EscenaMundo().entrar(juego), juego, 1.5);

  // El HUD del DOM se alimenta de `datosHud()`: la escena no dibuja contadores
  // en el canvas (solo la misión del nivel), así que la verdad está aquí.
  const datos = escena.datosHud();
  assert.equal(datos.monedas, escena.marcador.monedas);
  assert.equal(datos.totalMonedas, escena.marcador.totalMonedas);
  assert.equal(datos.puntos, escena.marcador.puntos);
  assert.ok(datos.monedas >= 1, `debería haber cogido monedas: ${datos.monedas}`);
  assert.ok(datos.progreso > 0 && datos.progreso <= 1, `barra fuera de rango: ${datos.progreso}`);

  // Y el canvas no duplica el contador: solo escribe la línea del objetivo.
  const ctx = contextoFalso();
  escena.dibujar(ctx);
  const lineas = textos(ctx);
  assert.ok(
    lineas.some((texto) => texto.includes('monedas')),
    `el objetivo debe seguir en el canvas: ${JSON.stringify(lineas)}`
  );
  assert.ok(
    !lineas.some((texto) => texto.startsWith('monedas ')),
    `el contador no debe pintarse dos veces: ${JSON.stringify(lineas)}`
  );
});

test('sin sonido inyectado la escena sigue funcionando', () => {
  const juego = juegoFalso({ eje: 1 });
  const escena = new EscenaMundo().entrar(juego);

  assert.doesNotThrow(() => andar(escena, juego, 1));
  assert.ok(escena.marcador.monedas >= 1);
});

test('recoger todas las monedas completa el nivel y guarda el récord', () => {
  const almacen = almacenFalso();
  const sonido = sonidoFalso();
  const juego = juegoFalso({ almacen, sonido });
  const escena = new EscenaMundo().entrar(juego);
  const total = escena.mundo.totalColeccionables;

  for (let i = 0; i < total + 5 && escena.mundo.coleccionablesRestantes > 0; i++) {
    const moneda = escena.mundo.coleccionables[0];
    escena.jugador.colocar({ x: moneda.x - 5, y: moneda.y - 5 });
    escena.actualizar(PASO_FIJO, juego);
  }

  assert.equal(escena.mundo.coleccionablesRestantes, 0, 'se han recogido todas');
  assert.equal(escena.marcador.monedas, total);
  assert.equal(escena.marcador.completo, true);
  assert.equal(escena.completo, true);
  // Un blip por paso: si dos monedas caen en el mismo paso suena una sola vez.
  assert.ok(
    sonido.registro.monedas > 0 && sonido.registro.monedas <= total,
    `blips inesperados: ${sonido.registro.monedas} para ${total} monedas`
  );

  const guardado = registroDe(leerProgreso(almacen), 'demo');
  assert.equal(guardado.completado, true, 'el récord se guarda al completar');
  assert.equal(guardado.puntos, total * JUEGO.VALOR_MONEDA);
  assert.equal(guardado.monedas, total);
  assert.equal(guardado.totalMonedas, total);
});

test('una sola llamada al sonido por paso, aunque caigan dos monedas', () => {
  const nivel = {
    id: 'dos-monedas',
    nombre: 'Dos monedas',
    ancho: 300,
    alto: 480,
    inicio: { x: 40, y: 240 },
    objetos: [
      { tipo: 'plataforma', x: 0, y: 240, ancho: 300, alto: 30 },
      { tipo: 'moneda', x: 100, y: 226 },
      { tipo: 'moneda', x: 130, y: 226 }
    ]
  };
  const sonido = sonidoFalso();
  const juego = juegoFalso({ sonido });
  const escena = new EscenaMundo({ nivel }).entrar(juego);

  escena.jugador.colocar({ x: 68, y: 216 });
  escena.actualizar(PASO_FIJO, juego); // fija la caja anterior, aún no toca ninguna
  assert.equal(escena.marcador.monedas, 0);

  escena.jugador.colocar({ x: 112, y: 216 }); // 44 px: atraviesa las dos en un paso
  escena.actualizar(PASO_FIJO, juego);

  assert.equal(escena.marcador.monedas, 2);
  assert.equal(sonido.registro.monedas, 1, 'un solo blip por paso');
});

test('el récord guardado se lee al entrar y nunca empeora', () => {
  const almacen = almacenFalso();
  guardarProgreso(
    registrarPartida(progresoVacio(), {
      nivel: 'demo',
      puntos: 500,
      monedas: 21,
      totalMonedas: 21,
      completado: true
    }),
    almacen
  );

  const juego = juegoFalso({ eje: 1, almacen });
  const escena = new EscenaMundo().entrar(juego);

  assert.equal(escena.record, 500, 'el HUD puede mostrar el récord');

  andar(escena, juego, 1.5);
  escena.salir();

  const guardado = registroDe(leerProgreso(almacen), 'demo');
  assert.equal(guardado.puntos, 500, 'una partida peor no baja el récord');
  assert.equal(guardado.completado, true);
  assert.ok(guardado.partidas >= 1);
});

test('salir() guarda la partida cuando mejora el récord', () => {
  const almacen = almacenFalso();
  const juego = juegoFalso({ eje: 1, almacen });
  const escena = andar(new EscenaMundo().entrar(juego), juego, 1.5);

  assert.ok(escena.marcador.puntos > 0);
  escena.salir();

  const guardado = registroDe(leerProgreso(almacen), 'demo');
  assert.equal(guardado.puntos, escena.marcador.puntos);
  assert.equal(guardado.monedas, escena.marcador.monedas);
  assert.equal(guardado.totalMonedas, escena.mundo.totalColeccionables);
});
