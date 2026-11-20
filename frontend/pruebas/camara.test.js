import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMARA } from '../src/config/ajustes.js';
import { Camara } from '../src/render/Camara.js';
import { contextoFalso } from './ayudas/contexto-falso.js';

/**
 * Contrato de la cámara: coloca al personaje a una fracción del ancho, nunca
 * enseña el vacío de fuera del nivel y persigue con suavizado INDEPENDIENTE de
 * la tasa de refresco (misma posición tras el mismo tiempo a 30, 60 o 144 Hz).
 */

const camara = (extra = {}) =>
  new Camara({ ancho: 480, alto: 270, mundoAncho: 960, mundoAlto: 270, ...extra });

test('el objetivo centra al personaje y respeta los bordes del nivel', () => {
  const c = camara();

  assert.equal(c.objetivoPara({ x: 0, y: 135 }).x, 0, 'no se sale por la izquierda');
  assert.equal(c.objetivoPara({ x: 10000, y: 135 }).x, 960 - 480, 'ni por la derecha');
  assert.equal(c.objetivoPara({ x: 500, y: 135 }).y, 0, 'nivel de la misma altura que la vista');

  const medio = c.objetivoPara({ x: 600, y: 135 }).x;
  assert.ok(Math.abs(medio - (600 - 480 * CAMARA.MARGEN_X)) < 1e-9);
});

test('la persecución es exponencial: mismo resultado a 30, 60 y 144 Hz', () => {
  const tras = (hercios) => {
    const c = camara();
    const objetivo = { x: 800, y: 135 };
    for (let i = 0; i < hercios; i++) c.seguir(objetivo, 1 / hercios);
    return c.x;
  };

  const a30 = tras(30);
  const a60 = tras(60);
  const a144 = tras(144);

  assert.ok(Math.abs(a60 - a144) < 1e-9, `60 Hz ${a60} vs 144 Hz ${a144}`);
  assert.ok(Math.abs(a60 - a30) < 1e-9, `60 Hz ${a60} vs 30 Hz ${a30}`);
  assert.ok(a60 > 0 && a60 <= 480, `dentro del nivel: ${a60}`);
});

test('centrar salta al objetivo y el desplazamiento es entero', () => {
  const c = camara();
  c.centrar({ x: 600, y: 135 });

  assert.equal(c.x, 600 - 480 * CAMARA.MARGEN_X);
  assert.equal(Number.isInteger(c.desplazamiento.x), true);
  assert.equal(Number.isInteger(c.desplazamiento.y), true);
});

test('aplicar traslada el lienzo en negativo y restaurar lo deshace', () => {
  const c = camara();
  c.centrar({ x: 700, y: 135 });

  const ctx = contextoFalso();
  c.aplicar(ctx);
  c.restaurar(ctx);

  const translate = ctx.llamadas.find(([nombre]) => nombre === 'translate');
  assert.deepEqual(translate.slice(1), [-c.desplazamiento.x, -c.desplazamiento.y]);
  assert.equal(ctx.llamadas[0][0], 'save');
  assert.equal(ctx.llamadas.at(-1)[0], 'restore');
});

test('seguir sin tiempo válido no mueve la cámara', () => {
  const c = camara();
  c.seguir({ x: 800, y: 135 }, 0);
  assert.equal(c.x, 0);
  c.seguir({ x: 800, y: 135 }, Number.NaN);
  assert.equal(c.x, 0);
});

/**
 * ── Vertical: hasta ahora no lo ejercitaba ningún nivel ─────────────────────
 * Todos los niveles miden `VISTA.ALTO`, así que su desplazamiento vertical es 0.
 * El día que uno sea más alto (una torre), esto es lo que tiene que pasar.
 */

const alta = (extra = {}) =>
  new Camara({ ancho: 480, alto: 270, mundoAncho: 960, mundoAlto: 1080, ...extra });

test('en un mundo alto la cámara también persigue en vertical', () => {
  const c = alta();

  assert.equal(c.objetivoPara({ x: 0, y: 0 }).y, 0, 'arriba del todo no enseña el vacío');
  assert.equal(
    c.objetivoPara({ x: 0, y: 10000 }).y,
    1080 - 270,
    'abajo del todo se para en el borde del nivel'
  );

  const medio = c.objetivoPara({ x: 0, y: 600 }).y;
  assert.ok(Math.abs(medio - (600 - 270 * CAMARA.MARGEN_Y)) < 1e-9, `margenY aplicado: ${medio}`);
  assert.equal(
    c.objetivoPara({ x: 0, y: 600 }).x,
    0,
    'cada eje se limita por su cuenta: el vertical no arrastra al horizontal'
  );
});

test('la persecución vertical es la misma exponencial que la horizontal', () => {
  const tras = (hercios) => {
    const c = alta();
    c.centrar({ x: 0, y: 0 });
    for (let i = 0; i < hercios; i++) c.seguir({ x: 0, y: 800 }, 1 / hercios);
    return c.y;
  };

  assert.ok(Math.abs(tras(60) - tras(144)) < 1e-9, 'mismo tiempo, mismo sitio');
  assert.ok(tras(60) > 0, 'y se ha movido');
});

test('el personaje queda al 38 % del ancho, no en el centro', () => {
  const c = camara();
  const centro = { x: 600, y: 135 };
  c.centrar(centro);

  const enPantalla = c.mundoAPantalla(centro);

  assert.equal(enPantalla.x, Math.round(480 * CAMARA.MARGEN_X));
  assert.notEqual(enPantalla.x, 240, 'el centro exacto es lo que se quiere evitar');
  assert.ok(enPantalla.x < 240, 'mira más hacia delante que hacia atrás');
  assert.ok(enPantalla.x >= 0 && enPantalla.x < 480, 'y aun así está dentro de la vista');
});

test('mundo↔pantalla: la resta de la cámara y su inversa', () => {
  const c = camara();
  c.centrar({ x: 700, y: 135 });

  const mundo = { x: 742, y: 60 };
  const pantalla = c.mundoAPantalla(mundo);

  assert.deepEqual(pantalla, {
    x: mundo.x - c.desplazamiento.x,
    y: mundo.y - c.desplazamiento.y
  });
  assert.deepEqual(c.pantallaAMundo(pantalla), mundo, 'la inversa devuelve el punto exacto');
  assert.ok(pantalla.x >= 0 && pantalla.x < 480, 'y ese punto está en el lienzo');
});

test('visible() descarta lo que está fuera de la ventana', () => {
  const c = camara();
  c.centrar({ x: 600, y: 135 }); // desplazamiento.x = 600 - 182.4 = 417.6 → 418
  const { x } = c.desplazamiento;

  assert.equal(c.visible({ x: x + 100, y: 100, ancho: 16, alto: 16 }), true, 'en el centro');
  assert.equal(c.visible({ x: x + 480 + 50, y: 100, ancho: 16, alto: 16 }), false, 'a la derecha');
  assert.equal(c.visible({ x: x - 200, y: 100, ancho: 16, alto: 16 }), false, 'a la izquierda');
  assert.equal(c.visible({ x: x + 100, y: 1000, ancho: 16, alto: 16 }), false, 'por debajo');
  assert.equal(
    c.visible({ x: x + 480 + 10, y: 100, ancho: 16, alto: 16 }, 60),
    true,
    'el margen deja pasar lo que está a punto de entrar'
  );
  assert.equal(c.visible(null), false, 'sin caja no hay nada que enseñar');
});

test('redimensionar recalcula los límites y no deja ver el vacío', () => {
  const c = camara();
  c.centrar({ x: 10000, y: 135 });
  assert.equal(c.x, 480, 'pegada al borde derecho del nivel de 960');

  c.redimensionar({ mundoAncho: 1920 });
  assert.equal(c.x, 480, 'al agrandar el nivel la cámara sigue donde estaba');

  c.redimensionar({ mundoAncho: 640 });
  assert.equal(c.x, 160, 'al encoger el nivel se recoloca dentro del nuevo límite');

  c.redimensionar({ alto: 400 });
  assert.equal(c.y, 0, 'un eje que ahora sobra se queda a 0');

  c.redimensionar({ ancho: -10, alto: Number.NaN });
  assert.equal(c.ancho, 480, 'un tamaño absurdo se ignora en vez de romper la vista');
});

test('el desplazamiento es estable: redondear no acumula ni tiembla', () => {
  const c = camara();
  c.centrar({ x: 600, y: 135 });

  const primero = c.desplazamiento;
  c.seguir({ x: 600, y: 135 }, 1 / 60); // el jugador no se ha movido
  const segundo = c.desplazamiento;

  assert.deepEqual(segundo, primero, 'quieto no hay baile de un píxel');
  assert.equal(Number.isInteger(primero.x) && Number.isInteger(primero.y), true);
  assert.ok(Math.abs(c.x - primero.x) <= 0.5, 'el decimal sigue guardado bajo el entero');
});
