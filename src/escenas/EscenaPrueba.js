import { VISTA } from '../config/ajustes.js';
import { PALETA } from '../config/paleta.js';
import { ACCIONES } from '../nucleo/Entrada.js';
import { Jugador } from '../entidades/Jugador.js';
import { dibujarPelota } from '../render/pelota.js';

/**
 * EscenaPrueba.js — TEMPORAL: banco de pruebas de la física (Fase 2).
 *
 * Permite ver y medir, sin nivel real todavía:
 *  - movimiento fluido con aceleración y fricción,
 *  - salto de altura variable (mantener el botón o soltarlo),
 *  - aterrizaje y rebote sobre la plataforma elástica,
 *  - colisiones sólidas contra piedra, hielo y césped.
 *
 * La física NO vive aquí: está en src/fisica/, y el personaje en
 * src/entidades/Jugador.js. Esta escena solo cablea entrada, mundo y dibujo.
 * En la Fase 4 se sustituye por las escenas reales con nivel.
 */

const SUELO_Y = VISTA.ALTO - 40;
const LADO_BOLA = 24;

/** Bordes del lienzo: laterales y techo. No hay suelo implícito (se puede caer). */
const LIMITES = Object.freeze({ ancho: VISTA.ANCHO, alto: VISTA.ALTO });

/**
 * Mundo de pruebas. `material` decide fricción y rebote (config/materiales.js).
 * Las plataformas flotan por encima de la bola para no cruzarse en su camino.
 */
const SOLIDOS = Object.freeze([
  { x: 0, y: SUELO_Y, ancho: VISTA.ANCHO, alto: VISTA.ALTO - SUELO_Y, material: 'cesped' },
  { x: 128, y: SUELO_Y - 64, ancho: 96, alto: 8, material: 'piedra' },
  { x: 264, y: SUELO_Y - 104, ancho: 80, alto: 8, material: 'hielo' },
  { x: 352, y: SUELO_Y - 44, ancho: 72, alto: 8, material: 'blando' }
]);

const COLOR_SUPERFICIE = Object.freeze({
  cesped: PALETA.PASTO,
  piedra: PALETA.PIEDRA,
  hielo: PALETA.PIEDRA_HIELO,
  blando: PALETA.ORO,
  rompible: PALETA.TIERRA
});

export class EscenaPrueba {
  constructor() {
    this.jugador = null;
    this.tiempo = 0;
    this.desplazamiento = 0;
    this.saltos = 0;
    this.rebotes = 0;
  }

  entrar() {
    this.jugador = new Jugador({
      x: 40,
      y: SUELO_Y - LADO_BOLA,
      ancho: LADO_BOLA,
      alto: LADO_BOLA,
      enSuelo: true
    });
    this.tiempo = 0;
    this.desplazamiento = 0;
    this.saltos = 0;
    this.rebotes = 0;
    return this;
  }

  actualizar(dt, juego) {
    const entrada = juego.entrada;
    const j = this.jugador;
    if (!j) return;

    // Traducción entrada → control. La entidad no conoce teclas ni acciones.
    j.actualizar(dt, {
      control: {
        eje: entrada.ejeHorizontal(),
        salto: entrada.recienPresionada(ACCIONES.SALTO),
        saltoMantenido: entrada.estaPresionada(ACCIONES.SALTO),
        impulso: entrada.recienPresionada(ACCIONES.IMPULSO)
      },
      solidos: SOLIDOS,
      limites: LIMITES
    });

    if (j.saltoHecho) this.saltos++;
    if (j.reboto) this.rebotes++;

    this.tiempo += dt;
    this.desplazamiento += Math.abs(j.vx) * dt;
  }

  dibujar(ctx) {
    const j = this.jugador;

    // Cielo y sol
    ctx.fillStyle = PALETA.CIELO;
    ctx.fillRect(0, 0, VISTA.ANCHO, VISTA.ALTO);
    ctx.fillStyle = PALETA.SOL_A;
    ctx.beginPath();
    ctx.arc(400, 52, 22, 0, Math.PI * 2);
    ctx.fill();

    // Colinas
    ctx.fillStyle = PALETA.COLINA_LEJANA;
    ctx.beginPath();
    ctx.ellipse(120, SUELO_Y + 10, 150, 70, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(380, SUELO_Y + 12, 170, 58, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETA.COLINA_CERCANA;
    ctx.beginPath();
    ctx.ellipse(250, SUELO_Y + 20, 200, 46, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Suelo (primer sólido del mundo de pruebas)
    const suelo = SOLIDOS[0];
    ctx.fillStyle = PALETA.TIERRA;
    ctx.fillRect(suelo.x, suelo.y, suelo.ancho, suelo.alto);
    ctx.fillStyle = PALETA.PASTO;
    ctx.fillRect(suelo.x, suelo.y, suelo.ancho, 6);
    ctx.fillStyle = PALETA.PASTO_ALTO;
    ctx.fillRect(suelo.x, suelo.y, suelo.ancho, 2);

    // Plataformas: el color lo decide el material
    for (const solido of SOLIDOS) {
      if (solido === suelo) continue;
      ctx.fillStyle = COLOR_SUPERFICIE[solido.material] ?? PALETA.PIEDRA;
      ctx.fillRect(solido.x, solido.y, solido.ancho, solido.alto);
      ctx.fillStyle = PALETA.BLANCO;
      ctx.fillRect(solido.x, solido.y, solido.ancho, 1);
    }

    if (!j) return;

    // Bola: el dibujo es compartido con la escena real (render/pelota.js).
    dibujarPelota(ctx, j);

    // Métricas: son el criterio de aceptación visible de la fase.
    ctx.fillStyle = PALETA.TEXTO_AZUL;
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`t = ${this.tiempo.toFixed(2)} s`, 8, 8);
    ctx.fillText(`x = ${j.x.toFixed(1)}  vx = ${j.vx.toFixed(0)}`, 8, 22);
    ctx.fillText(`vy = ${j.vy.toFixed(0)}  suelo: ${j.enSuelo ? 'si' : 'no'}`, 8, 36);
    ctx.fillText(`saltos ${this.saltos}  rebotes ${this.rebotes}`, 8, 50);
    ctx.fillText(`recorrido = ${this.desplazamiento.toFixed(0)} px`, 8, 64);
  }
}
