import test from 'node:test';
import assert from 'node:assert/strict';

import { Jugador } from '../src/entidades/Jugador.js';
import { FISICA, MUNDO, PASO_FIJO } from '../src/config/ajustes.js';

/**
 * Contrato del personaje: gravedad, aceleración, fricción, salto (alto y corto,
 * coyote y buffer), impulso, rebote y detección de suelo. Paso fijo de 1/60 s.
 */

const LADO = 24;
const SUELO_Y = 300;
const SUELO = Object.freeze({ x: 0, y: SUELO_Y, ancho: 1000, alto: 40, material: 'cesped' });
const LIMITES = Object.freeze({ ancho: 1000, alto: 600 });

const control = (extra = {}) => ({
  eje: 0,
  salto: false,
  saltoMantenido: false,
  impulso: false,
  ...extra
});

const nuevo = (extra = {}) =>
  new Jugador({ x: 100, y: SUELO_Y - LADO, ancho: LADO, alto: LADO, enSuelo: true, ...extra });

/** Un paso de simulación de 1/60 s. */
function paso(jugador, opciones = {}, solidos = [SUELO]) {
  jugador.actualizar(PASO_FIJO, { control: control(opciones), solidos, limites: LIMITES });
  return jugador;
}

test('en reposo no se hunde, no vibra y siempre detecta suelo', () => {
  const j = nuevo();
  const alturas = new Set();

  for (let i = 0; i < 600; i++) {
    paso(j);
    assert.equal(j.enSuelo, true, `paso ${i}: debe seguir apoyado`);
    assert.equal(j.vy, 0, `paso ${i}: no debe acumular velocidad de caída`);
    alturas.add(j.y);
  }

  assert.deepEqual([...alturas], [SUELO_Y - LADO], 'la altura debe ser idéntica en los 600 pasos');
});

test('el salto mantenido alcanza el ápice del prototipo', () => {
  const j = nuevo();
  const y0 = j.y;
  let minimo = y0;
  let enAire = 0;

  paso(j, { salto: true, saltoMantenido: true });
  assert.ok(j.vy < 0, 'el primer paso ya debe subir');

  for (let i = 0; i < 70; i++) {
    paso(j, { saltoMantenido: true });
    if (!j.enSuelo) enAire++;
    if (j.y < minimo) minimo = j.y;
  }

  const apice = y0 - minimo;
  assert.ok(Math.abs(apice - 84.18) < 0.05, `ápice: ${apice.toFixed(3)} px`);
  assert.ok(Math.abs(enAire - 46) <= 2, `pasos en el aire: ${enAire}`);
  assert.equal(j.enSuelo, true, 'debe haber vuelto al suelo');
});

test('soltar el botón recorta el salto (altura variable)', () => {
  const largo = nuevo();
  const corto = nuevo();
  const y0 = largo.y;
  let minLargo = y0;
  let minCorto = y0;

  paso(largo, { salto: true, saltoMantenido: true });
  paso(corto, { salto: true, saltoMantenido: false });

  for (let i = 0; i < 70; i++) {
    paso(largo, { saltoMantenido: true });
    paso(corto);
    if (largo.y < minLargo) minLargo = largo.y;
    if (corto.y < minCorto) minCorto = corto.y;
  }

  const hLargo = y0 - minLargo;
  const hCorto = y0 - minCorto;

  assert.ok(hCorto > 12, `el salto corto no debe ser un tic: ${hCorto.toFixed(1)} px`);
  assert.ok(hCorto < hLargo * 0.45, `corto ${hCorto.toFixed(1)} px vs largo ${hLargo.toFixed(1)} px`);
});

test('desde el borde de una plataforma se puede saltar (coyote time)', () => {
  const borde = [{ x: 0, y: SUELO_Y, ancho: 200, alto: 40, material: 'cesped' }];
  const j = new Jugador({ x: 160, y: SUELO_Y - LADO, ancho: LADO, alto: LADO, enSuelo: true });

  let salio = false;
  for (let i = 0; i < 120 && !salio; i++) {
    paso(j, { eje: 1 }, borde);
    if (!j.enSuelo) salio = true;
  }
  assert.ok(salio, 'debe haberse caído del borde');

  paso(j, { salto: true, saltoMantenido: true }, borde);
  assert.ok(j.vy < 0, `debe saltar justo después de salir (vy = ${j.vy.toFixed(1)})`);
});

test('un salto pulsado antes de aterrizar se ejecuta al tocar el suelo (buffer)', () => {
  const j = new Jugador({ x: 100, y: SUELO_Y - LADO - 40, ancho: LADO, alto: LADO });
  j.vy = 300;

  let pulsado = false;
  let aterrizo = false;
  let saltoTrasAterrizar = false;

  for (let i = 0; i < 60; i++) {
    const cerca = !aterrizo && j.y + j.alto >= SUELO_Y - 6;
    paso(j, { salto: cerca && !pulsado, saltoMantenido: cerca });
    if (cerca) pulsado = true;
    if (j.aterrizo) aterrizo = true;
    else if (aterrizo && j.saltoHecho) saltoTrasAterrizar = true;
  }

  assert.ok(pulsado, 'el salto debe haberse pulsado antes de aterrizar');
  assert.ok(aterrizo, 'debe haber aterrizado');
  assert.ok(saltoTrasAterrizar, 'el buffer debe disparar el salto al tocar el suelo');
});

test('el impulso recorre al menos 60 px y no se encadena', () => {
  const j = nuevo();
  const x0 = j.x;

  paso(j, { impulso: true, eje: 1 });
  let pasosImpulso = 1;
  while (j.enImpulso && pasosImpulso < 60) {
    paso(j);
    pasosImpulso++;
  }

  const distancia = j.x - x0;
  assert.ok(distancia >= 60, `el impulso debe superar 60 px: ${distancia.toFixed(1)}`);
  assert.ok(pasosImpulso <= 12, `no debe durar más de 12 pasos: ${pasosImpulso}`);

  paso(j, { impulso: true, eje: 1 });
  assert.equal(j.enImpulso, false, 'el enfriamiento impide encadenar impulsos');
});

test('la plataforma elástica bota y los rebotes se agotan', () => {
  const elastica = [{ x: 0, y: SUELO_Y, ancho: 400, alto: 40, material: 'blando' }];
  const j = new Jugador({ x: 60, y: 200, ancho: LADO, alto: LADO });
  j.vy = 300;

  let rebotes = 0;
  for (let i = 0; i < 240; i++) {
    paso(j, {}, elastica);
    if (j.reboto) {
      rebotes++;
      assert.ok(j.vy < 0, 'tras botar debe subir');
      assert.equal(j.enSuelo, false, 'mientras bota no está apoyado');
    }
  }

  assert.ok(rebotes >= 1, 'debe botar al menos una vez');
  assert.equal(j.enSuelo, true, 'los rebotes deben terminar en reposo');
  assert.equal(j.vy, 0);
});

test('la velocidad horizontal se limita al máximo y el hielo frena menos', () => {
  const j = nuevo();
  for (let i = 0; i < 120; i++) paso(j, { eje: 1 });
  assert.equal(j.vx, FISICA.VELOCIDAD_MAXIMA);

  const deslizamiento = (material) => {
    const solido = [{ ...SUELO, material }];
    const bola = nuevo();
    for (let i = 0; i < 60; i++) paso(bola, { eje: 1 }, solido);
    const xFin = bola.x;
    for (let i = 0; i < 30; i++) paso(bola, {}, solido);
    return bola.x - xFin;
  };

  assert.ok(
    deslizamiento('hielo') > deslizamiento('cesped') * 1.5,
    'el hielo debe dejar deslizar bastante más'
  );
});

test('la superficie elástica rebota más alto que el material blando y se acota', () => {
  /** Altura máxima que alcanza la bola al caer sobre `solido`, medida desde el reposo. */
  const reposo = SUELO_Y - LADO;
  const alturaDelBote = (solido) => {
    const j = new Jugador({ x: 60, y: reposo, ancho: LADO, alto: LADO });
    j.vy = 300;
    let minimo = j.y;

    for (let i = 0; i < 200; i++) {
      paso(j, {}, [solido]);
      if (j.y < minimo) minimo = j.y;
    }
    return reposo - minimo;
  };

  const blando = alturaDelBote({ x: 0, y: SUELO_Y, ancho: 400, alto: 40, material: 'blando' });
  const trampolin = {
    x: 0,
    y: SUELO_Y,
    ancho: 400,
    alto: 40,
    material: 'elastico',
    restitucion: MUNDO.REBOTE_ELASTICA,
    impulsoRebote: MUNDO.IMPULSO_ELASTICA
  };
  const elastica = alturaDelBote(trampolin);

  assert.ok(blando > 1, `el material blando debe botar algo: ${blando.toFixed(1)} px`);
  assert.ok(
    elastica > blando * 1.5,
    `la elástica debe subir mucho más: ${elastica.toFixed(1)} vs ${blando.toFixed(1)}`
  );

  // Nunca se supera el tope: 420 · 1,2 + 140 = 644 pediría más de 620.
  const j = new Jugador({ x: 60, y: SUELO_Y - LADO - 2, ancho: LADO, alto: LADO });
  j.vy = 5000;
  paso(j, {}, [trampolin]);
  assert.equal(j.reboto, true, 'debe botar');
  assert.ok(-j.vy <= MUNDO.REBOTE_MAXIMO, `salida acotada: ${j.vy}`);
});

test('el impulso vuelve a estar disponible tras su enfriamiento', () => {
  const j = nuevo();
  paso(j, { impulso: true, eje: 1 });
  while (j.enImpulso) paso(j);

  // Justo después no se puede encadenar…
  paso(j, { impulso: true, eje: 1 });
  assert.equal(j.enImpulso, false);

  // …pero tras el enfriamiento sí.
  const pasos = Math.ceil(FISICA.IMPULSO_ENFRIAMIENTO / PASO_FIJO) + 2;
  for (let i = 0; i < pasos; i++) paso(j);
  paso(j, { impulso: true, eje: 1 });
  assert.equal(j.enImpulso, true, 'el impulso debe recargarse');
});

test('el impulso no permite atravesar una pared', () => {
  const mundo = [
    { x: 0, y: SUELO_Y, ancho: 1000, alto: 40, material: 'cesped' },
    { x: 220, y: SUELO_Y - 120, ancho: 16, alto: 120, material: 'piedra' }
  ];
  const j = nuevo();

  for (let i = 0; i < 40; i++) paso(j, { impulso: i === 0, eje: 1 }, mundo);

  assert.ok(j.x + LADO <= 220 + 1e-9, `debe quedar antes de la pared: ${j.x.toFixed(2)}`);
  assert.equal(j.empujado, 1, 'debe notar la pared a su derecha');
});
