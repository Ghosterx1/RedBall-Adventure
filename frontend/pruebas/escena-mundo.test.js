import test from 'node:test';
import assert from 'node:assert/strict';

import { EscenaMundo } from '../src/escenas/EscenaMundo.js';
import { Bucle } from '../src/nucleo/Bucle.js';
import { PASO_FIJO } from '../src/config/ajustes.js';
import { contextoFalso } from './ayudas/contexto-falso.js';

/**
 * La escena real solo cablea entrada → mundo → jugador → zonas → cámara.
 * Aquí se comprueba ese cableado completo sin DOM ni navegador.
 */

const LADO = 24;

function juegoFalso({ eje = 0 } = {}) {
  return {
    entrada: {
      ejeHorizontal: () => eje,
      recienPresionada: () => false,
      estaPresionada: () => false
    }
  };
}

/** Simula `segundos` con el Bucle real (paso fijo). */
function correr(segundos, opciones = {}) {
  const escena = new EscenaMundo();
  const juego = juegoFalso(opciones);
  escena.entrar(juego);

  const bucle = new Bucle({
    actualizar: (dt) => escena.actualizar(dt, juego),
    planificar: () => 0,
    cancelar: () => {}
  });

  const cuadros = Math.round(60 * segundos);
  for (let i = 0; i <= cuadros; i++) bucle.avanzarHasta((i * 1000) / 60);

  return { escena, juego };
}

test('al entrar se construye el mundo, el jugador y la cámara', () => {
  const escena = new EscenaMundo().entrar(juegoFalso());

  assert.equal(escena.mundo.objetos.length > 10, true);
  assert.equal(escena.jugador.ancho, LADO);
  assert.equal(escena.camara.mundoAncho, escena.mundo.ancho);
  assert.equal(escena.jugador.y + escena.jugador.alto, escena.mundo.inicio.y);
});

test('el jugador avanza, sube la rampa y la cámara lo sigue', () => {
  const { escena } = correr(1.5, { eje: 1 });

  assert.ok(escena.jugador.x > 60, `debe haberse movido: ${escena.jugador.x.toFixed(1)}`);
  assert.ok(escena.camara.x > 0, 'la cámara debe seguirle');
  assert.equal(escena.reinicios, 0, 'no debe haber muerto en el camino');
});

test('caer al agua reinicia en el último checkpoint y avisa', () => {
  const escena = new EscenaMundo().entrar(juegoFalso());
  const agua = escena.mundo.delTipo('peligro')[0];

  // Se coloca al jugador dentro del agua y se da un paso de simulación.
  escena.jugador.colocar({ x: agua.x + 20, y: agua.y - LADO + 4 });
  escena.actualizar(PASO_FIJO, juegoFalso());

  assert.equal(escena.reinicios, 1);
  assert.equal(escena.mensaje, 'Peligro');
  assert.ok(escena.destello > 0, 'debe marcar el destello de reinicio');
  assert.equal(escena.jugador.y + LADO, escena.mundo.inicio.y, 'vuelve al inicio');
});

test('un checkpoint tocado pasa a ser el punto de reaparición', () => {
  const escena = new EscenaMundo().entrar(juegoFalso());
  const bandera = escena.mundo.delTipo('checkpoint')[0];

  escena.jugador.colocar({ x: bandera.x, y: bandera.y });
  escena.actualizar(PASO_FIJO, juegoFalso());

  assert.equal(escena.mundo.checkpoint, bandera);
  assert.equal(escena.checkpoints, 1);
  assert.equal(escena.mensaje, 'Checkpoint');
});

test('la escena se dibuja sin DOM y muestra el HUD', () => {
  const { escena } = correr(0.5, { eje: 1 });
  const ctx = contextoFalso();

  assert.doesNotThrow(() => escena.dibujar(ctx));
  assert.ok(ctx.llamadas.length > 20, 'debe emitir muchas órdenes de dibujo');
  assert.ok(
    ctx.llamadas.some(([nombre]) => nombre === 'translate'),
    'el nivel se dibuja con la cámara aplicada'
  );
  assert.ok(
    ctx.llamadas.some(([nombre]) => nombre === 'fillText'),
    'el HUD debe escribir texto'
  );
});

test('las etiquetas se pueden apagar (no son parte del juego final)', () => {
  const { escena } = correr(0, {});
  const conEtiquetas = contextoFalso();
  escena.dibujar(conEtiquetas);

  escena.etiquetas = false;
  const sinEtiquetas = contextoFalso();
  escena.dibujar(sinEtiquetas);

  const textos = (ctx) => ctx.llamadas.filter(([nombre]) => nombre === 'fillText').length;
  assert.ok(textos(conEtiquetas) > textos(sinEtiquetas));
});
