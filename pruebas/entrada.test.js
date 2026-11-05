import test from 'node:test';
import assert from 'node:assert/strict';

import { Entrada, ACCIONES, MAPA_POR_DEFECTO } from '../src/nucleo/Entrada.js';

/** Objetivo falso: registra oyentes y permite emitir eventos sin DOM. */
class ObjetivoFalso {
  constructor() {
    this.oyentes = new Map();
  }

  addEventListener(tipo, fn) {
    if (!this.oyentes.has(tipo)) this.oyentes.set(tipo, new Set());
    this.oyentes.get(tipo).add(fn);
  }

  removeEventListener(tipo, fn) {
    this.oyentes.get(tipo)?.delete(fn);
  }

  emitir(tipo, evento = {}) {
    for (const fn of this.oyentes.get(tipo) ?? []) fn(evento);
  }

  get contar() {
    let total = 0;
    for (const conjunto of this.oyentes.values()) total += conjunto.size;
    return total;
  }
}

function crearEntrada(opciones = {}) {
  const objetivo = new ObjetivoFalso();
  const entrada = new Entrada({ objetivo, documento: null, ...opciones });
  entrada.conectar();
  return { entrada, objetivo };
}

const tecla = (code, extra = {}) => {
  let prevenido = false;
  const evento = {
    code,
    repeat: false,
    preventDefault: () => {
      prevenido = true;
    },
    ...extra
  };
  return { evento, get prevenido() { return prevenido; } };
};

test('el mapa por defecto cubre las acciones del juego', () => {
  for (const accion of Object.values(ACCIONES)) {
    assert.ok(Array.isArray(MAPA_POR_DEFECTO[accion]), `falta la acción "${accion}"`);
    assert.ok(MAPA_POR_DEFECTO[accion].length > 0);
  }
});

test('traduce códigos de tecla a acciones y mantiene varias teclas por acción', () => {
  const { entrada, objetivo } = crearEntrada();

  objetivo.emitir('keydown', tecla('ArrowRight').evento);
  assert.equal(entrada.ejeHorizontal(), 1);

  objetivo.emitir('keydown', tecla('KeyD').evento);
  assert.equal(entrada.ejeHorizontal(), 1, 'dos teclas de la misma acción no se anulan');

  objetivo.emitir('keyup', tecla('ArrowRight').evento);
  assert.equal(entrada.ejeHorizontal(), 1, 'sigue pulsada KeyD');

  objetivo.emitir('keyup', tecla('KeyD').evento);
  assert.equal(entrada.ejeHorizontal(), 0);
});

test('izquierda y derecha a la vez se anulan', () => {
  const { entrada, objetivo } = crearEntrada();
  objetivo.emitir('keydown', tecla('ArrowLeft').evento);
  objetivo.emitir('keydown', tecla('ArrowRight').evento);
  assert.equal(entrada.ejeHorizontal(), 0);
});

test('recienPresionada dura un solo paso', () => {
  const { entrada, objetivo } = crearEntrada();

  objetivo.emitir('keydown', tecla('Space').evento);
  assert.equal(entrada.recienPresionada(ACCIONES.SALTO), true);
  assert.equal(entrada.estaPresionada(ACCIONES.SALTO), true);

  entrada.terminarCuadro();
  assert.equal(entrada.recienPresionada(ACCIONES.SALTO), false, 'ya no es "recién"');
  assert.equal(entrada.estaPresionada(ACCIONES.SALTO), true, 'sigue mantenida');

  objetivo.emitir('keyup', tecla('Space').evento);
  assert.equal(entrada.estaPresionada(ACCIONES.SALTO), false);
});

test('la repetición automática del teclado no genera pulsaciones nuevas', () => {
  const { entrada, objetivo } = crearEntrada();
  objetivo.emitir('keydown', tecla('Space').evento);
  entrada.terminarCuadro();

  objetivo.emitir('keydown', tecla('Space', { repeat: true }).evento);
  assert.equal(entrada.recienPresionada(ACCIONES.SALTO), false);
});

test('bloquea el scroll con las teclas de movimiento', () => {
  const { objetivo } = crearEntrada();

  const espacio = tecla('Space');
  objetivo.emitir('keydown', espacio.evento);
  assert.equal(espacio.prevenido, true);

  const letra = tecla('KeyX');
  objetivo.emitir('keydown', letra.evento);
  assert.equal(letra.prevenido, false, 'X no necesita preventDefault');
});

test('perder el foco suelta todas las teclas y avisa', () => {
  let avisos = 0;
  const { entrada, objetivo } = crearEntrada({ alPerderFoco: () => avisos++ });

  objetivo.emitir('keydown', tecla('ArrowRight').evento);
  objetivo.emitir('keydown', tecla('Space').evento);
  assert.equal(entrada.ejeHorizontal(), 1);

  objetivo.emitir('blur');
  assert.equal(entrada.ejeHorizontal(), 0, 'no deben quedar teclas pegadas');
  assert.equal(entrada.estaPresionada(ACCIONES.SALTO), false);
  assert.equal(avisos, 1);
});

test('desconectar elimina todos los oyentes', () => {
  const { entrada, objetivo } = crearEntrada();
  assert.ok(objetivo.contar > 0);
  entrada.desconectar();
  assert.equal(objetivo.contar, 0);
  assert.equal(entrada.conectada, false);
});

test('conectar dos veces no duplica oyentes', () => {
  const { entrada, objetivo } = crearEntrada();
  const antes = objetivo.contar;
  entrada.conectar();
  assert.equal(objetivo.contar, antes);
});
