import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOTONES_INTERFAZ,
  IDS_INTERFAZ,
  Interfaz,
  PANTALLAS_INTERFAZ
} from '../src/interfaz/Interfaz.js';
import { PANTALLAS } from '../src/nucleo/Partida.js';
import { domFalso } from './ayudas/dom-falso.js';

/**
 * La capa DOM de la interfaz, probada con un documento falso: pantallas, HUD,
 * corazones y tarjetas de nivel. Sin navegador, pero con el mismo código que
 * corre en el juego.
 */

const TODOS_LOS_IDS = [
  ...Object.values(IDS_INTERFAZ),
  ...Object.values(PANTALLAS_INTERFAZ),
  ...Object.keys(BOTONES_INTERFAZ)
];

/** Datos con la misma forma que `EscenaMundo.datosHud()`. */
const datosHud = (extra = {}) => ({
  nivel: 'nivel-2',
  nombre: 'Saltos y agua',
  numero: 2,
  total: 5,
  cabecera: 'nivel 2/5  Saltos y agua',
  monedas: 3,
  totalMonedas: 12,
  puntos: 30,
  record: 210,
  vidas: 2,
  vidasMaximo: 3,
  progreso: 0.25,
  objetivo: 'recoge las 12 monedas (3)',
  completo: false,
  derrota: false,
  tiempo: 4.2,
  reinicios: 0,
  ...extra
});

function crearInterfaz(alPedir = {}) {
  const { documento, elemento } = domFalso({ ids: TODOS_LOS_IDS });
  return { interfaz: new Interfaz({ documento, alPedir }), elemento, documento };
}

test('el HUD escribe monedas, puntos, récord, nivel y barra de progreso', () => {
  const { interfaz, elemento } = crearInterfaz();

  assert.equal(interfaz.disponible, true);
  assert.equal(interfaz.sincronizarHud(datosHud()), true);

  assert.equal(elemento(IDS_INTERFAZ.monedas).textContent, '3/12');
  assert.equal(elemento(IDS_INTERFAZ.puntos).textContent, '30');
  assert.equal(elemento(IDS_INTERFAZ.record).textContent, 'RÉCORD 210');
  assert.equal(elemento(IDS_INTERFAZ.record).hidden, false);
  assert.equal(elemento(IDS_INTERFAZ.nivel).textContent, 'NIVEL 2/5 · SALTOS Y AGUA');
  assert.equal(elemento(IDS_INTERFAZ.relleno).style.width, '25%');
  assert.equal(elemento(IDS_INTERFAZ.barra).getAttribute('aria-valuenow'), '25');
});

test('sin récord guardado la etiqueta se esconde', () => {
  const { interfaz, elemento } = crearInterfaz();
  interfaz.sincronizarHud(datosHud({ record: 0 }));

  assert.equal(elemento(IDS_INTERFAZ.record).hidden, true);
});

test('no repinta si nada ha cambiado, sí cuando cambia algo', () => {
  const { interfaz } = crearInterfaz();

  assert.equal(interfaz.sincronizarHud(datosHud()), true);
  assert.equal(interfaz.sincronizarHud(datosHud()), false, 'misma firma → ni se toca el DOM');
  assert.equal(interfaz.sincronizarHud(datosHud({ monedas: 4 })), true);
  assert.equal(interfaz.sincronizarHud(datosHud({ progreso: 0.8 })), true);
});

test('las vidas se pintan como corazones, con los gastados apagados', () => {
  const { interfaz, elemento } = crearInterfaz();
  interfaz.sincronizarHud(datosHud({ vidas: 1, vidasMaximo: 3 }));

  const corazones = elemento(IDS_INTERFAZ.vidas).hijos;
  assert.equal(corazones.length, 3);
  assert.ok(corazones[0].className.includes('vidas__corazon'));
  assert.ok(!corazones[0].className.includes('--vacia'), 'la vida disponible se ve entera');
  assert.ok(corazones[1].className.includes('--vacia'));
  assert.ok(corazones[2].className.includes('--vacia'));
});

test('el contador de monedas da un salto cuando sube', () => {
  const { interfaz, elemento } = crearInterfaz();

  interfaz.sincronizarHud(datosHud({ monedas: 3 }));
  assert.ok(!elemento(IDS_INTERFAZ.monedas).classList.contains('hud__valor--pop'));

  interfaz.sincronizarHud(datosHud({ monedas: 4 }));
  assert.ok(
    elemento(IDS_INTERFAZ.monedas).classList.contains('hud__valor--pop'),
    'el efecto de la recogida se dispara al subir el contador'
  );
});

test('mostrarPantalla deja activa solo la sección pedida', () => {
  const { interfaz, elemento } = crearInterfaz();
  const activa = (id) => elemento(id).classList.contains('pantalla--activa');

  assert.equal(interfaz.mostrarPantalla(PANTALLAS.JUEGO), null, 'jugando no hay overlay');
  for (const id of Object.values(PANTALLAS_INTERFAZ)) assert.equal(activa(id), false);

  interfaz.mostrarPantalla(PANTALLAS.PAUSA);
  assert.equal(activa('pantalla-pausa'), true);

  interfaz.mostrarPantalla(PANTALLAS.VICTORIA);
  assert.equal(activa('pantalla-victoria'), true);
  assert.equal(activa('pantalla-pausa'), false, 'solo una pantalla a la vez');

  interfaz.mostrarPantalla(null);
  for (const id of Object.values(PANTALLAS_INTERFAZ)) assert.equal(activa(id), false);
});

test('la victoria escribe el resumen y esconde SEGUIR en el último nivel', () => {
  const { interfaz, elemento } = crearInterfaz();

  interfaz.mostrarVictoria({ datos: datosHud({ completo: true }), siguiente: 'nivel-3' });
  const resumen = elemento(IDS_INTERFAZ.resumenVictoria).textContent;
  assert.match(resumen, /NIVEL 2\/5/);
  assert.match(resumen, /MONEDAS 3\/12/);
  assert.match(resumen, /NIVEL COMPLETADO/);
  assert.equal(elemento(IDS_INTERFAZ.botonSiguiente).hidden, false);
  assert.equal(elemento(IDS_INTERFAZ.botonSiguiente).textContent, 'SIGUIENTE NIVEL');
  assert.equal(elemento('pantalla-victoria').classList.contains('pantalla--activa'), true);

  interfaz.mostrarVictoria({ datos: datosHud({ completo: true }), siguiente: null });
  assert.equal(elemento(IDS_INTERFAZ.botonSiguiente).hidden, true, 'no hay nivel siguiente');
  assert.equal(elemento(IDS_INTERFAZ.botonSiguiente).disabled, true);
});

test('la rejilla pinta las tarjetas y los niveles bloqueados no se pueden pulsar', () => {
  const elegidos = [];
  const { interfaz, elemento } = crearInterfaz({ elegirNivel: (id) => elegidos.push(id) });

  const tarjetas = [
    { id: 'uno', numero: 1, nombre: 'Prado', dificultad: 1, dificultadMaxima: 5, bloqueado: false, completado: true, monedas: 2, totalMonedas: 2, puntos: 20 },
    { id: 'dos', numero: 2, nombre: 'Torre', dificultad: 3, dificultadMaxima: 5, bloqueado: true, completado: false, monedas: 0, totalMonedas: 1, puntos: 0 }
  ];

  assert.equal(interfaz.pintarNiveles(tarjetas, { completados: 1, total: 2 }), 2);
  assert.equal(elemento(IDS_INTERFAZ.resumenNiveles).textContent, 'COMPLETADOS 1/2');

  const [primera, segunda] = elemento(IDS_INTERFAZ.rejillaNiveles).hijos;
  assert.equal(primera.dataset.nivel, 'uno');
  assert.equal(primera.disabled, false);
  assert.ok(primera.className.includes('nivel--completado'));
  assert.ok(primera.textos().includes('2/2'), 'la tarjeta enseña las monedas del récord');
  assert.ok(primera.textos().includes('OK'));

  assert.equal(segunda.dataset.nivel, 'dos');
  assert.equal(segunda.disabled, true);
  assert.ok(segunda.className.includes('nivel--bloqueado'));
  assert.ok(segunda.textos().includes('BLOQUEADO'));

  primera.disparar('click');
  segunda.disparar('click');
  assert.deepEqual(elegidos, ['uno'], 'un nivel bloqueado no avisa de nada');
});

test('los botones del HTML avisan de su intención', () => {
  const pedidas = [];
  const alPedir = {};
  for (const accion of Object.values(BOTONES_INTERFAZ)) {
    alPedir[accion] = () => pedidas.push(accion);
  }
  const { interfaz, elemento } = crearInterfaz(alPedir);
  const ids = Object.keys(BOTONES_INTERFAZ);

  assert.ok(interfaz.disponible);
  assert.equal(new Set(ids).size, 14, 'el HTML debe tener 14 botones distintos');
  for (const id of ids) elemento(id).disparar('click');
  assert.equal(pedidas.length, ids.length, 'cada botón avisa exactamente una vez');

  pedidas.length = 0;
  elemento('boton-jugar').disparar('click');
  elemento('boton-continuar').disparar('click');
  elemento('boton-reintentar').disparar('click');
  elemento('boton-siguiente').disparar('click');
  assert.deepEqual(pedidas, ['jugar', 'reanudar', 'reintentar', 'siguiente']);
});

test('la tabla de récords pinta una fila por jugador y resalta la propia', () => {
  const { interfaz, elemento } = crearInterfaz();

  const filas = [
    { posicion: 1, nombre: 'ANA', puntos: 900, detalle: 'NIVELES 3/5', propio: false },
    { posicion: 2, nombre: 'YO', puntos: 500, detalle: 'NIVELES 2/5', propio: true }
  ];

  assert.equal(interfaz.pintarRecords(filas, { estado: 'MEJORES JUGADORES' }), 2);
  assert.equal(elemento(IDS_INTERFAZ.resumenRecords).textContent, 'MEJORES JUGADORES');

  const [primera, segunda] = elemento(IDS_INTERFAZ.tablaRecords).hijos;
  assert.deepEqual(primera.textos(), ['#1', 'ANA', '900', 'NIVELES 3/5']);
  assert.ok(!primera.className.includes('record--propio'));

  assert.deepEqual(segunda.textos(), ['#2', 'YO', '500', 'NIVELES 2/5']);
  assert.ok(segunda.className.includes('record--propio'), 'la fila del jugador actual se resalta');
  assert.match(primera.getAttribute('aria-label'), /Puesto 1: ANA, 900 puntos/);
});

test('la tabla vacía deja el estado escrito y no inventa filas', () => {
  const { interfaz, elemento } = crearInterfaz();

  interfaz.pintarRecords([], { estado: 'CARGANDO RÉCORDS...' });
  assert.equal(elemento(IDS_INTERFAZ.tablaRecords).hijos.length, 0);
  assert.equal(elemento(IDS_INTERFAZ.resumenRecords).textContent, 'CARGANDO RÉCORDS...');

  interfaz.pintarRecords([], { estado: 'SIN RÉCORDS: NO HAY SERVIDOR' });
  assert.equal(elemento(IDS_INTERFAZ.resumenRecords).textContent, 'SIN RÉCORDS: NO HAY SERVIDOR');

  // Una fila a medias no rompe el pintado: se rellena con ceros y sin detalle.
  assert.equal(interfaz.pintarRecords([{ nombre: 'X' }]), 1);
  const [fila] = elemento(IDS_INTERFAZ.tablaRecords).hijos;
  assert.deepEqual(fila.textos(), ['#0', 'X', '0']);
});

test('sin HTML de interfaz todo es inofensivo (el juego sigue jugable)', () => {
  const interfaz = new Interfaz({ documento: { getElementById: () => null } });

  assert.equal(interfaz.disponible, false);
  assert.equal(interfaz.sincronizarHud(datosHud()), false);
  assert.equal(interfaz.pintarNiveles([], null), 0);
  assert.equal(interfaz.pintarRecords([{ posicion: 1, nombre: 'X', puntos: 10 }]), 0);
  assert.equal(interfaz.mostrarPantalla(PANTALLAS.PAUSA), null);
  assert.equal(interfaz.pintarVidas(1, 3), false);
  assert.equal(interfaz.avisar('hola'), false);
  assert.doesNotThrow(() => interfaz.mostrarVictoria({ datos: datosHud(), siguiente: null }));
  assert.doesNotThrow(() => interfaz.mostrarDerrota(datosHud()));
});

test('sin documento (Node sin DOM) tampoco rompe', () => {
  const interfaz = new Interfaz({ documento: null });

  assert.equal(interfaz.disponible, false);
  assert.equal(interfaz.sincronizarHud(datosHud()), false);
  assert.doesNotThrow(() => interfaz.mostrarPausa(datosHud()));
});
