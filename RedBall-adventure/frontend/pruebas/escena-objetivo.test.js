import test from 'node:test';
import assert from 'node:assert/strict';

import { NIVEL, PASO_FIJO, VISTA } from '../src/config/ajustes.js';
import { EscenaMundo } from '../src/escenas/EscenaMundo.js';
import { crearCatalogo } from '../src/mundo/niveles/index.js';
import { SUELO, meta, moneda, suelo } from '../src/mundo/niveles/ayudas.js';
import { leerProgreso, registroDe } from '../src/nucleo/Progreso.js';
import { almacenFalso } from './ayudas/almacen-falso.js';
import { contextoFalso } from './ayudas/contexto-falso.js';

/**
 * Cableado del OBJETIVO en la escena: el mundo avisa de que se ha tocado la meta
 * y de las monedas recogidas, pero quien decide si el nivel está superado es
 * `mundo/objetivo.js`. Aquí se comprueba ese cableado (meta sola, meta con
 * monedas, HUD, récord y paso al nivel siguiente) sin DOM ni navegador.
 */

/** Nivel mínimo: suelo entero, monedas opcionales y una meta. */
function nivelSimple({ id = 'meta-prueba', orden = 1, objetivo = { tipo: 'meta' }, monedas = 0 } = {}) {
  return {
    id,
    orden,
    nombre: 'Meta de prueba',
    dificultad: 1,
    ancho: VISTA.ANCHO,
    alto: VISTA.ALTO,
    inicio: { x: 40, y: SUELO },
    objetivo,
    objetos: [
      suelo(0, VISTA.ANCHO),
      ...Array.from({ length: monedas }, (_, i) => moneda(280 + i * 20, SUELO - 14)),
      meta(400)
    ]
  };
}

function juegoFalso({ almacen = undefined } = {}) {
  const juego = {
    almacen,
    sonido: null,
    escenas: [],
    entrada: {
      ejeHorizontal: () => 0,
      recienPresionada: () => false,
      estaPresionada: () => false
    },
    cambiarEscena(escena) {
      juego.escenas.push(escena);
      return escena;
    }
  };
  return juego;
}

/** Un paso con el jugador dentro de la meta (la toca sin moverse). */
function tocarMeta(escena, juego) {
  const laMeta = escena.mundo.delTipo('meta')[0];
  escena.jugador.colocar({ x: laMeta.x + 4, y: laMeta.y + 10 });
  escena.actualizar(PASO_FIJO, juego);
  return laMeta;
}

/** Avanza `segundos` sin tocar el mando (para que corra la cuenta atrás). */
function esperar(escena, juego, segundos) {
  for (let i = 0; i < Math.round(segundos / PASO_FIJO); i++) escena.actualizar(PASO_FIJO, juego);
  return escena;
}

const textos = (ctx) =>
  ctx.llamadas.filter(([nombre]) => nombre === 'fillText').map(([, texto]) => String(texto));

test('tocar la meta supera un nivel que no exige monedas', () => {
  const juego = juegoFalso();
  const escena = new EscenaMundo({ nivel: nivelSimple(), niveles: [] }).entrar(juego);

  assert.equal(escena.completo, false, 'no se empieza superado');

  tocarMeta(escena, juego);

  assert.equal(escena.metaAlcanzada, true);
  assert.equal(escena.completo, true);
  assert.equal(escena.estadoObjetivo.cumplido, true);
  assert.equal(escena.mensaje, '¡Nivel completado!', 'no hay nivel siguiente');
  assert.equal(escena.transicion, null);
});

test('si el nivel exige monedas, llegar antes no lo supera', () => {
  const juego = juegoFalso();
  const nivel = nivelSimple({ objetivo: { tipo: 'meta', monedas: 2 }, monedas: 3 });
  const escena = new EscenaMundo({ nivel, niveles: [] }).entrar(juego);

  tocarMeta(escena, juego);

  assert.equal(escena.metaAlcanzada, true, 'la meta sí se ha tocado');
  assert.equal(escena.completo, false, 'pero faltan monedas');
  assert.equal(escena.estadoObjetivo.faltanMonedas, 2);

  // Vuelve a por las monedas: en cuanto las tiene, el nivel se supera.
  for (const objeto of [...escena.mundo.coleccionables]) {
    escena.jugador.colocar({ x: objeto.x - 5, y: objeto.y - 5 });
    escena.actualizar(PASO_FIJO, juego);
    if (escena.completo) break;
  }

  assert.ok(escena.marcador.monedas >= 2);
  assert.equal(escena.completo, true, 'con la meta tocada y las monedas, superado');
});

test('el HUD muestra el objetivo que queda por cumplir', () => {
  const juego = juegoFalso();
  const nivel = nivelSimple({ objetivo: { tipo: 'meta', monedas: 2 }, monedas: 3 });
  const escena = new EscenaMundo({ nivel, niveles: [] }).entrar(juego);

  const ctx = contextoFalso();
  escena.dibujar(ctx);
  const lineas = textos(ctx);

  assert.ok(
    lineas.some((texto) => texto.includes('meta + 0/2 monedas')),
    `el HUD no muestra el objetivo pendiente: ${JSON.stringify(lineas)}`
  );
  assert.ok(lineas.some((texto) => texto.includes('dificultad 1/5')));
});

test('completar el nivel guarda el récord como superado', () => {
  const almacen = almacenFalso();
  const juego = juegoFalso({ almacen });
  const escena = new EscenaMundo({ nivel: nivelSimple(), niveles: [] }).entrar(juego);

  tocarMeta(escena, juego);

  const guardado = registroDe(leerProgreso(almacen), 'meta-prueba');
  assert.equal(guardado.completado, true, 'la progresión se apoya en este campo');
  assert.equal(guardado.puntos, escena.marcador.puntos);
});

test('al superar el nivel, la cuenta atrás abre el siguiente', () => {
  const nivelA = nivelSimple({ id: 'nivel-a', orden: 1 });
  const nivelB = nivelSimple({ id: 'nivel-b', orden: 2 });
  const catalogo = crearCatalogo([nivelA, nivelB]);

  const juego = juegoFalso();
  const escena = new EscenaMundo({ nivelId: 'nivel-a', niveles: catalogo }).entrar(juego);

  tocarMeta(escena, juego);

  assert.equal(escena.completo, true);
  assert.equal(escena.mensaje, '¡Nivel superado!');
  assert.equal(escena.transicion.nivelId, 'nivel-b', 'la cuenta atrás ya ha dado el primer paso');
  assert.ok(
    escena.transicion.restante > 0 && escena.transicion.restante <= NIVEL.TRANSICION,
    `la espera debe ser de ${NIVEL.TRANSICION}s: ${escena.transicion.restante}`
  );

  esperar(escena, juego, NIVEL.TRANSICION + 0.1);

  assert.equal(juego.escenas.length, 1, 'la escena pide el cambio una sola vez');
  assert.equal(juego.escenas[0].nivelId, 'nivel-b');
  assert.equal(escena.transicion, null);
});

test('el último nivel del catálogo no intenta abrir otro', () => {
  const catalogo = crearCatalogo([nivelSimple({ id: 'unico', orden: 1 })]);
  const juego = juegoFalso();
  const escena = new EscenaMundo({ nivelId: 'unico', niveles: catalogo }).entrar(juego);

  tocarMeta(escena, juego);
  esperar(escena, juego, NIVEL.TRANSICION + 0.1);

  assert.equal(escena.completo, true);
  assert.equal(escena.siguiente, null);
  assert.deepEqual(juego.escenas, [], 'no hay nada que abrir');
});

test('la cabecera del HUD dice qué nivel del total se está jugando', () => {
  const catalogo = crearCatalogo([
    nivelSimple({ id: 'uno', orden: 1 }),
    nivelSimple({ id: 'dos', orden: 2 })
  ]);
  const escena = new EscenaMundo({ nivelId: 'dos', niveles: catalogo }).entrar(juegoFalso());

  // La cabecera ("nivel 2/2  Meta de prueba") vive en los datos del HUD que
  // pinta el DOM; el canvas solo lleva la línea del objetivo.
  const datos = escena.datosHud();
  assert.match(datos.cabecera, /nivel 2\/2/);
  assert.equal(datos.numero, 2);
  assert.equal(datos.total, 2);
  assert.equal(datos.nivel, 'dos');
});

test('sin argumentos se sigue abriendo el nivel de demostración', () => {
  const escena = new EscenaMundo().entrar(juegoFalso());

  assert.equal(escena.nivelId, 'demo');
  assert.equal(escena.objetivo.tipo, 'monedas', 'el demo se supera con todas las monedas');
});
