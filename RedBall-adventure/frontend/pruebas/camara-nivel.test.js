import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMARA, PASO_FIJO, VISTA } from '../src/config/ajustes.js';
import { EscenaMundo } from '../src/escenas/EscenaMundo.js';
import { SUELO, meta, moneda, pinchos, suelo } from '../src/mundo/niveles/ayudas.js';
import { contextoFalso } from './ayudas/contexto-falso.js';

/**
 * La cámara, de punta a punta: un nivel MÁS GRANDE que la pantalla en los dos
 * ejes, jugado por la escena real. Aquí no se prueba la fórmula (eso es
 * camara.test.js) sino que el desplazamiento llega a lo que se dibuja:
 *
 *   - el jugador se mueve por el mundo, la cámara lo persigue con retraso,
 *   - las plataformas, monedas y pinchos se ven donde toca (mismo desplazamiento
 *     para todos: es UNA traslación, no una por objeto),
 *   - los bordes del nivel no enseñan el vacío,
 *   - y lo que queda fuera de la ventana ni siquiera se etiqueta.
 *
 * Todos los niveles actuales miden `VISTA.ALTO`, así que su eje vertical está
 * siempre a 0. Esta "torre" existe para que el eje vertical se ejercite de
 * verdad: es el caso que justifica `objetivoPara().y`.
 */

const ALTO_TORRE = 540; // dos pantallas de alto

/** Nivel de dos pantallas de alto y tres de ancho. */
function torre() {
  return {
    id: 'torre',
    orden: 1,
    nombre: 'Torre',
    dificultad: 2,
    ancho: 1600,
    alto: ALTO_TORRE,
    inicio: { x: 40, y: 90 },
    objetivo: { tipo: 'meta' },
    objetos: [
      suelo(0, 1600, { y: 510, etiqueta: 'suelo' }),
      suelo(600, 160, { y: 300, etiqueta: 'repisa' }),
      moneda(200, 496),
      moneda(640, 286),
      pinchos(900, 40, { y: 502 }),
      { tipo: 'plataforma', x: 1450, y: 460, ancho: 40, alto: 50, material: 'piedra' },
      meta(1520, { y: 510 - 44 })
    ]
  };
}

function juegoFalso() {
  const juego = {
    almacen: undefined,
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

/** Avanza `segundos` con el jugador quieto (para que la cámara termine de llegar). */
function esperar(escena, juego, segundos = 1) {
  const pasos = Math.round(segundos / PASO_FIJO);
  for (let i = 0; i < pasos; i++) escena.actualizar(PASO_FIJO, juego);
  return escena;
}

const textos = (ctx) =>
  ctx.llamadas.filter(([nombre]) => nombre === 'fillText').map(([, texto]) => String(texto));

test('al entrar, la cámara encuadra el inicio y no enseña fuera del nivel', () => {
  const juego = juegoFalso();
  const escena = new EscenaMundo({ nivel: torre(), niveles: [] }).entrar(juego);
  const { camara } = escena;

  assert.equal(camara.ancho, VISTA.ANCHO);
  assert.equal(camara.alto, VISTA.ALTO);
  assert.equal(camara.mundoAncho, 1600);
  assert.equal(camara.mundoAlto, ALTO_TORRE);

  // Arranca arriba a la izquierda: el límite manda sobre el margen.
  assert.equal(camara.x, 0, 'el borde izquierdo del nivel es el borde de la vista');
  assert.equal(camara.y, 0, 'y por arriba lo mismo');

  const enPantalla = camara.mundoAPantalla(escena.jugador.centro);
  assert.ok(enPantalla.x >= 0 && enPantalla.x < VISTA.ANCHO, `dentro del lienzo: ${enPantalla.x}`);
  assert.ok(enPantalla.y >= 0 && enPantalla.y < VISTA.ALTO, `dentro del lienzo: ${enPantalla.y}`);
});

test('el seguimiento horizontal y vertical llevan la ventana al borde del nivel', () => {
  const juego = juegoFalso();
  const escena = new EscenaMundo({ nivel: torre(), niveles: [] }).entrar(juego);

  // Abajo y a la derecha del todo: los dos ejes tienen que viajar.
  escena.jugador.colocar({ x: 1500, y: 480 });
  esperar(escena, juego, 1.5);

  // El suavizado es asintótico: se compara el píxel que se pinta, no el decimal.
  assert.equal(Math.round(escena.camara.x), 1600 - VISTA.ANCHO, 'pegada al borde derecho');
  assert.equal(Math.round(escena.camara.y), ALTO_TORRE - VISTA.ALTO, 'y al borde inferior');

  // Y de vuelta: la ventana deshace el camino, eje por eje.
  escena.jugador.colocar({ x: 700, y: 270 }); // cae sobre la repisa de y=300
  esperar(escena, juego, 1.5);

  const centro = escena.jugador.centro;
  assert.equal(
    Math.round(escena.camara.x),
    Math.round(centro.x - VISTA.ANCHO * CAMARA.MARGEN_X)
  );
  assert.equal(
    Math.round(escena.camara.y),
    Math.round(centro.y - VISTA.ALTO * CAMARA.MARGEN_Y)
  );
  assert.ok(escena.camara.x < 1600 - VISTA.ANCHO, 'ya no está en el borde derecho');
  assert.ok(escena.camara.y < ALTO_TORRE - VISTA.ALTO, 'ni en el inferior');
});

test('en mitad de la torre la cámara no centra al jugador: lo deja al 30 %', () => {
  const juego = juegoFalso();
  const escena = new EscenaMundo({ nivel: torre(), niveles: [] }).entrar(juego);

  // Sobre la repisa de y=300, en mitad del nivel y con aire arriba y abajo: es
  // el único sitio donde el margen vertical manda en vez del borde.
  escena.jugador.colocar({ x: 700, y: 270 });
  esperar(escena, juego, 2);

  const enPantalla = escena.camara.mundoAPantalla(escena.jugador.centro);

  assert.equal(
    enPantalla.y,
    Math.round(VISTA.ALTO * CAMARA.MARGEN_Y),
    'el jugador mira hacia abajo: queda por encima del centro'
  );
  assert.ok(enPantalla.y < VISTA.ALTO / 2, 'nunca en el centro exacto');
  assert.ok(enPantalla.x >= 0 && enPantalla.x < VISTA.ANCHO, 'y en el ancho que toca');
});

test('todos los objetos se desplazan con el MISMO offset que el jugador', () => {
  const juego = juegoFalso();
  const escena = new EscenaMundo({ nivel: torre(), niveles: [] }).entrar(juego);
  escena.jugador.colocar({ x: 700, y: 270 });
  esperar(escena, juego, 2);

  const { camara, mundo } = escena;
  const desplazamiento = camara.desplazamiento;

  for (const objeto of mundo.objetos) {
    const { x, y } = camara.mundoAPantalla(objeto);
    // La misma resta que al jugador: si alguien dibujara un objeto sin la
    // cámara, este número dejaría de cuadrar con `visible()`.
    assert.equal(x, Math.round(objeto.x - desplazamiento.x));
    assert.equal(y, Math.round(objeto.y - desplazamiento.y));

    const cabeEnPantalla =
      x + objeto.ancho > 0 && x < VISTA.ANCHO && y + objeto.alto > 0 && y < VISTA.ALTO;
    assert.equal(camara.visible(objeto.caja), cabeEnPantalla, `${objeto.tipo} en x=${objeto.x}`);
  }
});

test('la moneda y los pinchos de la zona visible usan el mismo desplazamiento', () => {
  const juego = juegoFalso();
  const escena = new EscenaMundo({ nivel: torre(), niveles: [] }).entrar(juego);
  escena.jugador.colocar({ x: 800, y: 290 });
  esperar(escena, juego, 2);

  const monedaLejana = escena.mundo.objetos.find((o) => o.tipo === 'moneda');
  const pinchosMedio = escena.mundo.objetos.find((o) => o.tipo === 'peligro');

  // El desplazamiento es uno solo, así que estos dos tienen que caer juntos.
  const m = escena.camara.mundoAPantalla(monedaLejana);
  const p = escena.camara.mundoAPantalla(pinchosMedio);

  assert.equal(m.x - monedaLejana.x, p.x - pinchosMedio.x, 'mismo dx para los dos');
  assert.equal(m.y - monedaLejana.y, p.y - pinchosMedio.y, 'mismo dy para los dos');
});

test('lo que queda fuera de la ventana no se etiqueta (y lo de dentro sí)', () => {
  const juego = juegoFalso();
  const nivel = torre();
  nivel.objetos.push({ ...suelo(1200, 60, { y: 300 }), etiqueta: 'lejos' });
  nivel.objetos.push({ ...suelo(120, 40, { y: 120 }), etiqueta: 'cerca' });

  const escena = new EscenaMundo({ nivel, niveles: [] }).entrar(juego);
  escena.jugador.colocar({ x: 60, y: 90 });
  // La cámara se coloca a mano para que no intervenga la gravedad en el encuadre.
  escena.camara.centrar(escena.jugador.centro);

  const ctx = contextoFalso();
  escena.dibujar(ctx);
  const lineas = textos(ctx);

  assert.ok(lineas.includes('cerca'), `la etiqueta de lo que se ve: ${JSON.stringify(lineas)}`);
  assert.equal(
    lineas.includes('lejos'),
    false,
    'una etiqueta a 1200 px no se pinta: está fuera de la cámara'
  );
  assert.equal(
    lineas.includes('suelo'),
    false,
    'ni la del suelo, que queda dos pantallas más abajo'
  );
});

test('un nivel que cabe entero en la vista no se desplaza', () => {
  const juego = juegoFalso();
  const nivel = {
    id: 'mini',
    orden: 1,
    nombre: 'Mini',
    dificultad: 1,
    ancho: VISTA.ANCHO,
    alto: VISTA.ALTO,
    inicio: { x: 40, y: SUELO - 20 },
    objetivo: { tipo: 'meta' },
    objetos: [suelo(0, VISTA.ANCHO), meta(400)]
  };

  const escena = new EscenaMundo({ nivel, niveles: [] }).entrar(juego);
  escena.jugador.colocar({ x: 380, y: SUELO - 20 });
  esperar(escena, juego, 1);

  assert.deepEqual(escena.camara.desplazamiento, { x: 0, y: 0 }, 'nada que enseñar de más');
});
