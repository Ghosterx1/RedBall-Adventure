import test from 'node:test';
import assert from 'node:assert/strict';

import { NORMAL, esSolido, haySuelo, moverEnEje, resolver } from '../src/fisica/Colisiones.js';
import { solapan } from '../src/fisica/aabb.js';
import { MUNDO } from '../src/config/ajustes.js';

/**
 * Contrato de Colisiones: barrido por eje contra sólidos estáticos.
 * Lo que se exige aquí es exactamente lo que el jugador nota: no atravesar,
 * no vibrar y no quedarse enganchado.
 */

const LADO = 24;
const SUELO = Object.freeze({ x: 0, y: 200, ancho: 400, alto: 40, material: 'cesped' });
const cuerpo = (x, y) => ({ x, y, ancho: LADO, alto: LADO });

test('no se atraviesa una plataforma aunque el paso sea enorme', () => {
  const bola = cuerpo(100, 100);
  const contactos = resolver(bola, { dy: 400 }, [SUELO]); // 400 px en un solo paso

  assert.equal(bola.y + LADO, 200, 'debe quedar apoyada exactamente encima');
  assert.equal(contactos.length, 1);
  assert.equal(contactos[0].eje, 'y');
  assert.deepEqual(contactos[0].normal, NORMAL.ARRIBA);
  assert.equal(contactos[0].solido, SUELO);
  assert.equal(contactos[0].material, 'cesped');
});

test('no se atraviesa una pared a alta velocidad', () => {
  const pared = { x: 200, y: 0, ancho: 40, alto: 400, material: 'piedra' };
  const bola = cuerpo(100, 100);
  const contactos = moverEnEje(bola, 'x', 120, [pared]); // 120 px de golpe

  assert.equal(bola.x + LADO, 200);
  assert.equal(contactos.length, 1);
  assert.deepEqual(contactos[0].normal, NORMAL.IZQUIERDA);
});

test('el suelo no frena el movimiento horizontal de quien está encima', () => {
  const bola = cuerpo(100, 200 - LADO); // borde inferior justo en el suelo
  const contactos = moverEnEje(bola, 'x', 5, [SUELO]);

  assert.equal(contactos.length, 0, 'el suelo no debe bloquear el eje X');
  assert.equal(bola.x, 105);
});

test('plataforma de un solo sentido: frena al caer y deja pasar al subir', () => {
  const plataforma = { x: 0, y: 200, ancho: 400, alto: 8, material: 'piedra', unSoloSentido: true };

  const cae = cuerpo(100, 160);
  moverEnEje(cae, 'y', 60, [plataforma]);
  assert.equal(cae.y + LADO, 200, 'debe posarse encima al caer');

  const sube = cuerpo(100, 240);
  const contactos = moverEnEje(sube, 'y', -60, [plataforma]);
  assert.equal(contactos.length, 0, 'no debe bloquear desde abajo');
  assert.equal(sube.y, 180);
});

test('el agua no bloquea el paso', () => {
  const agua = { x: 0, y: 200, ancho: 400, alto: 40, material: 'agua' };
  assert.equal(esSolido(agua), false);

  const bola = cuerpo(100, 100);
  const contactos = resolver(bola, { dy: 60 }, [agua]);
  assert.equal(contactos.length, 0);
  assert.equal(bola.y, 160);
});

test('los bordes del mundo frenan sin dejar salir', () => {
  const limites = { ancho: 480, alto: 270 };

  const bola = cuerpo(440, 100); // borde derecho en 464: solo quedan 16 px
  const contactos = moverEnEje(bola, 'x', 50, [], { limites });
  assert.equal(bola.x, 480 - LADO);
  assert.equal(contactos.length, 1);
  assert.equal(contactos[0].esLimite, true);
  assert.deepEqual(contactos[0].normal, NORMAL.IZQUIERDA);

  const arriba = cuerpo(100, 10);
  moverEnEje(arriba, 'y', -50, [], { limites });
  assert.equal(arriba.y, 0, 'el techo del mundo también frena');
});

test('apoyada no se hunde ni vibra en 600 pasos seguidos', () => {
  const bola = cuerpo(100, 200 - LADO);
  const alturas = new Set();
  let conSuelo = 0;

  for (let i = 0; i < 600; i++) {
    // la gravedad empuja 0,32 px hacia abajo en cada paso
    const contactos = resolver(bola, { dy: 0.32 }, [SUELO]);
    if (haySuelo(contactos)) conSuelo++;
    alturas.add(bola.y);
  }

  assert.deepEqual([...alturas], [200 - LADO], 'la posición debe ser idéntica en cada paso');
  assert.equal(conSuelo, 600, 'debe haber contacto de suelo en todos los pasos');
});

/* ───────────── Escalones (capacidad opcional) ─────────────────────────── */

test('un escalón pequeño se sube andando; un muro de verdad no', () => {
  const escalon = { x: 200, y: 196, ancho: 40, alto: 44, material: 'piedra' }; // canto 4 px sobre los pies
  const sube = cuerpo(150, 200 - LADO); // pies en 200
  moverEnEje(sube, 'x', 100, [escalon]);

  assert.equal(sube.y + LADO, 196, 'queda subido sobre el escalón');
  assert.ok(sube.x + LADO > 240, 'y sigue avanzando por encima de él');

  const muro = { x: 200, y: 180, ancho: 40, alto: 60, material: 'piedra' }; // canto 20 px
  const choca = cuerpo(150, 200 - LADO);
  moverEnEje(choca, 'x', 100, [muro]);

  assert.equal(choca.x + LADO, 200, 'un muro de 20 px sí bloquea');
  assert.equal(choca.y + LADO, 200, 'y no se sube a él');
});

test('el umbral del escalón lo fija MUNDO.ESCALON_MAXIMO', () => {
  const justo = { x: 200, y: 200 - MUNDO.ESCALON_MAXIMO, ancho: 40, alto: 100, material: 'piedra' };
  const bola = cuerpo(150, 200 - LADO);
  moverEnEje(bola, 'x', 100, [justo]);
  assert.equal(bola.y + LADO, 200 - MUNDO.ESCALON_MAXIMO, 'sube justo el máximo');

  const pasado = {
    x: 200,
    y: 200 - MUNDO.ESCALON_MAXIMO - 1,
    ancho: 40,
    alto: 100,
    material: 'piedra'
  };
  const otra = cuerpo(150, 200 - LADO);
  moverEnEje(otra, 'x', 100, [pasado]);
  assert.equal(otra.x + LADO, 200, 'uno más alto ya bloquea el paso');
});

test('el escalón se puede desactivar y solo actúa en horizontal', () => {
  const escalon = { x: 200, y: 196, ancho: 40, alto: 44, material: 'piedra' };
  const sinEscalon = cuerpo(150, 200 - LADO);
  const contactos = moverEnEje(sinEscalon, 'x', 100, [escalon], { escalon: 0 });

  assert.equal(sinEscalon.x + LADO, 200, 'con escalon: 0 vuelve a bloquear');
  assert.equal(contactos.length, 1);
  assert.equal(sinEscalon.y + LADO, 200, 'no cambia la altura');
});

test('el contacto de borde exacto no cuenta como solape', () => {
  const a = { x: 0, y: 0, ancho: 10, alto: 10 };
  assert.equal(solapan(a, { x: 10, y: 0, ancho: 10, alto: 10 }), false);
  assert.equal(solapan(a, { x: 9.5, y: 0, ancho: 10, alto: 10 }), true);
});

test('el resultado no depende del orden de los sólidos', () => {
  const a = { x: 200, y: 100, ancho: 40, alto: 40, material: 'piedra' };
  const b = { x: 220, y: 60, ancho: 60, alto: 60, material: 'piedra' };

  const uno = cuerpo(100, 100);
  resolver(uno, { dx: 100 }, [a, b]);
  const dos = cuerpo(100, 100);
  resolver(dos, { dx: 100 }, [b, a]);

  assert.equal(uno.x, dos.x);
  assert.equal(uno.x + LADO, 200, 'debe pararse en el sólido más cercano');
});

test('desplazamiento 0 no genera contactos falsos', () => {
  const bola = cuerpo(100, 200 - LADO);
  assert.equal(resolver(bola, { dx: 0, dy: 0 }, [SUELO]).length, 0);
  assert.equal(resolver(bola, { dx: NaN, dy: Infinity }, [SUELO]).length, 0);
});
