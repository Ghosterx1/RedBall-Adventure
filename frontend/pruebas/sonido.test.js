import test from 'node:test';
import assert from 'node:assert/strict';

import { AUDIO } from '../src/config/ajustes.js';
import { Sonido, crearContexto } from '../src/audio/Sonido.js';
import { audioFalso } from './ayudas/audio-falso.js';

/**
 * Sonido: la capa se prueba con un contexto falso, así se comprueba QUÉ notas
 * se programan. Y, sobre todo, que sin Web Audio no rompe nada.
 */

test('sin Web Audio no suena, pero tampoco falla', () => {
  const sonido = new Sonido();

  assert.equal(sonido.disponible, false);
  assert.equal(sonido.moneda(), false);
  assert.doesNotThrow(() => sonido.desbloquear());
  assert.equal(sonido.disponible, false, 'sigue sin contexto: no hay Web Audio');
});

test('crearContexto() usa el constructor del navegador y sobrevive a los fallos', () => {
  let creados = 0;
  class Fabrica {
    constructor() {
      creados += 1;
      this.state = 'running';
      this.currentTime = 0;
    }
  }

  assert.ok(crearContexto({ AudioContext: Fabrica }) instanceof Fabrica);
  assert.ok(crearContexto({ webkitAudioContext: Fabrica }) instanceof Fabrica);
  assert.equal(creados, 2);

  assert.equal(crearContexto({}), null, 'sin constructor no hay contexto');
  assert.equal(
    crearContexto({
      AudioContext: class {
        constructor() {
          throw new Error('el navegador no deja crear más contextos');
        }
      }
    }),
    null,
    'si el navegador lo niega, se devuelve null en vez de lanzar'
  );
});

test('la moneda son dos notas cortas, agudas y encadenadas', () => {
  const contexto = audioFalso();
  const sonido = new Sonido({ contexto });

  assert.equal(sonido.disponible, true);
  assert.equal(sonido.moneda(), true);
  assert.equal(sonido.sonidos, 1);

  assert.equal(contexto.osciladores.length, 2, 'dos notas');
  const [primera, segunda] = contexto.osciladores;

  assert.equal(primera.notas[0][0], AUDIO.MONEDA_TONOS[0]);
  assert.equal(segunda.notas[0][0], AUDIO.MONEDA_TONOS[1]);
  assert.equal(primera.notas[0][1], 0, 'la primera suena ya');
  assert.ok(
    Math.abs(segunda.notas[0][1] - AUDIO.MONEDA_SEPARACION) < 1e-9,
    'la segunda arranca con el retardo configurado'
  );

  for (const oscilador of contexto.osciladores) {
    assert.equal(oscilador.type, 'square');
    assert.ok(oscilador.arrancado !== null && oscilador.parado > oscilador.arrancado);
  }

  assert.equal(contexto.ganancias.length, 2, 'cada nota lleva su envolvente');
  for (const ganancia of contexto.ganancias) {
    assert.deepEqual(
      ganancia.envolvente.map(([etapa]) => etapa),
      ['inicio', 'ataque', 'caida'],
      'ataque rápido y caída exponencial: sin "clic"'
    );
    assert.equal(ganancia.conectado, contexto.destination, 'llega a la salida');
  }
});

test('dos monedas en el mismo instante no apilan osciladores', () => {
  const contexto = audioFalso();
  const sonido = new Sonido({ contexto });

  assert.equal(sonido.moneda(), true);
  assert.equal(sonido.moneda(), false, 'el enfriamiento evita el "doble blip"');

  contexto.currentTime = AUDIO.MONEDA_INTERVALO_MINIMO;
  assert.equal(sonido.moneda(), true, 'pasado el enfriamiento vuelve a sonar');
  assert.equal(contexto.osciladores.length, 4);
});

test('silenciar() apaga los efectos sin romper la interfaz', () => {
  const contexto = audioFalso();
  const sonido = new Sonido({ contexto });

  sonido.silenciar();
  assert.equal(sonido.moneda(), false);
  assert.equal(contexto.osciladores.length, 0);

  sonido.silenciar(false);
  assert.equal(sonido.moneda(), true);
});

test('desbloquear() reanuda el contexto que el navegador suspendió', () => {
  const contexto = audioFalso();
  contexto.state = 'suspended';
  const sonido = new Sonido({ contexto });

  sonido.desbloquear();

  assert.equal(contexto.reanudado, 1, 'un gesto del usuario devuelve el audio');
});
