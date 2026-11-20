import test from 'node:test';
import assert from 'node:assert/strict';

import { EscenaMundo } from '../src/escenas/EscenaMundo.js';
import { PASO_FIJO, VISTA } from '../src/config/ajustes.js';
import { Vidas } from '../src/nucleo/Vidas.js';
import { BusEventos } from '../src/nucleo/BusEventos.js';
import { crearCatalogo } from '../src/mundo/niveles/index.js';
import { SUELO, meta, moneda, suelo } from '../src/mundo/niveles/ayudas.js';
import { contextoFalso } from './ayudas/contexto-falso.js';

/**
 * Cableado de la Fase 7 dentro de la escena: vidas → derrota, `datosHud()` para
 * el HUD del DOM, el paso de nivel cuando lo decide la interfaz y las partículas
 * de la recogida y del bote. Todo sin DOM y sin navegador.
 */

function juegoFalso({ bus = new BusEventos() } = {}) {
  return {
    bus,
    almacen: undefined,
    sonido: null,
    entrada: {
      ejeHorizontal: () => 0,
      recienPresionada: () => false,
      estaPresionada: () => false
    }
  };
}

/** Mete al jugador en el primer peligro del nivel y da un paso. */
function morir(escena, juego) {
  const peligro = escena.mundo.delTipo('peligro')[0];
  escena.jugador.colocar({ x: peligro.x + 20, y: peligro.y - 20 });
  escena.actualizar(PASO_FIJO, juego);
}

/** Nivel mínimo con meta (para probar el final del nivel sin recorrerlo). */
function nivelConMeta(id, orden) {
  return {
    id,
    orden,
    nombre: `Meta ${orden}`,
    dificultad: 1,
    ancho: VISTA.ANCHO,
    alto: VISTA.ALTO,
    inicio: { x: 40, y: SUELO },
    objetivo: { tipo: 'meta' },
    objetos: [suelo(0, VISTA.ANCHO), meta(400)]
  };
}

function tocarMeta(escena, juego) {
  const laMeta = escena.mundo.delTipo('meta')[0];
  escena.jugador.colocar({ x: laMeta.x + 4, y: laMeta.y + 10 });
  escena.actualizar(PASO_FIJO, juego);
}

test('perder una vida la resta y avisa por el bus', () => {
  const vidas = new Vidas({ iniciales: 3 });
  const juego = juegoFalso();
  const avisos = [];
  juego.bus.on('vida:perdida', (datos) => avisos.push(datos));

  const escena = new EscenaMundo({ vidas }).entrar(juego);
  morir(escena, juego);

  assert.equal(escena.reinicios, 1);
  assert.equal(vidas.restantes, 2);
  assert.equal(avisos.length, 1, 'una muerte = un aviso');
  assert.equal(avisos[0].vidas, 2);
  assert.equal(avisos[0].nivel, escena.nivelId);
  assert.equal(escena.derrota, false);
});

test('sin vidas la escena se congela y avisa de la derrota', () => {
  const vidas = new Vidas({ iniciales: 1 });
  const juego = juegoFalso();
  const derrotas = [];
  juego.bus.on('partida:derrota', (datos) => derrotas.push(datos));

  const escena = new EscenaMundo({ vidas }).entrar(juego);
  morir(escena, juego);

  assert.equal(vidas.restantes, 0);
  assert.equal(vidas.agotadas, true);
  assert.equal(escena.derrota, true);
  assert.equal(escena.mensaje, 'Sin vidas');
  assert.equal(derrotas.length, 1);
  assert.equal(derrotas[0].nivel, escena.nivelId);
  assert.equal(derrotas[0].datos.derrota, true);

  // Congelada: un paso más no simula nada ni vuelve a contar la muerte.
  const x = escena.jugador.x;
  const y = escena.jugador.y;
  escena.actualizar(PASO_FIJO, juego);
  assert.equal(escena.jugador.x, x);
  assert.equal(escena.jugador.y, y);
  assert.equal(escena.reinicios, 1);
  assert.equal(vidas.restantes, 0);
});

test('sin vidas inyectadas morir solo reinicia: el motor no impone game over', () => {
  const juego = juegoFalso();
  const derrotas = [];
  juego.bus.on('partida:derrota', (datos) => derrotas.push(datos));

  const escena = new EscenaMundo().entrar(juego);
  for (let i = 0; i < 4; i++) morir(escena, juego);

  assert.equal(escena.reinicios, 4);
  assert.equal(escena.derrota, false);
  assert.equal(derrotas.length, 0);
  assert.equal(escena.datosHud().vidas, null, 'sin vidas el HUD no enseña corazones');
});

test('datosHud describe el nivel, las vidas y el récord', () => {
  const vidas = new Vidas({ iniciales: 3 });
  const escena = new EscenaMundo({ vidas }).entrar(juegoFalso());

  const datos = escena.datosHud();
  assert.equal(datos.nivel, 'demo');
  assert.equal(datos.monedas, 0);
  assert.equal(datos.puntos, 0);
  assert.equal(datos.totalMonedas, escena.mundo.totalColeccionables);
  assert.equal(datos.vidas, 3);
  assert.equal(datos.vidasMaximo, 3);
  assert.equal(datos.progreso, 0);
  assert.equal(datos.completo, false);
  assert.equal(datos.derrota, false);
  assert.equal(typeof datos.cabecera, 'string');
  assert.ok(datos.cabecera.length > 0);
});

test('la barra de progreso crece con las monedas y se llena al superar el nivel', () => {
  const nivel = {
    id: 'dos-monedas',
    nombre: 'Dos monedas',
    ancho: VISTA.ANCHO,
    alto: VISTA.ALTO,
    inicio: { x: 40, y: SUELO },
    objetos: [suelo(0, VISTA.ANCHO), moneda(120), moneda(160)]
  };
  const juego = juegoFalso();
  const escena = new EscenaMundo({ nivel, niveles: [] }).entrar(juego);

  assert.equal(escena.datosHud().progreso, 0, 'sin monedas la barra está vacía');

  escena.jugador.colocar({ x: 116, y: SUELO - 24 });
  escena.actualizar(PASO_FIJO, juego);
  assert.equal(escena.marcador.monedas, 1);
  assert.ok(Math.abs(escena.datosHud().progreso - 0.5) < 1e-9, 'una de dos = medio camino');

  escena.jugador.colocar({ x: 156, y: SUELO - 24 });
  escena.actualizar(PASO_FIJO, juego);
  assert.equal(escena.completo, true);
  assert.equal(escena.datosHud().progreso, 1, 'nivel superado = barra llena');
  assert.equal(escena.datosHud().completo, true);
});

test('con autoAvanzar:false el paso de nivel lo decide la interfaz', () => {
  const catalogo = crearCatalogo([nivelConMeta('nivel-a', 1), nivelConMeta('nivel-b', 2)]);
  const juego = juegoFalso();
  const eventos = [];
  juego.bus.on('nivel:completado', (datos) => eventos.push(datos));

  const escena = new EscenaMundo({
    nivelId: 'nivel-a',
    niveles: catalogo,
    autoAvanzar: false
  }).entrar(juego);

  tocarMeta(escena, juego);
  for (let i = 0; i < 120; i++) escena.actualizar(PASO_FIJO, juego); // 2 s: más que la transición

  assert.equal(escena.completo, true);
  assert.equal(escena.transicion, null, 'no se programa ningún salto automático');
  assert.equal(eventos.length, 1, 'pero se avisa una sola vez');
  assert.equal(eventos[0].nivel, 'nivel-a');
  assert.equal(eventos[0].siguiente, 'nivel-b');
});

test('con autoAvanzar por defecto sí se programa el salto (motor sin interfaz)', () => {
  const catalogo = crearCatalogo([nivelConMeta('nivel-a', 1), nivelConMeta('nivel-b', 2)]);
  const juego = juegoFalso();
  const escena = new EscenaMundo({ nivelId: 'nivel-a', niveles: catalogo }).entrar(juego);

  tocarMeta(escena, juego);

  assert.ok(escena.transicion, 'sin interfaz la escena se pasa sola de nivel');
  assert.equal(escena.transicion.nivelId, 'nivel-b');
});

test('recoger una moneda lanza chispas que se dibujan con la cámara', () => {
  const juego = juegoFalso();
  const escena = new EscenaMundo().entrar(juego);

  assert.equal(escena.particulas.vivas, 0, 'se empieza sin partículas');

  const primera = escena.mundo.coleccionables[0];
  escena.jugador.colocar({ x: primera.x - 4, y: primera.y - 4 });
  escena.actualizar(PASO_FIJO, juego);

  assert.ok(escena.marcador.monedas >= 1);
  assert.ok(escena.particulas.vivas > 0, 'la recogida deja chispas');

  const ctx = contextoFalso();
  escena.dibujar(ctx);
  const cuadraditos = ctx.llamadas.filter(([nombre, , , lado]) => nombre === 'fillRect' && lado === 2);
  assert.ok(cuadraditos.length > 0, 'las chispas son cuadrados de 2 px en el mundo');
  assert.ok(
    ctx.llamadas.some(([nombre]) => nombre === 'translate'),
    'y se pintan dentro de la traslación de la cámara'
  );
});

test('el bote en una superficie elástica levanta chispas', () => {
  const nivel = {
    id: 'trampolin',
    nombre: 'Trampolín',
    ancho: VISTA.ANCHO,
    alto: VISTA.ALTO,
    inicio: { x: 40, y: SUELO - 120 },
    objetos: [
      suelo(0, VISTA.ANCHO),
      { tipo: 'elastica', x: 200, y: SUELO - 12, ancho: 48, alto: 12 }
    ]
  };
  const juego = juegoFalso();
  const escena = new EscenaMundo({ nivel, niveles: [] }).entrar(juego);

  escena.jugador.colocar({ x: 210, y: SUELO - 130 });
  for (let i = 0; i < 90 && !escena.jugador.reboto; i++) escena.actualizar(PASO_FIJO, juego);

  assert.equal(escena.jugador.reboto, true, 'la bola debe botar en el trampolín');
  assert.ok(escena.particulas.vivas > 0, 'el bote deja chispas');
});

test('al cargar otro nivel se limpian las partículas', () => {
  const escena = new EscenaMundo().entrar(juegoFalso());
  const primera = escena.mundo.coleccionables[0];
  escena.jugador.colocar({ x: primera.x - 4, y: primera.y - 4 });
  escena.actualizar(PASO_FIJO, juegoFalso());
  assert.ok(escena.particulas.vivas > 0);

  escena.entrar(juegoFalso());
  assert.equal(escena.particulas.vivas, 0);
});
