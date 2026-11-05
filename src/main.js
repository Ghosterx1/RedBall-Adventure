import { Juego } from './nucleo/Juego.js';
import { Entrada } from './nucleo/Entrada.js';
import { Sonido } from './audio/Sonido.js';
import { EscenaMundo } from './escenas/EscenaMundo.js';
import { leerProgreso } from './nucleo/Progreso.js';
import { estaDesbloqueado, nivelInicial } from './nucleo/Progresion.js';
import { PANTALLAS, Partida } from './nucleo/Partida.js';
import { Vidas } from './nucleo/Vidas.js';
import { NIVELES, idsDeNiveles } from './mundo/niveles/index.js';
import { Interfaz } from './interfaz/Interfaz.js';
import { resumenJuego, tarjetasDeNiveles } from './interfaz/modelo.js';

/**
 * main.js — punto de entrada y CONTROLADOR DE FLUJO del juego.
 *
 * Aquí se permite tocar el DOM; ningún módulo de src/nucleo, src/fisica,
 * src/mundo, src/entidades, src/render ni src/interfaz toca `document` (la
 * interfaz recibe el documento inyectado). Este archivo es el único que decide
 * qué pantalla se ve y cuándo:
 *
 *   título → niveles → juego → pausa / victoria / derrota
 *
 * Reparto de responsabilidades (Fase 7):
 *  - `Partida` (núcleo) lleva la pantalla actual y qué saltos son legales.
 *  - `Vidas` (núcleo) lleva las vidas de toda la partida (no de un nivel).
 *  - `EscenaMundo` juega el nivel y avisa por el bus: `nivel:completado`,
 *    `vida:perdida`, `partida:derrota`.
 *  - `Interfaz` pinta el HUD y las pantallas; no decide nada.
 *  - Aquí solo se traduce "el jugador pulsó JUGAR" a "cambia de escena y quita
 *    el overlay".
 *
 * URLs de depuración:
 *   ?nivel=nivel-3   arranca directamente ese nivel (se salta el menú)
 *   ?depurar=1       añade las líneas técnicas dentro del canvas
 */

/** Lee los parámetros de la URL sin romper si no hay `window` (pruebas). */
function ajustesDeUrl() {
  const busqueda = typeof window === 'undefined' ? '' : window.location?.search ?? '';
  const parametros = new URLSearchParams(busqueda);
  const depurar = parametros.get('depurar');
  return {
    nivel: parametros.get('nivel'),
    depurar: depurar === '1' || depurar === 'true'
  };
}

function mostrarAviso(texto) {
  const aviso = document.getElementById('aviso');
  if (!aviso) return;
  aviso.textContent = texto;
  aviso.classList.add('aviso--error');
}

/**
 * Arranque del juego. Ver el comentario de cabecera para el reparto de
 * responsabilidades; `main.js` solo conecta piezas.
 */

async function arrancar() {
  const lienzo = document.getElementById('juego');
  if (!lienzo) throw new Error('No se encontró el <canvas id="juego"> en index.html');

  // Esperar la fuente evita que el HUD y los menús cambien de ancho al cargar.
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* la fuente no es crítica */
    }
  }

  const ajustes = ajustesDeUrl();
  const ids = idsDeNiveles(NIVELES);

  /** @type {Interfaz|null} se crea más abajo; los callbacks lo leen sin problema. */
  let interfaz = null;
  const juego = new Juego({
    lienzo,
    sonido: new Sonido(),
    // Cada cuadro, después de dibujar: del estado de la escena al HUD del DOM.
    alDibujar: () => sincronizarHud()
  });
  const partida = new Partida();
  const vidas = new Vidas();
  let progreso = leerProgreso();
  let nivelActual = null;
  let siguienteNivelId = null;

  /* ── Flujo: de un botón a un cambio de escena ─────────────────────────── */

  function sincronizarHud() {
    const datos = juego.escena?.datosHud?.() ?? null;
    interfaz?.sincronizarHud(datos);
    return datos;
  }

  function enfocarLienzo() {
    lienzo.focus?.({ preventScroll: true });
  }

  function esNivelConocido(id) {
    return typeof id === 'string' && ids.includes(id);
  }

  /**
   * Nivel que toca jugar: el de la URL (`?nivel=`) o el primero desbloqueado
   * SIN completar; si ya está todo hecho, el último (para poder repetirlo).
   */
  function nivelSugerido() {
    if (esNivelConocido(ajustes.nivel)) return ajustes.nivel;
    progreso = leerProgreso(); // el récord manda: puede haber cambiado al ganar
    try {
      return nivelInicial(progreso, ids) ?? ids[0] ?? null;
    } catch {
      return ids[0] ?? null;
    }
  }

  /**
   * Arranca (o reinicia) un nivel: partida en JUGAR, escena nueva y overlay
   * fuera. `vidasNuevas` reinicia el contador (al reintentar tras la derrota).
   */
  function jugarNivel(id, { vidasNuevas = false } = {}) {
    if (!esNivelConocido(id)) return null;
    if (vidasNuevas) vidas.reiniciar();

    partida.jugar();
    nivelActual = id;
    siguienteNivelId = null;

    const escena = new EscenaMundo({
      nivelId: id,
      niveles: NIVELES,
      vidas, // las vidas duran toda la partida, no solo este nivel
      autoAvanzar: false // el paso al siguiente lo decide la pantalla de victoria
    });
    escena.depuracion = ajustes.depurar;

    juego.cambiarEscena(escena);
    juego.reanudar();
    interfaz?.mostrarPantalla(null);
    sincronizarHud();
    enfocarLienzo();
    return escena;
  }

  function reiniciarNivel({ vidasNuevas = false } = {}) {
    return jugarNivel(nivelActual ?? nivelSugerido(), { vidasNuevas });
  }

  function jugarDesdeMenu() {
    return jugarNivel(nivelSugerido());
  }

  function jugarSiguiente() {
    return siguienteNivelId ? jugarNivel(siguienteNivelId) : reiniciarNivel();
  }

  function elegirNivel(id) {
    progreso = leerProgreso();
    if (!estaDesbloqueado(progreso, id, ids)) {
      interfaz?.avisar('Ese nivel sigue bloqueado: supera el anterior.');
      return null;
    }
    return jugarNivel(id, { vidasNuevas: true });
  }

  function pausarPartida() {
    if (partida.pantalla !== PANTALLAS.JUEGO) return false;
    partida.pausar();
    juego.pausar(); // congela la simulación (el nivel se ve quieto detrás)
    interfaz?.mostrarPausa(juego.escena?.datosHud?.() ?? null);
    return true;
  }

  function reanudarPartida() {
    if (partida.pantalla !== PANTALLAS.PAUSA) return false;
    partida.reanudar();
    juego.reanudar();
    interfaz?.mostrarPantalla(null);
    enfocarLienzo();
    return true;
  }

  function alternarPausa() {
    return partida.pantalla === PANTALLAS.PAUSA ? reanudarPartida() : pausarPartida();
  }

  function abrirNiveles() {
    if (!partida.verNiveles()) return false;
    juego.pausar();
    progreso = leerProgreso(); // el récord puede haber cambiado al ganar
    interfaz?.pintarNiveles(tarjetasDeNiveles(progreso, NIVELES), resumenJuego(progreso, NIVELES));
    interfaz?.mostrarPantalla(PANTALLAS.NIVELES);
    return true;
  }

  function irAlTitulo() {
    if (!partida.volverAlTitulo()) return false;
    juego.pausar();
    progreso = leerProgreso();
    interfaz?.mostrarPantalla(PANTALLAS.TITULO);
    return true;
  }

  /* ── Interfaz: botones y teclas ──────────────────────────────────────── */

  interfaz = new Interfaz({
    documento: document,
    alPedir: {
      jugar: () => jugarDesdeMenu(),
      niveles: () => abrirNiveles(),
      menu: () => irAlTitulo(),
      elegirNivel: (id) => elegirNivel(id),
      reanudar: () => reanudarPartida(),
      reiniciar: () => reiniciarNivel(),
      siguiente: () => jugarSiguiente(),
      repetir: () => reiniciarNivel(),
      reintentar: () => reiniciarNivel({ vidasNuevas: true })
    }
  });

  juego.entrada = new Entrada({
    // Perder el foco (cambio de pestaña, clic fuera) abre la PAUSA con menú: la
    // partida no sigue corriendo a espaldas del jugador.
    alPerderFoco: () => pausarPartida()
  });
  juego.entrada.conectar();
  juego.entrada.conectarTactil(document);

  // El bus avisa de lo que pasa en el nivel; aquí se traduce a pantallas.
  juego.bus.on('nivel:completado', ({ siguiente = null } = {}) => {
    siguienteNivelId = siguiente;
    progreso = leerProgreso();
    if (partida.pantalla !== PANTALLAS.JUEGO) return;
    partida.ganar();
    juego.pausar();
    interfaz.mostrarVictoria({ datos: juego.escena?.datosHud?.() ?? null, siguiente });
  });

  juego.bus.on('partida:derrota', () => {
    if (partida.pantalla !== PANTALLAS.JUEGO) return;
    partida.perder();
    juego.pausar();
    interfaz.mostrarDerrota(juego.escena?.datosHud?.() ?? null);
  });

  /**
   * Teclas de la INTERFAZ (las del juego las lleva nucleo/Entrada.js):
   * P/Esc pausa, R reinicia, Intro/Espacio confirma en los menús.
   */
  const alPulsarTecla = (evento) => {
    if (evento.repeat) return;
    const code = evento.code;

    if (code === 'KeyP' || code === 'Escape') {
      if (partida.pantalla === PANTALLAS.JUEGO || partida.pantalla === PANTALLAS.PAUSA) {
        evento.preventDefault?.();
        alternarPausa();
      } else if (partida.terminada) {
        evento.preventDefault?.();
        abrirNiveles();
      }
      return;
    }

    if (code === 'KeyR') {
      if (partida.enJuego) {
        evento.preventDefault?.();
        reiniciarNivel();
      }
      return;
    }

    if (code !== 'Enter' && code !== 'Space') return;
    // En el juego, Espacio salta: solo se intercepta fuera de la partida.
    if (partida.pantalla === PANTALLAS.TITULO || partida.pantalla === PANTALLAS.NIVELES) {
      evento.preventDefault?.();
      jugarDesdeMenu();
    } else if (partida.pantalla === PANTALLAS.PAUSA) {
      evento.preventDefault?.();
      reanudarPartida();
    } else if (partida.pantalla === PANTALLAS.VICTORIA) {
      evento.preventDefault?.();
      jugarSiguiente();
    } else if (partida.pantalla === PANTALLAS.DERROTA) {
      evento.preventDefault?.();
      reiniciarNivel({ vidasNuevas: true });
    }
  };
  window.addEventListener('keydown', alPulsarTecla);

  // El lienzo toma el foco al primer clic para que el teclado responda igual
  // con teclado físico en cualquier navegador.
  lienzo.addEventListener('pointerdown', () => lienzo.focus({ preventScroll: true }));

  // Los navegadores no dejan sonar nada antes de un gesto del usuario: el
  // primer clic (o la primera tecla) desbloquea el audio. Si el navegador no
  // tiene Web Audio, `desbloquear()` no hace nada y el juego sigue igual.
  const desbloquearAudio = () => juego.sonido?.desbloquear();
  lienzo.addEventListener('pointerdown', desbloquearAudio);
  window.addEventListener('keydown', desbloquearAudio, { once: true });

  /* ── Arranque ────────────────────────────────────────────────────────── */

  juego.iniciar();

  if (esNivelConocido(ajustes.nivel)) {
    // ?nivel=... salta el menú: cómodo para probar un nivel suelto.
    jugarNivel(ajustes.nivel);
  } else {
    interfaz.mostrarPantalla(PANTALLAS.TITULO);
  }

  interfaz.avisar('Flechas: moverte · espacio: saltar · X: impulso · P: pausa · R: reiniciar nivel');

  // Herramientas de depuración cómodas en la consola del navegador: `juego`
  // para mirar el estado y `partidaUI` para forzar pantallas sin jugar.
  window.juego = juego;
  window.interfaz = interfaz;
  window.partidaUI = {
    partida,
    vidas,
    jugarNivel,
    reiniciarNivel,
    jugarDesdeMenu,
    jugarSiguiente,
    elegirNivel,
    pausarPartida,
    reanudarPartida,
    alternarPausa,
    abrirNiveles,
    irAlTitulo,
    nivelSugerido,
    sincronizarHud
  };

  return juego;
}

arrancar().catch((error) => {
  console.error('[main] No se pudo iniciar el juego:', error);
  mostrarAviso('No se pudo iniciar el juego. Revisa la consola del navegador.');
});
