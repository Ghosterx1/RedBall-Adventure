import test from 'node:test';
import assert from 'node:assert/strict';

import { PANTALLAS, Partida, TRANSICIONES } from '../src/nucleo/Partida.js';

/**
 * Máquina de pantallas: qué se puede alcanzar desde dónde. Es lo que impide
 * estados imposibles (pausa + victoria a la vez) sin repartir booleanos por
 * todo el código.
 */

test('la partida empieza en el título y congela el bucle', () => {
  const partida = new Partida();

  assert.equal(partida.pantalla, PANTALLAS.TITULO);
  assert.equal(partida.congelada, true);
  assert.equal(partida.enJuego, false);
  assert.equal(partida.terminada, false);
});

test('desde el título se puede ir a niveles o empezar a jugar', () => {
  const partida = new Partida();

  assert.equal(partida.puedeIr(PANTALLAS.NIVELES), true);
  assert.equal(partida.puedeIr(PANTALLAS.JUEGO), true);
  assert.equal(partida.puedeIr(PANTALLAS.PAUSA), false);
  assert.equal(partida.puedeIr(PANTALLAS.VICTORIA), false);
  assert.equal(partida.puedeIr('inventada'), false, 'una pantalla que no existe se rechaza');

  assert.equal(partida.ir('inventada'), false);
  assert.equal(partida.pantalla, PANTALLAS.TITULO, 'una transición ilegal no cambia nada');
});

test('jugar, pausar y reanudar van y vuelven sin perder el hilo', () => {
  const partida = new Partida();

  assert.equal(partida.jugar(), true);
  assert.equal(partida.pantalla, PANTALLAS.JUEGO);
  assert.equal(partida.congelada, false, 'jugando el bucle NO se congela');
  assert.equal(partida.enJuego, true);

  assert.equal(partida.pausar(), true);
  assert.equal(partida.pantalla, PANTALLAS.PAUSA);
  assert.equal(partida.congelada, true);
  assert.equal(partida.enJuego, true, 'seguimos dentro de la partida');

  assert.equal(partida.reanudar(), true);
  assert.equal(partida.pantalla, PANTALLAS.JUEGO);
  assert.equal(partida.congelada, false);
});

test('no se puede ganar ni perder si no se está jugando', () => {
  const partida = new Partida();

  assert.equal(partida.ganar(), false);
  assert.equal(partida.perder(), false);
  assert.equal(partida.pantalla, PANTALLAS.TITULO);

  partida.jugar();
  partida.pausar();
  assert.equal(partida.ganar(), false, 'desde la pausa no se gana el nivel');

  partida.reanudar();
  assert.equal(partida.ganar(), true);
  assert.equal(partida.pantalla, PANTALLAS.VICTORIA);
  assert.equal(partida.terminada, true);
  assert.equal(partida.congelada, true);
});

test('de la victoria y de la derrota se sale a jugar, a niveles o al título', () => {
  for (const final of [PANTALLAS.VICTORIA, PANTALLAS.DERROTA]) {
    for (const destino of [PANTALLAS.JUEGO, PANTALLAS.NIVELES, PANTALLAS.TITULO]) {
      const partida = new Partida();
      partida.jugar();
      partida.ir(final);

      assert.equal(partida.puedeIr(destino), true, `${final} → ${destino} debería ser legal`);
      assert.equal(partida.ir(destino), true);
      assert.equal(partida.pantalla, destino);
    }

    const partida = new Partida();
    partida.jugar();
    partida.ir(final);
    assert.equal(partida.puedeIr(PANTALLAS.PAUSA), false, `desde ${final} no se pausa`);
    assert.equal(partida.puedeIr(PANTALLAS.VICTORIA), final === PANTALLAS.VICTORIA);
  }
});

test('irse a la pantalla en la que ya estamos siempre se acepta', () => {
  const partida = new Partida();

  assert.equal(partida.puedeIr(PANTALLAS.TITULO), true);
  assert.equal(partida.ir(PANTALLAS.TITULO), true);
  assert.equal(partida.pantalla, PANTALLAS.TITULO);
});

test('los récords se consultan desde el título y solo se sale al título', () => {
  const partida = new Partida();

  assert.equal(partida.verRecords(), true);
  assert.equal(partida.pantalla, PANTALLAS.RECORDS);
  assert.equal(partida.congelada, true, 'mirar la tabla no simula nada');
  assert.equal(partida.enJuego, false);
  assert.equal(partida.terminada, false);
  assert.equal(partida.puedeIr(PANTALLAS.NIVELES), false, 'no se salta de récords a niveles');
  assert.equal(partida.puedeIr(PANTALLAS.JUEGO), false, 'ni se empieza a jugar desde la tabla');
  assert.equal(partida.volverAlTitulo(), true);

  // Y desde el título se entra y se sale las veces que haga falta.
  assert.equal(partida.verRecords(), true);
  assert.equal(partida.pantalla, PANTALLAS.RECORDS);
});

test('para ver los récords hay que estar en el título (no se interrumpe una partida)', () => {
  const partida = new Partida();
  partida.jugar();

  assert.equal(partida.verRecords(), false, 'jugando no se abre la tabla');
  assert.equal(partida.pantalla, PANTALLAS.JUEGO);

  partida.pausar();
  assert.equal(partida.verRecords(), false, 'ni desde el menú de pausa');
  assert.equal(partida.pantalla, PANTALLAS.PAUSA);
});

test('la tabla de transiciones solo usa pantallas que existen', () => {
  const validas = Object.values(PANTALLAS);

  for (const [origen, destinos] of Object.entries(TRANSICIONES)) {
    assert.ok(validas.includes(origen), `origen desconocido: ${origen}`);
    for (const destino of destinos) {
      assert.ok(validas.includes(destino), `${origen} apunta a una pantalla inexistente: ${destino}`);
    }
  }
  assert.deepEqual(Object.keys(TRANSICIONES).sort(), [...validas].sort(), 'faltan pantallas');
});

test('un constructor con datos raros cae al título', () => {
  assert.equal(new Partida({ pantalla: PANTALLAS.PAUSA }).pantalla, PANTALLAS.PAUSA);
  assert.equal(new Partida({ pantalla: 'nada' }).pantalla, PANTALLAS.TITULO);
  assert.equal(new Partida({ pantalla: null }).pantalla, PANTALLAS.TITULO);
});
