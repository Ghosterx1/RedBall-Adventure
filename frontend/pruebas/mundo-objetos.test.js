import test from 'node:test';
import assert from 'node:assert/strict';

import { contextoFalso } from './ayudas/contexto-falso.js';
import { MUNDO, PASO_FIJO } from '../src/config/ajustes.js';
import {
  Checkpoint,
  Efimera,
  Elastica,
  Movil,
  Obstaculo,
  ObstaculoMovil,
  Peligro,
  Plataforma,
  PlataformaElevada,
  Rampa,
  crearObjeto,
  hayTipo,
  registrarTipo,
  tiposRegistrados
} from '../src/mundo/tipos.js';
import { Mundo } from '../src/mundo/Mundo.js';

/**
 * Contrato de los objetos del mundo: cada tipo declara sus PROPIAS propiedades
 * y capacidades. Lo que se exige aquí es que cada uno sea lo que dice ser y que
 * un tipo nuevo se pueda añadir sin tocar el motor.
 */

const caja = (extra = {}) => ({ x: 0, y: 0, ancho: 48, alto: 8, ...extra });

test('el registro fabrica objetos desde datos y rechaza tipos desconocidos', () => {
  assert.ok(hayTipo('rampa'));
  assert.ok(crearObjeto({ tipo: 'rampa', ...caja() }) instanceof Rampa);
  assert.ok(crearObjeto({ tipo: 'plataforma', ...caja() }) instanceof Plataforma);

  assert.throws(() => crearObjeto({ tipo: 'unicornio' }), /Tipo de objeto desconocido: "unicornio"/);
  assert.ok(tiposRegistrados().length >= 10, 'deben estar los 10 tipos de la fase');
  assert.deepEqual(tiposRegistrados(), [...tiposRegistrados()].sort());
});

test('un tipo nuevo se añade sin tocar el motor: basta registrarlo', () => {
  class Molino extends Plataforma {
    static tipo = 'molino';
    constructor(datos) {
      super(datos);
      this.velocidadGiro = 2;
    }
  }
  registrarTipo(Molino.tipo, (datos) => new Molino(datos));

  // El motor lo usa sin saber que existe: es sólido y entra en el mundo.
  const mundo = new Mundo({ objetos: [{ tipo: 'molino', ...caja() }], ancho: 200, alto: 100 });
  assert.equal(mundo.objetos[0].velocidadGiro, 2);
  assert.equal(mundo.solidos.length, 1);
});

test('plataforma: sólida, con material y opción de no bloquear', () => {
  const normal = new Plataforma({ ...caja(), material: 'hielo' });
  assert.equal(normal.solido, normal, 'la capacidad sólido es el propio objeto');
  assert.equal(normal.material, 'hielo');
  assert.equal(normal.unSoloSentido, false);

  const decorado = new Plataforma({ ...caja(), bloquea: false });
  assert.equal(decorado.solido, null);
  assert.equal(decorado.bloquea, false);
});

test('plataforma elevada: solo bloquea desde arriba', () => {
  const elevada = new PlataformaElevada(caja());
  assert.equal(elevada.unSoloSentido, true);
  assert.equal(elevada.solido, elevada);
});

test('rampa: altura, normal unitaria y nula fuera del tramo', () => {
  const sube = new Rampa({ x: 100, y: 200, ancho: 100, alto: 40, pendiente: 'sube' });
  assert.equal(sube.superficie, sube);
  assert.equal(sube.alturaEn(99), null, 'fuera del tramo no hay superficie');
  assert.equal(sube.alturaEn(201), null);
  assert.equal(sube.alturaEn(100), 200, 'borde izquierdo');
  assert.equal(sube.alturaEn(200), 160, 'borde derecho: 40 px más arriba');
  assert.equal(sube.alturaEn(150), 180, 'punto medio');

  const normal = sube.normalEn(150);
  assert.ok(Math.abs(Math.hypot(normal.x, normal.y) - 1) < 1e-9, 'normal unitaria');
  assert.ok(normal.y < 0, 'empuja hacia arriba (el eje Y crece hacia abajo)');

  const baja = new Rampa({ x: 100, y: 200, ancho: 100, alto: 40, pendiente: 'baja' });
  assert.equal(baja.alturaEn(200), 240);
  assert.equal(baja.pendiente, 'baja');
});

test('elástica: sobreescribe el rebote del material', () => {
  const elastica = new Elastica(caja({ material: 'elastico' }));
  assert.ok(elastica.restitucion > 1, 'una elástica devuelve más energía');
  assert.equal(elastica.restitucion, MUNDO.REBOTE_ELASTICA);
  assert.equal(elastica.impulsoRebote, MUNDO.IMPULSO_ELASTICA);
  assert.equal(elastica.solido, elastica);
});
test('móvil: recorre el vaivén y publica su delta sin depender del refresco', () => {
  const movil = new Movil({ x: 40, y: 100, ancho: 40, alto: 8, eje: 'y', recorrido: 60 });
  movil.actualizar(PASO_FIJO);
  assert.ok(movil.y > 100, 'con recorrido positivo baja (el eje Y crece hacia abajo)');
  assert.ok(movil.delta.dy > 0);
  assert.equal(movil.x, 40, 'en el eje Y no se mueve en horizontal');

  // Un paso de 1/60 y dos de 1/120 dejan la plataforma en el mismo sitio.
  const lento = new Movil({ x: 40, y: 100, ancho: 40, alto: 8, eje: 'y', recorrido: 60 });
  lento.actualizar(PASO_FIJO);
  const rapido = new Movil({ x: 40, y: 100, ancho: 40, alto: 8, eje: 'y', recorrido: 60 });
  rapido.actualizar(PASO_FIJO / 2);
  rapido.actualizar(PASO_FIJO / 2);
  assert.ok(Math.abs(lento.y - rapido.y) < 1e-9, `${lento.y} vs ${rapido.y}`);

  // Un ciclo completo vuelve al origen.
  const pasos = Math.round(movil.vaiven.periodo / PASO_FIJO);
  for (let i = 1; i < pasos; i++) movil.actualizar(PASO_FIJO);
  assert.ok(Math.abs(movil.y - 100) < 1, `vuelve al origen: ${movil.y}`);
});

test('efímera: firme → aviso → oculta → firme, y deja de ser sólida', () => {
  const efimera = new Efimera({ x: 0, y: 0, ancho: 48, alto: 8 });
  assert.equal(efimera.estado, 'firme');
  assert.equal(efimera.solido, efimera);

  assert.equal(efimera.alPisar(), true, 'el primer apoyo arranca la cuenta');
  assert.equal(efimera.alPisar(), false, 'no se reinicia el contador');

  const avanzar = (segundos) => {
    for (let t = 0; t < segundos; t += PASO_FIJO) efimera.actualizar(PASO_FIJO);
  };

  avanzar(MUNDO.EFIMERA_RETARDO + PASO_FIJO);
  assert.equal(efimera.estado, 'aviso');
  assert.equal(efimera.solido, efimera, 'mientras avisa todavía se puede pisar');

  avanzar(MUNDO.EFIMERA_AVISO + PASO_FIJO);
  assert.equal(efimera.estado, 'oculta');
  assert.equal(efimera.solido, null, 'oculta = deja de ser sólida');
  assert.equal(efimera.visible, false);

  avanzar(MUNDO.EFIMERA_REAPARICION + PASO_FIJO);
  assert.equal(efimera.estado, 'firme');
  assert.equal(efimera.solido, efimera);
  assert.equal(efimera.visible, true);
});

test('obstáculos: el estático solo estorba, el móvil además hace daño', () => {
  const estatico = new Obstaculo(caja());
  assert.equal(estatico.solido, estatico);
  assert.equal(estatico.peligro, null);

  const movil = new ObstaculoMovil(caja({ eje: 'x', recorrido: 100 }));
  assert.equal(movil.solido, movil, 'bloquea el paso');
  assert.equal(movil.peligro, movil, 'y reinicia al tocarlo');
  movil.actualizar(PASO_FIJO);
  assert.ok(movil.x > 0, 'se mueve');

  const inofensivo = new ObstaculoMovil(caja({ haceDano: false }));
  assert.equal(inofensivo.peligro, null);
});

test('peligro y checkpoint: zonas, no sólidos', () => {
  const agua = new Peligro({ ...caja(), forma: 'agua' });
  assert.equal(agua.peligro, agua);
  assert.equal(agua.solido, null, 'se puede entrar: no bloquea');
  assert.equal(agua.motivo, 'agua');

  const bandera = new Checkpoint({ x: 10, y: 50, ancho: 14, alto: 34 });
  assert.equal(bandera.checkpoint, bandera);
  assert.deepEqual(bandera.punto, { x: 17, y: 84 }, 'punto de apoyo (pies)');
  assert.equal(bandera.activar(), true);
  assert.equal(bandera.activar(), false, 'solo se enciende una vez');
  assert.equal(bandera.activo, true);
  bandera.reiniciar();
  assert.equal(bandera.activo, false);
});

test('todos los tipos se dibujan sin DOM y sin lanzar errores', () => {
  const objetos = [
    crearObjeto({ tipo: 'plataforma', ...caja() }),
    crearObjeto({ tipo: 'plataformaElevada', ...caja() }),
    crearObjeto({ tipo: 'rampa', ...caja({ alto: 32 }) }),
    crearObjeto({ tipo: 'elastica', ...caja() }),
    crearObjeto({ tipo: 'movil', ...caja({ recorrido: 40 }) }),
    crearObjeto({ tipo: 'efimera', ...caja() }),
    crearObjeto({ tipo: 'obstaculo', ...caja({ alto: 32 }) }),
    crearObjeto({ tipo: 'obstaculoMovil', ...caja({ alto: 16, recorrido: 40 }) }),
    crearObjeto({ tipo: 'peligro', ...caja({ forma: 'pinchos' }) }),
    crearObjeto({ tipo: 'peligro', ...caja({ forma: 'agua' }) }),
    crearObjeto({ tipo: 'peligro', ...caja({ forma: 'banda' }) }),
    crearObjeto({ tipo: 'checkpoint', ...caja({ alto: 34 }) })
  ];

  for (const objeto of objetos) {
    const ctx = contextoFalso();
    objeto.actualizar(PASO_FIJO);
    assert.doesNotThrow(() => objeto.dibujar(ctx), `${objeto.tipo} debe dibujarse`);
    assert.ok(ctx.llamadas.length > 0, `${objeto.tipo} debe emitir órdenes de dibujo`);
  }
});

