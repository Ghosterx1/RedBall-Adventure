import test from 'node:test';
import assert from 'node:assert/strict';

import { MUNDO, VISTA } from '../src/config/ajustes.js';
import { AVISOS, ERRORES, validarCatalogo, validarNivel } from '../src/mundo/validar.js';
import { SUELO, filaMonedas, meta, moneda, pinchos, suelo } from '../src/mundo/niveles/ayudas.js';

/**
 * El validador convierte los despistes de DATA en una lista de errores y avisos.
 * DISTINCIÓN: un ERROR impide jugar el nivel tal cual; un AVISO solo señala algo
 * que funciona pero probablemente sea un despiste de diseño (meta en el aire,
 * peligro flotante, nivel sin checkpoint…).
 */

const ANCHO = VISTA.ANCHO * 2; // 960: dos pantallas de ancho

/** Nivel mínimo correcto: suelo, dos monedas, meta y objetivo "meta + 2 monedas". */
function nivelValido(extra = {}) {
  return {
    id: 'prueba',
    orden: 1,
    nombre: 'Nivel de prueba',
    dificultad: 1,
    ancho: ANCHO,
    alto: VISTA.ALTO,
    inicio: { x: 40, y: SUELO },
    objetivo: { tipo: 'meta', monedas: 2 },
    objetos: [suelo(0, ANCHO), ...filaMonedas(60, SUELO - 14, 2, 20), meta(ANCHO - 60)],
    ...extra
  };
}

const codigos = (lista) => lista.map((item) => item.codigo);
const tieneError = (resultado, codigo) => codigos(resultado.errores).includes(codigo);
const tieneAviso = (resultado, codigo) => codigos(resultado.avisos).includes(codigo);

test('un nivel bien escrito no tiene ni errores ni avisos', () => {
  const resultado = validarNivel(nivelValido());

  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.errores, []);
  assert.deepEqual(resultado.avisos, []);
  assert.equal(resultado.id, 'prueba');
});

test('sin datos no hay nada que validar', () => {
  for (const datos of [null, undefined, 'un nivel', 42]) {
    const resultado = validarNivel(datos);

    assert.equal(resultado.valido, false);
    assert.equal(resultado.id, null);
    assert.deepEqual(codigos(resultado.errores), [ERRORES.SIN_DATOS]);
  }
});

test('el `id` es obligatorio: es lo que identifica el récord guardado', () => {
  for (const id of [undefined, '', 7]) {
    const resultado = validarNivel(nivelValido({ id }));

    assert.equal(resultado.valido, false);
    assert.ok(tieneError(resultado, ERRORES.SIN_ID));
  }
});

test('las dimensiones tienen que ser números mayores que 0', () => {
  for (const medidas of [{ ancho: 0 }, { ancho: '960' }, { alto: -5 }, { alto: undefined }]) {
    const resultado = validarNivel(nivelValido(medidas));

    assert.equal(resultado.valido, false);
    assert.ok(tieneError(resultado, ERRORES.DIMENSIONES), `medidas ${JSON.stringify(medidas)}`);
  }
});

test('el inicio son los pies del jugador y debe caer dentro del escenario', () => {
  for (const inicio of [undefined, { x: 40 }, { x: -1, y: 100 }, { x: 5000, y: 100 }]) {
    const resultado = validarNivel(nivelValido({ inicio }));

    assert.equal(resultado.valido, false);
    assert.ok(tieneError(resultado, ERRORES.INICIO), `inicio ${JSON.stringify(inicio)}`);
  }
});

test('`objetos` debe ser un array, aunque esté vacío', () => {
  for (const objetos of [null, undefined, 'nada', {}]) {
    const resultado = validarNivel(nivelValido({ objetos }));

    assert.equal(resultado.valido, false);
    assert.ok(tieneError(resultado, ERRORES.SIN_OBJETOS));
  }

  assert.equal(
    tieneError(validarNivel(nivelValido({ objetos: [] })), ERRORES.SIN_OBJETOS),
    false,
    'un array vacío ya es un array (otra cosa es que el nivel tenga sentido)'
  );
});

test('un tipo de objeto desconocido se detecta antes de jugar', () => {
  const resultado = validarNivel(
    nivelValido({
      objetos: [suelo(0, ANCHO), meta(ANCHO - 60), { tipo: 'monedaa', x: 100, y: 100 }]
    })
  );

  assert.equal(resultado.valido, false);
  assert.ok(tieneError(resultado, ERRORES.TIPO_DESCONOCIDO));

  const error = resultado.errores.find((item) => item.codigo === ERRORES.TIPO_DESCONOCIDO);
  assert.equal(error.tipo, 'monedaa');
  assert.equal(error.indice, 2);
});

test('una entrada de `objetos` que no es un objeto de datos también se detecta', () => {
  const resultado = validarNivel(
    nivelValido({ objetos: [null, 42, suelo(0, ANCHO), meta(ANCHO - 60)] })
  );

  assert.equal(resultado.valido, false);
  assert.equal(codigos(resultado.errores).filter((codigo) => codigo === ERRORES.OBJETO).length, 2);
});

test('un objeto sin medidas válidas es un error de caja', () => {
  const sinX = validarNivel(
    nivelValido({
      objetos: [suelo(0, ANCHO), meta(ANCHO - 60), { tipo: 'moneda', x: Number.NaN, y: 100 }]
    })
  );
  const sinAncho = validarNivel(
    nivelValido({
      objetos: [suelo(0, ANCHO), meta(ANCHO - 60), { tipo: 'moneda', x: 100, y: 100, ancho: 0 }]
    })
  );

  assert.ok(tieneError(sinX, ERRORES.CAJA), 'una x que no es número');
  assert.ok(tieneError(sinAncho, ERRORES.CAJA), 'un ancho 0 no es un objeto');
});

test('un objeto que se sale del escenario es un error', () => {
  const resultado = validarNivel(
    nivelValido({ objetos: [suelo(0, ANCHO), meta(ANCHO - 60), moneda(ANCHO + 100, 100)] })
  );

  assert.equal(resultado.valido, false);
  assert.ok(tieneError(resultado, ERRORES.FUERA_DEL_NIVEL));
});

test('un objetivo desconocido es un error (el juego lo degrada, pero es un despiste)', () => {
  const resultado = validarNivel(nivelValido({ objetivo: 'volar' }));

  assert.equal(resultado.valido, false);
  assert.deepEqual(codigos(resultado.errores), [ERRORES.OBJETIVO]);
});

test('pedir la meta en un nivel sin meta es un error', () => {
  const resultado = validarNivel(
    nivelValido({ objetos: [suelo(0, ANCHO), ...filaMonedas(60, SUELO - 14, 2, 20)] })
  );

  assert.equal(resultado.valido, false);
  assert.ok(tieneError(resultado, ERRORES.SIN_META));
});

test('un nivel de monedas necesita monedas', () => {
  const resultado = validarNivel(
    nivelValido({ objetivo: 'monedas', objetos: [suelo(0, ANCHO), meta(ANCHO - 60)] })
  );

  assert.equal(resultado.valido, false);
  assert.ok(tieneError(resultado, ERRORES.SIN_MONEDAS));
});

test('no se pueden pedir más monedas de las que el nivel tiene', () => {
  const resultado = validarNivel(nivelValido({ objetivo: { tipo: 'meta', monedas: 9 } }));

  assert.equal(resultado.valido, false);
  assert.ok(tieneError(resultado, ERRORES.MONEDAS_IMPOSIBLES));
});

test('la dificultad es un entero de 1 a 5', () => {
  for (const dificultad of [0, 6, 2.5, 'alta']) {
    const resultado = validarNivel(nivelValido({ dificultad }));

    assert.equal(resultado.valido, false, `dificultad ${String(dificultad)}`);
    assert.ok(tieneError(resultado, ERRORES.DIFICULTAD));
  }
});

test('el orden, si se indica, no puede ser negativo ni absurdo', () => {
  for (const orden of [-1, 'primero', Number.NaN]) {
    const resultado = validarNivel(nivelValido({ orden }));

    assert.equal(resultado.valido, false, `orden ${String(orden)}`);
    assert.ok(tieneError(resultado, ERRORES.ORDEN));
  }
});

test('los avisos señalan despistes pero no invalidan el nivel', () => {
  const resultado = validarNivel(nivelValido({ nombre: undefined, dificultad: undefined }));

  assert.equal(resultado.valido, true, 'se puede jugar igual');
  assert.deepEqual(
    codigos(resultado.avisos).sort(),
    [AVISOS.SIN_DIFICULTAD, AVISOS.SIN_NOMBRE].sort()
  );
});

test('un escenario más pequeño que la pantalla avisa', () => {
  const resultado = validarNivel(
    nivelValido({
      ancho: 400,
      alto: 150,
      inicio: { x: 40, y: 120 },
      objetos: [
        suelo(0, 400, { y: 120 }),
        moneda(60, 106),
        moneda(80, 106),
        meta(340, { y: 120 - MUNDO.META_ALTO })
      ]
    })
  );

  assert.equal(resultado.valido, true);
  assert.deepEqual(codigos(resultado.avisos), [AVISOS.NIVEL_PEQUENO]);
});

test('un nivel con peligros y sin checkpoint avisa', () => {
  const base = nivelValido();
  const resultado = validarNivel({ ...base, objetos: [...base.objetos, pinchos(500, 40)] });

  assert.equal(resultado.valido, true);
  assert.deepEqual(codigos(resultado.avisos), [AVISOS.SIN_CHECKPOINT]);
});

test('empezar sin suelo debajo avisa (el jugador arranca cayendo)', () => {
  const resultado = validarNivel(nivelValido({ inicio: { x: 40, y: 150 } }));

  assert.equal(resultado.valido, true);
  assert.ok(tieneAviso(resultado, AVISOS.SIN_SUELO_INICIO));
});

test('un peligro flotando en el aire avisa', () => {
  const base = nivelValido();
  const resultado = validarNivel({
    ...base,
    objetos: [...base.objetos, pinchos(500, 40, { y: 100 })]
  });

  assert.equal(resultado.valido, true);
  assert.ok(tieneAviso(resultado, AVISOS.PELIGRO_FLOTANTE));
});

test('una meta en el aire avisa: puede que no se llegue a ella', () => {
  const resultado = validarNivel(
    nivelValido({
      objetos: [
        suelo(0, ANCHO),
        ...filaMonedas(60, SUELO - 14, 2, 20),
        meta(ANCHO - 60, { y: 100 })
      ]
    })
  );

  assert.equal(resultado.valido, true);
  assert.deepEqual(codigos(resultado.avisos), [AVISOS.META_SIN_APOYO]);
});

test('más de una meta avisa: cualquiera de ellas supera el nivel', () => {
  const base = nivelValido();
  const resultado = validarNivel({ ...base, objetos: [...base.objetos, meta(500)] });

  assert.equal(resultado.valido, true);
  assert.ok(tieneAviso(resultado, AVISOS.MULTIPLES_METAS));
});

test('validarNivel() nunca lanza, por raro que sea lo que recibe', () => {
  const basura = [
    null,
    undefined,
    [],
    42,
    'nivel',
    {},
    { id: 'x', objetos: [null] },
    { id: 'x', objetos: [{ tipo: 'plataforma' }] },
    { id: 'x', ancho: 960, alto: 270, inicio: {}, objetos: [{ tipo: 'meta', x: 'a' }] }
  ];

  for (const datos of basura) {
    assert.doesNotThrow(() => validarNivel(datos), `falló con ${JSON.stringify(datos)}`);
  }
});

test('validarCatalogo() detecta un catálogo vacío', () => {
  for (const niveles of [[], null, undefined]) {
    const resultado = validarCatalogo(niveles);

    assert.equal(resultado.valido, false);
    assert.deepEqual(codigos(resultado.errores), [ERRORES.CATALOGO_VACIO]);
    assert.deepEqual(resultado.resultados, []);
  }
});

test('validarCatalogo() detecta ids repetidos (romperían el récord)', () => {
  const resultado = validarCatalogo([nivelValido(), nivelValido({ nombre: 'Otro' })]);

  assert.equal(resultado.valido, false);
  assert.ok(tieneError(resultado, ERRORES.ID_DUPLICADO));
  assert.equal(resultado.errores[0].nivel, 'prueba', 'el error dice qué id se repite');
});

test('validarCatalogo() reúne los errores de cada nivel con su etiqueta', () => {
  const resultado = validarCatalogo([
    nivelValido(),
    nivelValido({ id: 'roto', orden: 2, objetos: null })
  ]);

  assert.equal(resultado.valido, false);
  assert.equal(resultado.resultados.length, 2, 'valida todos, no solo el primero que falla');
  assert.equal(resultado.resultados[0].valido, true);
  assert.equal(resultado.resultados[1].valido, false);

  const error = resultado.errores.find((item) => item.codigo === ERRORES.SIN_OBJETOS);
  assert.equal(error.nivel, 'roto');
});

test('un catálogo de niveles correctos sale en verde', () => {
  const resultado = validarCatalogo([nivelValido(), nivelValido({ id: 'prueba-2', orden: 2 })]);

  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.errores, []);
  assert.equal(resultado.resultados.every((item) => item.valido), true);
});
