import test from 'node:test';
import assert from 'node:assert/strict';

import { domFalso } from './ayudas/dom-falso.js';
import {
  BOTONES_INTERFAZ,
  IDS_INTERFAZ,
  PANTALLAS_INTERFAZ
} from '../src/interfaz/Interfaz.js';

/**
 * Prueba de humo del ARRANQUE REAL: stubbea el DOM que necesita main.js (canvas,
 * ventana, requestAnimationFrame y un documento con los ids de la interfaz) y
 * ejecuta el punto de entrada tal cual lo haría el navegador. Verifica de una
 * vez: index.html → main.js → Juego → Bucle → EscenaMundo → HUD → pantallas.
 *
 * Cada archivo de `node --test` corre en su propio proceso, así que ensuciar
 * los globales aquí no afecta a las demás pruebas.
 */

const llamadas = [];
let pendiente = null;
let idPeticion = 0;
let tiempo = 0;

const lienzo = {
  id: 'juego',
  dataset: {},
  focus() {},
  setPointerCapture() {},
  addEventListener() {},
  removeEventListener() {},
  getContext: () => contexto
};

const contexto = new Proxy(
  {},
  {
    get(_destino, propiedad) {
      if (propiedad === 'canvas') return lienzo;
      return (...args) => {
        llamadas.push([String(propiedad), ...args]);
      };
    },
    set() {
      return true;
    }
  }
);

const botones = ['izquierda', 'derecha', 'salto', 'impulso'].map((accion) => ({
  dataset: { accion },
  oyentes: new Set(),
  addEventListener(tipo) {
    this.oyentes.add(tipo);
  },
  removeEventListener() {},
  setPointerCapture() {}
}));

// Todos los ids que busca `src/interfaz/Interfaz.js`, más los botones táctiles.
const idsDeInterfaz = [
  ...Object.values(IDS_INTERFAZ),
  ...Object.values(PANTALLAS_INTERFAZ),
  ...Object.keys(BOTONES_INTERFAZ)
];
const { documento: interfazFalsa, elemento } = domFalso({ ids: idsDeInterfaz });

const documento = {
  hidden: false,
  fonts: { ready: Promise.resolve() },
  getElementById: (id) => (id === 'juego' ? lienzo : interfazFalsa.getElementById(id)),
  createElement: (etiqueta) => interfazFalsa.createElement(etiqueta),
  querySelectorAll: (selector) => (selector === '[data-accion]' ? botones : []),
  addEventListener() {},
  removeEventListener() {}
};

const oyentesVentana = new Map();
const ventana = {
  addEventListener(tipo, fn) {
    if (!oyentesVentana.has(tipo)) oyentesVentana.set(tipo, new Set());
    oyentesVentana.get(tipo).add(fn);
  },
  removeEventListener(tipo, fn) {
    oyentesVentana.get(tipo)?.delete(fn);
  }
};

function emitirEnVentana(tipo, evento = {}) {
  for (const fn of oyentesVentana.get(tipo) ?? []) fn(evento);
}

/** Avanza `n` cuadros de requestAnimationFrame a la frecuencia indicada. */
function avanzarCuadros(n, hercios = 144) {
  for (let i = 0; i < n; i++) {
    tiempo += 1000 / hercios;
    const cuadro = pendiente;
    pendiente = null;
    cuadro?.(tiempo);
  }
}

globalThis.window = ventana;
globalThis.document = documento;
globalThis.requestAnimationFrame = (cb) => {
  pendiente = cb;
  return ++idPeticion;
};
globalThis.cancelAnimationFrame = () => {
  pendiente = null;
};

// Importar main.js ejecuta arrancar() (async: espera a las fuentes).
await import('../src/main.js');
await new Promise((resolver) => setImmediate(resolver));
await new Promise((resolver) => setImmediate(resolver));

test('el juego arranca esperando en el menú principal', () => {
  assert.ok(ventana.juego, 'main.js debe publicar window.juego');
  assert.ok(ventana.partidaUI, 'main.js debe publicar window.partidaUI (depuración)');
  assert.equal(ventana.juego.ancho, 480);
  assert.equal(ventana.juego.alto, 270);
  assert.equal(typeof ventana.juego.bucle.avanzarHasta, 'function');
  // Sin partida empezada no hay escena: manda el menú (HTML), no el canvas.
  assert.equal(ventana.juego.escena, null);
  assert.equal(ventana.partidaUI.partida.pantalla, 'titulo');
  assert.ok(
    elemento(PANTALLAS_INTERFAZ.titulo).classList.contains('pantalla--activa'),
    'el menú principal debe estar visible al arrancar'
  );
});

test('JUGAR arranca el nivel que toca jugar', () => {
  const { juego, partidaUI } = ventana;
  const nivel = partidaUI.nivelSugerido();

  assert.ok(nivel, 'el catálogo debe tener algún nivel');
  partidaUI.jugarDesdeMenu();

  assert.ok(juego.escena, 'debe haber una escena activa');
  assert.equal(juego.escena.nivelId, nivel);
  assert.equal(partidaUI.partida.pantalla, 'juego');
  assert.equal(juego.bucle.pausado, false);
  assert.ok(
    !elemento(PANTALLAS_INTERFAZ.titulo).classList.contains('pantalla--activa'),
    'al jugar se cierra el menú'
  );

  // El HUD se sincroniza con el estado real de la escena.
  const datos = partidaUI.sincronizarHud();
  assert.equal(datos.nivel, nivel);
  assert.equal(datos.vidas, partidaUI.vidas.restantes);
  assert.equal(
    elemento(IDS_INTERFAZ.monedas).textContent,
    `0/${datos.totalMonedas}`,
    'el contador del HUD empieza a cero'
  );
  assert.ok(elemento(IDS_INTERFAZ.nivel).textContent.includes(`/${datos.total}`));
  assert.equal(elemento(IDS_INTERFAZ.vidas).hijos.length, partidaUI.vidas.maximo);
});

test('los botones táctiles del HTML quedan enganchados por data-accion', () => {
  assert.equal(botones.length, 4);
  for (const boton of botones) {
    assert.ok(
      boton.oyentes.has('pointerdown'),
      `el botón "${boton.dataset.accion}" no recibió pointerdown`
    );
    assert.ok(boton.oyentes.has('pointerup'));
  }
});

test('el bucle dibuja y simula al ritmo de requestAnimationFrame', () => {
  const juego = ventana.juego;
  const pasosAntes = juego.bucle.pasosTotales;
  const dibujosAntes = juego.bucle.cuadrosTotales;

  avanzarCuadros(144); // 1 segundo a 144 Hz

  // El primer cuadro del bucle solo fija la referencia temporal: no dibuja.
  const dibujos = juego.bucle.cuadrosTotales - dibujosAntes;
  assert.ok(dibujos === 144 || dibujos === 143, `se dibujaron ${dibujos} cuadros`);

  const pasos = juego.bucle.pasosTotales - pasosAntes;
  assert.ok(Math.abs(pasos - 60) <= 1, `se simularon ${pasos} pasos en 1 s`);
  assert.ok(llamadas.some(([nombre]) => nombre === 'fillRect'), 'debe pintar el fondo');
  assert.ok(llamadas.some(([nombre]) => nombre === 'arc'), 'debe pintar la bola');
  assert.ok(llamadas.some(([nombre]) => nombre === 'fillText'), 'debe pintar las métricas');
});

test('el teclado mueve a la bola a través de la cadena completa', () => {
  const juego = ventana.juego;
  const xInicial = juego.escena.jugador.x;

  emitirEnVentana('keydown', { code: 'ArrowRight', repeat: false, preventDefault() {} });
  avanzarCuadros(60); // medio segundo

  assert.ok(juego.escena.jugador.x > xInicial, 'la bola debe desplazarse a la derecha');
  assert.ok(juego.escena.jugador.vx > 0);

  emitirEnVentana('keyup', { code: 'ArrowRight' });
  assert.equal(juego.entrada.ejeHorizontal(), 0);
});

test('al saltar, la bola se separa del suelo', () => {
  const juego = ventana.juego;
  const ySuelo = juego.escena.jugador.y;

  emitirEnVentana('keydown', { code: 'Space', repeat: false, preventDefault() {} });
  avanzarCuadros(6);
  emitirEnVentana('keyup', { code: 'Space' });

  assert.ok(juego.escena.jugador.y < ySuelo, 'y debe disminuir al saltar');
});

test('perder el foco abre la pausa y suelta las teclas', () => {
  const { juego, partidaUI } = ventana;
  emitirEnVentana('keydown', { code: 'ArrowLeft', repeat: false, preventDefault() {} });

  emitirEnVentana('blur');
  assert.equal(juego.entrada.ejeHorizontal(), 0, 'no deben quedar teclas pegadas');
  assert.equal(juego.bucle.pausado, true);
  assert.equal(partidaUI.partida.pantalla, 'pausa', 'perder el foco abre el menú de pausa');
  assert.ok(
    elemento(PANTALLAS_INTERFAZ.pausa).classList.contains('pantalla--activa'),
    'la pantalla de pausa se pinta encima del nivel congelado'
  );
  assert.match(elemento(IDS_INTERFAZ.resumenPausa).textContent, /MONEDAS \d+\//);

  const pasosAntes = juego.bucle.pasosTotales;
  avanzarCuadros(30);
  assert.equal(juego.bucle.pasosTotales, pasosAntes, 'en pausa no se simula');

  partidaUI.reanudarPartida();
  avanzarCuadros(10);
  assert.ok(juego.bucle.pasosTotales > pasosAntes, 'al reanudar se vuelve a simular');
  assert.equal(partidaUI.partida.pantalla, 'juego');
  assert.ok(!elemento(PANTALLAS_INTERFAZ.pausa).classList.contains('pantalla--activa'));
});

test('P pausa y R reinicia el nivel sin salir de la partida', () => {
  const { juego, partidaUI } = ventana;

  emitirEnVentana('keydown', { code: 'KeyP', repeat: false, preventDefault() {} });
  assert.equal(partidaUI.partida.pantalla, 'pausa');
  assert.equal(juego.bucle.pausado, true);

  const escenaAntes = juego.escena;
  emitirEnVentana('keydown', { code: 'KeyR', repeat: false, preventDefault() {} });

  assert.equal(partidaUI.partida.pantalla, 'juego', 'reiniciar vuelve a la partida');
  assert.equal(juego.bucle.pausado, false);
  assert.notEqual(juego.escena, escenaAntes, 'reiniciar crea una escena nueva');
  assert.equal(juego.escena.nivelId, escenaAntes.nivelId, 'y es el mismo nivel');
});
