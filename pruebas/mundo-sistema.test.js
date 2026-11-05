import test from 'node:test';
import assert from 'node:assert/strict';

import { MUNDO, PASO_FIJO } from '../src/config/ajustes.js';
import { Jugador } from '../src/entidades/Jugador.js';
import { Mundo } from '../src/mundo/Mundo.js';
import { NIVEL_DEMO } from '../src/mundo/niveles/demo.js';

/**
 * Contrato de Mundo: agrega objetos por CAPACIDAD (nunca por tipo), transporta
 * pasajeros de plataformas móviles y decide qué pasa en las zonas (checkpoint,
 * peligro, caída). Todo con datos puros de nivel.
 */

const LADO = 24;
const SUELO = 300;

const mundoDePrueba = () =>
  new Mundo({
    nombre: 'prueba',
    ancho: 400,
    alto: 400,
    inicio: { x: 40, y: SUELO },
    objetos: [
      { tipo: 'plataforma', x: 0, y: SUELO, ancho: 400, alto: 100, material: 'cesped' },
      { tipo: 'checkpoint', x: 200, y: SUELO - 34, ancho: 14, alto: 34 },
      { tipo: 'peligro', x: 320, y: SUELO - 8, ancho: 40, alto: 8, forma: 'pinchos' }
    ]
  });

const jugadorEn = (x, y) => new Jugador({ x, y, ancho: LADO, alto: LADO });

/** Un paso completo, en el mismo orden que la escena real. */
function paso(mundo, jugador, control = {}) {
  mundo.actualizar(PASO_FIJO);
  jugador.actualizar(PASO_FIJO, {
    control: { eje: 0, salto: false, saltoMantenido: false, impulso: false, ...control },
    solidos: mundo.solidos,
    superficies: mundo.superficies,
    limites: mundo.limites
  });
  return mundo.revisar(jugador);
}

test('el mundo clasifica sus objetos por capacidad, no por tipo', () => {
  const mundo = mundoDePrueba();

  assert.equal(mundo.solidos.length, 1, 'solo la plataforma del suelo bloquea');
  assert.equal(mundo.peligros.length, 1);
  assert.equal(mundo.checkpoints.length, 1);
  assert.equal(mundo.superficies.length, 0, 'este mundo no tiene rampas');
  assert.deepEqual(mundo.limites, { ancho: 400, alto: 400 });
  assert.equal(mundo.delTipo('checkpoint').length, 1);
});

test('el jugador aterriza en el mundo y no lo atraviesa', () => {
  const mundo = mundoDePrueba();
  const jugador = jugadorEn(40, SUELO - LADO - 60);

  for (let i = 0; i < 40; i++) paso(mundo, jugador);

  assert.equal(jugador.y + LADO, SUELO, 'se apoya exactamente en el suelo');
  assert.equal(jugador.enSuelo, true);
});

test('una plataforma móvil transporta a quien va encima', () => {
  const mundo = new Mundo({
    objetos: [
      { tipo: 'movil', x: 100, y: 260, ancho: 48, alto: 8, eje: 'y', recorrido: 30, velocidad: 30 }
    ]
  });
  const pasajero = jugadorEn(110, 260 - LADO); // pies justo encima
  const ajeno = jugadorEn(300, 100); // lejos: no lo toca nada

  const antes = pasajero.y;
  mundo.actualizar(PASO_FIJO);

  const arrastre = mundo.transportePara(pasajero);
  assert.ok(arrastre.dy > 0, 'la plataforma baja y arrastra al pasajero');
  assert.deepEqual(mundo.transportePara(ajeno), { dx: 0, dy: 0 });

  pasajero.y += arrastre.dy;
  assert.ok(pasajero.y > antes);
  assert.ok(Math.abs(pasajero.y + LADO - mundo.solidos[0].y) < 1e-9, 'sigue en contacto');
});

test('al tocar un checkpoint se fija el punto de reaparición', () => {
  const mundo = mundoDePrueba();
  const jugador = jugadorEn(202, SUELO - 34);

  const evento = mundo.revisar(jugador);

  assert.equal(evento.checkpoint, mundo.checkpoints[0]);
  assert.equal(mundo.checkpoint, mundo.checkpoints[0]);
  assert.equal(mundo.checkpoints[0].activo, true);
  assert.deepEqual(mundo.reaparicion(), { x: 207, y: SUELO });
});


test('un peligro reinicia al jugador en el último checkpoint', () => {
  const mundo = mundoDePrueba();
  const jugador = jugadorEn(330, SUELO - 8);
  mundo.revisar(jugadorEn(202, SUELO - 34)); // activa el checkpoint intermedio

  const evento = mundo.revisar(jugador);

  assert.equal(evento.reiniciado, true);
  assert.equal(evento.peligro, mundo.peligros[0]);
  assert.equal(mundo.reinicios, 1);
  assert.equal(jugador.x, 207 - LADO / 2, 'reaparece en el checkpoint');
  assert.equal(jugador.y + LADO, SUELO);
  assert.equal(jugador.vx, 0);
  assert.equal(jugador.vy, 0);
});

test('caerse por debajo del nivel también reinicia', () => {
  const mundo = mundoDePrueba();
  const jugador = jugadorEn(40, mundo.alto + MUNDO.CAIDA_MARGEN + 10);

  const evento = mundo.revisar(jugador);

  assert.equal(evento.reiniciado, true);
  assert.equal(evento.peligro.motivo, 'caida');
  assert.deepEqual(mundo.reaparicion(), mundo.inicio);
  assert.equal(jugador.y + LADO, mundo.inicio.y);
});

test('pisar una efímera avisa al objeto y lo saca de los sólidos al ocultarse', () => {
  const mundo = new Mundo({
    ancho: 400,
    alto: 400,
    inicio: { x: 40, y: SUELO },
    objetos: [{ tipo: 'efimera', x: 0, y: SUELO, ancho: 200, alto: 8 }]
  });
  const efimera = mundo.objetos[0];
  const jugador = jugadorEn(40, SUELO - LADO);

  paso(mundo, jugador);
  assert.ok(efimera.cuenta > 0, 'el contacto de suelo dispara la cuenta atrás');
  assert.equal(mundo.solidos.length, 1);

  for (let i = 0; i < 60; i++) paso(mundo, jugador);
  assert.equal(efimera.estado, 'oculta');
  assert.equal(mundo.solidos.length, 0, 'oculta ya no está en la lista de sólidos');
});

test('reiniciar devuelve el mundo y los objetos a su estado inicial', () => {
  const mundo = mundoDePrueba();
  const jugador = jugadorEn(330, SUELO - 8);

  paso(mundo, jugador, { eje: 1 });
  mundo.reiniciar();

  assert.equal(mundo.tiempo, 0);
  assert.equal(mundo.reinicios, 0);
  assert.equal(mundo.checkpoint, null);
  assert.equal(mundo.checkpoints[0].activo, false);
});

test('el nivel de demostración contiene las diez mecánicas y datos válidos', () => {
  const mundo = new Mundo(NIVEL_DEMO);
  const tipos = new Set(mundo.objetos.map((objeto) => objeto.tipo));

  for (const tipo of [
    'plataforma',
    'plataformaElevada',
    'rampa',
    'elastica',
    'movil',
    'efimera',
    'obstaculo',
    'obstaculoMovil',
    'peligro',
    'checkpoint'
  ]) {
    assert.ok(tipos.has(tipo), `falta el tipo "${tipo}" en el nivel`);
  }

  for (const objeto of mundo.objetos) {
    for (const clave of ['x', 'y', 'ancho', 'alto']) {
      assert.ok(Number.isFinite(objeto[clave]), `${objeto.tipo}.${clave} debe ser finito`);
    }
    assert.ok(
      objeto.x >= 0 && objeto.x + objeto.ancho <= mundo.ancho,
      `${objeto.tipo} se sale del nivel`
    );
  }

  assert.ok(mundo.superficies.length > 0, 'la rampa debe aparecer como superficie');
  assert.equal(mundo.peligros.length, 3, 'agua, pinchos y obstáculo móvil');
});

test('el jugador empieza de pie en el nivel de demostración', () => {
  const mundo = new Mundo(NIVEL_DEMO);
  const jugador = jugadorEn(mundo.inicio.x - LADO / 2, mundo.inicio.y - LADO);

  for (let i = 0; i < 30; i++) paso(mundo, jugador);

  assert.equal(jugador.enSuelo, true);
  assert.equal(jugador.y + LADO, mundo.inicio.y);
  assert.equal(mundo.reinicios, 0);
});
