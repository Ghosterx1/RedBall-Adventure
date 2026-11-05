import test from 'node:test';
import assert from 'node:assert/strict';

import { Bucle } from '../src/nucleo/Bucle.js';
import { EscenaPrueba } from '../src/escenas/EscenaPrueba.js';
import { FISICA, PASO_FIJO, VISTA } from '../src/config/ajustes.js';

/** Contexto falso: solo comprueba que la escena dibuja sin lanzar errores. */
function contextoFalso() {
  const llamadas = [];
  const registrar = (nombre) => (...args) => llamadas.push([nombre, ...args]);
  return {
    llamadas,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: registrar('fillRect'),
    strokeRect: registrar('strokeRect'),
    clearRect: registrar('clearRect'),
    beginPath: registrar('beginPath'),
    closePath: registrar('closePath'),
    moveTo: registrar('moveTo'),
    lineTo: registrar('lineTo'),
    arc: registrar('arc'),
    ellipse: registrar('ellipse'),
    fill: registrar('fill'),
    stroke: registrar('stroke'),
    fillText: registrar('fillText'),
    save: registrar('save'),
    restore: registrar('restore'),
    translate: registrar('translate'),
    scale: registrar('scale')
  };
}

function juegoFalso({ eje = 0, saltar = false } = {}) {
  return {
    entrada: {
      ejeHorizontal: () => eje,
      recienPresionada: (accion) => accion === 'salto' && saltar,
      // Mantener el salto pulsado = salto largo (sin recorte). Sin esto, el
      // control se interpretaría como "soltado" y el salto quedaría a medias.
      estaPresionada: (accion) => accion === 'salto' && saltar
    }
  };
}

/** Simula `segundos` con el Bucle real (paso fijo) y devuelve el estado final. */
function correr(hercios, segundos, opciones = {}) {
  const escena = new EscenaPrueba();
  const juego = juegoFalso(opciones);
  escena.entrar(juego);

  const bucle = new Bucle({
    actualizar: (dt) => escena.actualizar(dt, juego),
    planificar: () => 0,
    cancelar: () => {}
  });

  const cuadros = Math.round(hercios * segundos);
  for (let i = 0; i <= cuadros; i++) bucle.avanzarHasta((i * 1000) / hercios);

  return { escena, jugador: escena.jugador, pasos: bucle.pasosTotales };
}

test('CRITERIO FASE 1: misma velocidad real a 30, 60 y 144 Hz', () => {
  const a60 = correr(60, 1, { eje: 1 });
  const a144 = correr(144, 1, { eje: 1 });
  const a30 = correr(30, 1, { eje: 1 });

  const unPasoDeMovimiento = FISICA.VELOCIDAD_MAXIMA * PASO_FIJO; // 5 px

  // La velocidad final es la misma: la simulación no depende del refresco.
  assert.equal(a60.jugador.vx, a144.jugador.vx);
  assert.equal(a60.jugador.vx, a30.jugador.vx);

  // La posición solo puede diferir como máximo en la cuantización de un paso.
  assert.ok(
    Math.abs(a60.jugador.x - a144.jugador.x) <= unPasoDeMovimiento,
    `x: 60 Hz=${a60.jugador.x.toFixed(2)} vs 144 Hz=${a144.jugador.x.toFixed(2)}`
  );
  assert.ok(
    Math.abs(a60.jugador.x - a30.jugador.x) <= unPasoDeMovimiento,
    `x: 60 Hz=${a60.jugador.x.toFixed(2)} vs 30 Hz=${a30.jugador.x.toFixed(2)}`
  );
  assert.ok(Math.abs(a60.pasos - a144.pasos) <= 1);
});

test('la bola acelera hasta la velocidad máxima y se detiene en el borde', () => {
  const { jugador } = correr(60, 1, { eje: 1 });

  assert.ok(Math.abs(jugador.vx - FISICA.VELOCIDAD_MAXIMA) < 1e-6, `vx = ${jugador.vx}`);
  assert.ok(jugador.x > 40, 'debe haberse movido a la derecha');
  assert.ok(jugador.x < VISTA.ANCHO - jugador.ancho, 'no debe haber llegado al borde en 1 s');

  const { jugador: pegado } = correr(60, 10, { eje: 1 });
  assert.equal(pegado.x, VISTA.ANCHO - pegado.ancho, 'debe quedarse dentro del lienzo');
  assert.equal(pegado.vx, 0, 'la velocidad se anula contra el borde');
});

test('el rozamiento detiene la bola cuando no hay entrada', () => {
  const escena = new EscenaPrueba();
  const juego = juegoFalso({ eje: 1 });
  escena.entrar(juego);

  for (let i = 0; i < 30; i++) escena.actualizar(PASO_FIJO, juego);
  const vxConImpulso = escena.jugador.vx;
  assert.ok(vxConImpulso > 0);

  juego.entrada.ejeHorizontal = () => 0;
  for (let i = 0; i < 60; i++) escena.actualizar(PASO_FIJO, juego);

  assert.ok(Math.abs(escena.jugador.vx) < 1, `vx tras rozar: ${escena.jugador.vx}`);
});

test('el salto de la escena alcanza el ápice del prototipo', () => {
  const escena = new EscenaPrueba();
  const juego = juegoFalso({ saltar: true });
  escena.entrar(juego);

  const yInicial = escena.jugador.y;
  let yMinima = yInicial;

  for (let i = 0; i < 45; i++) {
    escena.actualizar(PASO_FIJO, juego);
    if (escena.jugador.y < yMinima) yMinima = escena.jugador.y;
  }

  assert.ok(Math.abs(yInicial - yMinima - 84.18) < 0.5, `ápice: ${(yInicial - yMinima).toFixed(2)} px`);
});

test('la escena dibuja sin depender del DOM', () => {
  const { escena } = correr(60, 0.5, { eje: 1 });
  const ctx = contextoFalso();

  assert.doesNotThrow(() => escena.dibujar(ctx));
  assert.ok(ctx.llamadas.length > 10, 'debe emitir varias órdenes de dibujo');
  assert.ok(
    ctx.llamadas.some(([nombre]) => nombre === 'fillText'),
    'debe mostrar las métricas de la fase'
  );
});
