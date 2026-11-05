import test from 'node:test';
import assert from 'node:assert/strict';

import { NIVELES } from '../src/mundo/niveles/index.js';
import { normalizarObjetivo } from '../src/mundo/objetivo.js';
import { jugarNivel } from './ayudas/bot.js';

/**
 * ¿SE PUEDEN TERMINAR los niveles? Escribir data es fácil; lo difícil es que sea
 * jugable. Aquí un bot juega cada nivel de verdad (misma escena, misma física,
 * mismos datos) yendo siempre hacia la derecha y saltando lo que estorba.
 *
 * Si estas pruebas fallan, alguien ha movido un peligro a la salida de un salto,
 * ha dejado un foso demasiado ancho o ha subido las monedas exigidas por encima
 * de las que caen en la ruta: el mensaje dice dónde y con cuántas monedas.
 *
 * LÍMITE: el bot no busca monedas a propósito, así que un nivel que exija
 * monedas fuera de la ruta principal fallará aquí aunque sea jugable para un
 * humano. Por eso los niveles ponen las monedas obligatorias en el camino.
 */

const resultados = new Map();

/** El bot juega el nivel una sola vez: los tests de abajo reutilizan el resultado. */
function jugar(nivel) {
  if (!resultados.has(nivel.id)) {
    resultados.set(nivel.id, jugarNivel(nivel, { niveles: NIVELES }));
  }
  return resultados.get(nivel.id);
}

for (const nivel of NIVELES) {
  test(`el bot termina ${nivel.id} ("${nivel.nombre}")`, () => {
    const resultado = jugar(nivel);
    const objetivo = normalizarObjetivo(nivel.objetivo);

    assert.equal(
      resultado.completo,
      true,
      `el bot se quedó en x=${resultado.x} con ${resultado.monedas}/${resultado.totalMonedas} monedas` +
        ` (objetivo: ${objetivo.tipo}${objetivo.monedas ? ` + ${objetivo.monedas} monedas` : ''})` +
        ` y murió en ${JSON.stringify(resultado.muertes)}`
    );

    if (objetivo.tipo === 'meta' && objetivo.monedas > 0) {
      assert.ok(
        resultado.monedas >= objetivo.monedas,
        `${nivel.id} pide ${objetivo.monedas} monedas y por la ruta solo caen ${resultado.monedas}` +
          ' (acerca alguna moneda obligatoria al camino o baja el requisito)'
      );
    }
  });
}

test('ningún nivel obliga a morir para pasarlo', () => {
  for (const nivel of NIVELES) {
    const resultado = jugar(nivel);

    assert.equal(
      resultado.reinicios,
      0,
      `${nivel.id} reinicia al bot en ${JSON.stringify(resultado.muertes)}: hay un peligro o un` +
        ' hueco en la caída de un salto'
    );
  }
});

test('el bot recoge monedas en todos los niveles', () => {
  for (const nivel of NIVELES) {
    const resultado = jugar(nivel);

    assert.ok(
      resultado.monedas > 0,
      `${nivel.id} no tiene monedas en la ruta principal: el nivel se vuelve un pasillo`
    );
    assert.ok(
      resultado.monedas <= resultado.totalMonedas,
      `${nivel.id}: el bot dice haber cogido más monedas de las que existen`
    );
  }
});

test('cada nivel completado deja el récord marcado como superado', () => {
  for (const nivel of NIVELES) {
    const resultado = jugar(nivel);

    assert.equal(resultado.escena.completo, true);
    assert.equal(resultado.escena.nivelId, nivel.id);
    assert.ok(
      resultado.escena.marcador.puntos > 0,
      `${nivel.id}: completar el nivel debe dar puntos aunque no se exijan monedas`
    );
  }
});
