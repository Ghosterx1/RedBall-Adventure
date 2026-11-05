import { PANTALLAS } from '../nucleo/Partida.js';
import { resumenPartida } from './modelo.js';

/**
 * Interfaz.js — la capa DOM: HUD y pantallas (título, niveles, pausa, final).
 *
 * Reglas que sigue este módulo:
 *  1. NO decide nada del juego: recibe datos ya cocinados (`datosHud()`,
 *     `tarjetasDeNiveles()`…) y los escribe en el HTML. La lógica pura vive en
 *     `src/nucleo` y `src/interfaz/modelo.js`.
 *  2. NO conoce `window` ni el bucle: solo el `document` que se le inyecta (en
 *     pruebas, un doble). Si falta un elemento del HTML, ese método no hace nada
 *     en vez de romper el juego: el canvas sigue jugable sin interfaz.
 *  3. Las pantallas son SECCIONES del HTML que se muestran u ocultan con la
 *     clase `pantalla--activa`; nunca se pinta texto de menú dentro del canvas.
 *
 * Los ids se exportan para que `pruebas/integracion.test.js` compruebe que
 * `index.html` y esta clase no se separan nunca.
 */

/** Todo lo que esta clase busca en el documento (el canvas y el aviso aparte). */
export const IDS_INTERFAZ = Object.freeze({
  hud: 'hud',
  monedas: 'hud-monedas',
  puntos: 'hud-puntos',
  record: 'hud-record',
  vidas: 'hud-vidas',
  barra: 'hud-progreso',
  relleno: 'hud-progreso-relleno',
  nivel: 'hud-nivel',
  resumenNiveles: 'niveles-resumen',
  rejillaNiveles: 'rejilla-niveles',
  resumenPausa: 'pausa-resumen',
  resumenVictoria: 'victoria-resumen',
  resumenDerrota: 'derrota-resumen',
  botonSiguiente: 'boton-siguiente',
  aviso: 'aviso'
});

/** Pantalla (modo de `Partida`) → sección del HTML que hay que enseñar. */
export const PANTALLAS_INTERFAZ = Object.freeze({
  [PANTALLAS.TITULO]: 'pantalla-titulo',
  [PANTALLAS.NIVELES]: 'pantalla-niveles',
  [PANTALLAS.PAUSA]: 'pantalla-pausa',
  [PANTALLAS.VICTORIA]: 'pantalla-victoria',
  [PANTALLAS.DERROTA]: 'pantalla-derrota'
});

/** Botón del HTML → intención que se avisa a `main.js`. */
export const BOTONES_INTERFAZ = Object.freeze({
  'boton-jugar': 'jugar',
  'boton-niveles': 'niveles',
  'boton-niveles-menu': 'menu',
  'boton-continuar': 'reanudar',
  'boton-reiniciar': 'reiniciar',
  'boton-pausa-niveles': 'niveles',
  'boton-pausa-menu': 'menu',
  'boton-siguiente': 'siguiente',
  'boton-repetir': 'repetir',
  'boton-victoria-niveles': 'niveles',
  'boton-reintentar': 'reintentar',
  'boton-derrota-niveles': 'niveles'
});

export class Interfaz {
  /**
   * @param {object}   opciones
   * @param {Document} [opciones.documento] documento real (en pruebas, un doble)
   * @param {object}   [opciones.alPedir]   intenciones: jugar, niveles, menu,
   *   reanudar, reiniciar, siguiente, repetir, reintentar, elegirNivel(id)
   */
  constructor({ documento = globalThis.document ?? null, alPedir = {} } = {}) {
    this.documento = documento ?? null;
    this.alPedir = alPedir ?? {};
    this.cache = new Map();
    /** Última firma pintada del HUD: si no cambia, no se vuelve a tocar el DOM. */
    this.firmaHud = '';
    this.ultimoHud = null;
    this.firmaVidas = '';
    this.temporizadorPop = null;
    this.conectarBotones();
  }

  /** ¿Hay HTML de interfaz conectado? (sin él todo es inofensivo). */
  get disponible() {
    return Boolean(this.elemento(IDS_INTERFAZ.hud));
  }

  /** Elemento por id, cacheado: se busca una vez por sesión. */
  elemento(id) {
    if (typeof this.documento?.getElementById !== 'function') return null;
    if (this.cache.has(id)) return this.cache.get(id);
    const elemento = this.documento.getElementById(id) ?? null;
    this.cache.set(id, elemento);
    return elemento;
  }

  /* ── HUD ─────────────────────────────────────────────────────────────── */

  /**
   * Vuelca `EscenaMundo.datosHud()` en el HUD. Se llama cada cuadro, pero solo
   * escribe si algo ha cambiado (firma en texto): cero repintados inútiles.
   * Devuelve true si ha pintado algo.
   */
  sincronizarHud(datos) {
    if (!datos || !this.elemento(IDS_INTERFAZ.hud)) return false;

    const porcentaje = Math.round(limitar(numero(datos.progreso, 0), 0, 1) * 100);
    const monedas = entero(datos.monedas, 0);
    const puntos = entero(datos.puntos, 0);
    const record = entero(datos.record, 0);
    const firma = [
      datos.nivel,
      datos.nombre,
      datos.numero,
      datos.total,
      monedas,
      entero(datos.totalMonedas, 0),
      puntos,
      record,
      datos.vidas,
      datos.vidasMaximo,
      porcentaje
    ].join('|');
    if (firma === this.firmaHud) return false;

    const anterior = this.ultimoHud;
    this.firmaHud = firma;
    this.ultimoHud = datos;

    this.#texto(IDS_INTERFAZ.monedas, `${monedas}/${entero(datos.totalMonedas, 0)}`);
    this.#texto(IDS_INTERFAZ.puntos, String(puntos));
    this.#texto(
      IDS_INTERFAZ.nivel,
      `NIVEL ${entero(datos.numero, 1)}/${entero(datos.total, 1)} · ${datos.nombre ?? ''}`.toUpperCase()
    );

    const etiquetaRecord = this.elemento(IDS_INTERFAZ.record);
    if (etiquetaRecord) {
      etiquetaRecord.textContent = `RÉCORD ${record}`;
      etiquetaRecord.hidden = record <= 0; // sin récord no se enseña la etiqueta
    }

    const relleno = this.elemento(IDS_INTERFAZ.relleno);
    if (relleno?.style) relleno.style.width = `${porcentaje}%`;

    const barra = this.elemento(IDS_INTERFAZ.barra);
    if (typeof barra?.setAttribute === 'function') {
      barra.setAttribute('aria-valuenow', String(porcentaje));
    }

    this.pintarVidas(datos.vidas, datos.vidasMaximo);

    // Efecto de la recogida: el contador da un salto cuando sube.
    if (anterior && monedas > entero(anterior.monedas, 0)) this.destelloMoneda();
    return true;
  }

  /** Corazones = vidas máximas; los gastados se pintan apagados. */
  pintarVidas(restantes = 0, maximo = 0) {
    const contenedor = this.elemento(IDS_INTERFAZ.vidas);
    if (!contenedor || typeof this.documento?.createElement !== 'function') return false;

    const disponibles = Math.max(0, entero(restantes, 0));
    const total = Math.max(disponibles, entero(maximo, disponibles));
    const firma = `${disponibles}/${total}`;
    if (firma === this.firmaVidas) return false;
    this.firmaVidas = firma;

    const corazones = [];
    for (let i = 0; i < total; i++) {
      const corazon = this.documento.createElement('span');
      corazon.className = i < disponibles ? 'vidas__corazon' : 'vidas__corazon vidas__corazon--vacia';
      corazones.push(corazon);
    }
    this.#reemplazar(contenedor, corazones);
    return true;
  }

  /** Salto del contador de monedas (unos 0,34 s, definido en ui.css). */
  destelloMoneda() {
    const valor = this.elemento(IDS_INTERFAZ.monedas);
    if (!valor?.classList?.add) return false;
    valor.classList.remove('hud__valor--pop');
    valor.classList.add('hud__valor--pop');
    if (this.temporizadorPop) clearTimeout(this.temporizadorPop);
    this.temporizadorPop = setTimeout(() => {
      valor.classList.remove('hud__valor--pop');
      this.temporizadorPop = null;
    }, 340);
    this.temporizadorPop?.unref?.();
    return true;
  }

  /* ── Pantallas ───────────────────────────────────────────────────────── */

  /**
   * Enseña la pantalla del modo indicado. `null` (o `PANTALLAS.JUEGO`) no
   * enseña ninguna: el lienzo se ve limpio y solo queda el HUD.
   * Devuelve el id de la sección activada (o null).
   */
  mostrarPantalla(pantalla = null) {
    const activa = pantalla ? PANTALLAS_INTERFAZ[pantalla] ?? null : null;
    let aplicada = false;
    for (const id of Object.values(PANTALLAS_INTERFAZ)) {
      const elemento = this.elemento(id);
      if (!elemento?.classList?.add) continue;
      if (id === activa) elemento.classList.add('pantalla--activa');
      else elemento.classList.remove('pantalla--activa');
      aplicada = true;
    }
    return aplicada ? activa : null;
  }

  /** Menú de pausa con el estado de la partida congelada. */
  mostrarPausa(datos = null) {
    this.#texto(IDS_INTERFAZ.resumenPausa, resumenPartida(datos));
    this.mostrarPantalla(PANTALLAS.PAUSA);
    return PANTALLAS.PAUSA;
  }

  /**
   * Pantalla de victoria. `siguiente` es el id del nivel que se abre; si es
   * null (último nivel) el botón de seguir desaparece y queda el de repetir.
   */
  mostrarVictoria({ datos = null, siguiente = null } = {}) {
    this.#texto(IDS_INTERFAZ.resumenVictoria, resumenPartida(datos));

    const boton = this.elemento(IDS_INTERFAZ.botonSiguiente);
    if (boton) {
      const haySiguiente = Boolean(siguiente);
      boton.hidden = !haySiguiente;
      boton.disabled = !haySiguiente;
      boton.textContent = haySiguiente ? 'SIGUIENTE NIVEL' : 'ÚLTIMO NIVEL';
    }

    this.mostrarPantalla(PANTALLAS.VICTORIA);
    return PANTALLAS.VICTORIA;
  }

  /** Pantalla de derrota (sin vidas). */
  mostrarDerrota(datos = null) {
    this.#texto(IDS_INTERFAZ.resumenDerrota, resumenPartida(datos));
    this.mostrarPantalla(PANTALLAS.DERROTA);
    return PANTALLAS.DERROTA;
  }

  /**
   * Rejilla de niveles a partir de `modelo.tarjetasDeNiveles()`.
   * Cada tarjeta es un `<button data-nivel="id">`; las bloqueadas van
   * deshabilitadas y sin escucha, así no hay forma de colarse en un nivel.
   */
  pintarNiveles(tarjetas = [], resumen = null) {
    if (resumen) {
      this.#texto(IDS_INTERFAZ.resumenNiveles, `COMPLETADOS ${resumen.completados}/${resumen.total}`);
    }

    const rejilla = this.elemento(IDS_INTERFAZ.rejillaNiveles);
    if (!rejilla || typeof this.documento?.createElement !== 'function') return 0;

    const nodos = tarjetas.map((tarjeta) => this.#crearTarjeta(tarjeta));
    this.#reemplazar(rejilla, nodos);
    return nodos.length;
  }

  /** Texto libre en el aviso de debajo del lienzo. */
  avisar(texto = '') {
    const aviso = this.elemento(IDS_INTERFAZ.aviso);
    if (!aviso) return false;
    aviso.textContent = texto;
    return true;
  }

  /** Engancha los botones del HTML a las intenciones de `alPedir`. */
  conectarBotones() {
    let conectados = 0;
    for (const [id, accion] of Object.entries(BOTONES_INTERFAZ)) {
      const boton = this.elemento(id);
      if (typeof boton?.addEventListener !== 'function') continue;
      boton.addEventListener('click', (evento) => {
        evento?.preventDefault?.();
        this.alPedir[accion]?.();
      });
      conectados += 1;
    }
    return conectados;
  }

  /* ── Interno ─────────────────────────────────────────────────────────── */

  #crearTarjeta(tarjeta) {
    const boton = this.documento.createElement('button');
    boton.type = 'button';
    boton.className = [
      'nivel',
      tarjeta.bloqueado ? 'nivel--bloqueado' : '',
      tarjeta.completado ? 'nivel--completado' : ''
    ]
      .filter(Boolean)
      .join(' ');
    boton.dataset.nivel = tarjeta.id;
    boton.dataset.numero = String(tarjeta.numero);
    boton.setAttribute?.('aria-label', etiquetaDeTarjeta(tarjeta));
    boton.appendChild(this.#nodo('span', 'nivel__numero', String(tarjeta.numero)));

    if (tarjeta.bloqueado) {
      boton.disabled = true;
      boton.appendChild(this.#nodo('span', 'nivel__candado', 'BLOQUEADO'));
      return boton;
    }

    boton.appendChild(this.#nodo('span', 'nivel__nombre', tarjeta.nombre));
    boton.appendChild(this.#nodoDificultad(tarjeta));
    boton.appendChild(this.#nodo('span', 'nivel__monedas', `${tarjeta.monedas}/${tarjeta.totalMonedas}`));
    if (tarjeta.completado) boton.appendChild(this.#nodo('span', 'nivel__sello', 'OK'));
    boton.addEventListener('click', () => this.alPedir.elegirNivel?.(tarjeta.id));
    return boton;
  }

  #nodoDificultad(tarjeta) {
    const caja = this.documento.createElement('span');
    caja.className = 'nivel__dificultad';
    caja.setAttribute?.('aria-label', `Dificultad ${tarjeta.dificultad} de ${tarjeta.dificultadMaxima}`);
    for (let i = 0; i < tarjeta.dificultadMaxima; i++) {
      const punto = this.documento.createElement('i');
      punto.className = i < tarjeta.dificultad ? 'nivel__punto nivel__punto--lleno' : 'nivel__punto';
      caja.appendChild(punto);
    }
    return caja;
  }

  #nodo(etiqueta, clase, texto) {
    const nodo = this.documento.createElement(etiqueta);
    nodo.className = clase;
    nodo.textContent = texto;
    return nodo;
  }

  #reemplazar(contenedor, nodos) {
    if (typeof contenedor.replaceChildren === 'function') {
      contenedor.replaceChildren(...nodos);
      return;
    }
    while (contenedor.firstChild) contenedor.removeChild(contenedor.firstChild);
    for (const nodo of nodos) contenedor.appendChild(nodo);
  }

  #texto(id, texto) {
    const elemento = this.elemento(id);
    if (!elemento) return false;
    elemento.textContent = texto;
    return true;
  }
}

/** Texto accesible de una tarjeta (lectores de pantalla). */
function etiquetaDeTarjeta(tarjeta) {
  if (tarjeta.bloqueado) return `Nivel ${tarjeta.numero}: bloqueado, supera el anterior`;
  const estado = tarjeta.completado ? 'completado' : 'disponible';
  return `Nivel ${tarjeta.numero}: ${tarjeta.nombre}, ${estado}`;
}

function numero(valor, porDefecto) {
  return Number.isFinite(valor) ? valor : porDefecto;
}

function entero(valor, porDefecto) {
  return Number.isFinite(valor) ? Math.floor(valor) : porDefecto;
}

function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}
