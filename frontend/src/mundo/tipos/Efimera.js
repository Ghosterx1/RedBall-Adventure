import { Plataforma } from './Plataforma.js';
import { registrarTipo } from '../registro.js';
import { MUNDO } from '../../config/ajustes.js';
import { PALETA } from '../../config/paleta.js';

/**
 * Efimera.js — plataforma que DESAPARECE tras pisarla y vuelve a aparecer.
 *
 * Propiedades propias (segundos):
 *   retardo     desde que la pisas hasta que empieza a parpadear
 *   aviso       parpadeo de aviso antes de esfumarse
 *   reaparicion tiempo que permanece oculta
 *
 * Estados: 'firme' → 'aviso' → 'oculta' → 'firme'.
 * Mientras está 'oculta' su capacidad `solido` es null, así que el motor la
 * ignora sin ninguna condición especial: desaparecer es solo dejar de ser
 * sólida.
 */
export class Efimera extends Plataforma {
  static tipo = 'efimera';

  constructor({
    retardo = MUNDO.EFIMERA_RETARDO,
    aviso = MUNDO.EFIMERA_AVISO,
    reaparicion = MUNDO.EFIMERA_REAPARICION,
    material = 'piedra',
    ...resto
  } = {}) {
    super({ ...resto, material });
    this.retardo = retardo;
    this.aviso = aviso;
    this.reaparicion = reaparicion;
    this.reiniciar();
  }

  /** Capacidad: solo es sólida mientras está visible. */
  get solido() {
    return this.estado === 'oculta' ? null : this;
  }

  get visible() {
    return this.estado !== 'oculta';
  }

  reiniciar() {
    this.estado = 'firme';
    this.cuenta = 0;
  }

  /** Alguien se apoya encima: arranca la cuenta atrás (una sola vez). */
  alPisar() {
    if (this.estado !== 'firme' || this.cuenta > 0) return false;
    this.cuenta = this.retardo;
    return true;
  }

  actualizar(dt) {
    if (this.cuenta <= 0) return;
    this.cuenta -= dt;
    if (this.cuenta > 0) return;

    if (this.estado === 'firme') {
      this.estado = 'aviso';
      this.cuenta = this.aviso;
    } else if (this.estado === 'aviso') {
      this.estado = 'oculta';
      this.cuenta = this.reaparicion;
    } else {
      this.estado = 'firme';
      this.cuenta = 0;
    }
  }

  dibujar(ctx) {
    if (this.estado === 'oculta') {
      // Marca tenue: deja ver que ahí volverá a haber plataforma.
      ctx.fillStyle = PALETA.FANTASMA_CLARA;
      ctx.fillRect(this.x, this.y + this.alto - 1, this.ancho, 1);
      return;
    }

    const parpadea = this.estado === 'aviso' && Math.floor(this.cuenta * 10) % 2 === 0;
    ctx.fillStyle = parpadea ? PALETA.AVISO : PALETA.FANTASMA;
    ctx.fillRect(this.x, this.y, this.ancho, this.alto);

    ctx.fillStyle = PALETA.FANTASMA_CLARA;
    ctx.fillRect(this.x, this.y, this.ancho, 2);
  }
}

registrarTipo(Efimera.tipo, (datos) => new Efimera(datos));
