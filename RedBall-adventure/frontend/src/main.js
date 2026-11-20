import { Juego } from './nucleo/Juego.js';
import { Entrada } from './nucleo/Entrada.js';
import { Sonido } from './audio/Sonido.js';
import { EscenaMundo } from './escenas/EscenaMundo.js';
import { guardarProgreso, leerProgreso, normalizarProgreso } from './nucleo/Progreso.js';
import { estaDesbloqueado, nivelInicial } from './nucleo/Progresion.js';
import { PANTALLAS, Partida } from './nucleo/Partida.js';
import { Vidas } from './nucleo/Vidas.js';
import { NIVELES, idsDeNiveles } from './mundo/niveles/index.js';
import { Interfaz } from './interfaz/Interfaz.js';
import { filasDeRanking, resumenJuego, tarjetasDeNiveles, textoEstadoRecords } from './interfaz/modelo.js';
import { baseApi, crearClienteApi, idDeJugador } from './interfaz/clienteApi.js';

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
 *
 * FASE 8 — BACKEND: este archivo es el ÚNICO del juego que toca la red, y lo
 * hace siempre a través de `interfaz/clienteApi.js`:
 *   - al arrancar, fusiona el récord local con el del servidor,
 *   - al superar un nivel, anota la partida (`POST /api/records`),
 *   - al abrir RÉCORDS, pide la tabla (`GET /api/records`).
 * Si no hay servidor (abierto como archivo local, sin `npm start`, o la API
 * caída), el juego funciona exactamente igual: los récords se quedan en
 * `localStorage` y la tabla avisa de que no hay conexión.
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

/** ¿Se está jugando con el dedo? El aviso de ayuda cambia según el mando. */
function esPantallaTactil() {
  const consulta = typeof window === 'undefined' ? null : window.matchMedia?.('(pointer: coarse)');
  return Boolean(consulta?.matches);
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

  // API de récords. `disponible` es false si el juego se abrió como archivo
  // local o si no hay `window`; en ese caso no se hace ni una petición.
  const api = crearClienteApi({ base: baseApi() });
  const jugador = api.disponible ? idDeJugador() : null;

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
    // Al empezar un nivel se olvida lo que quedara pulsado: en el móvil el
    // botón táctil que abrió la pantalla anterior ya no está bajo el dedo.
    juego.entrada?.soltarTodo?.();
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
    // Los botones táctiles se esconden al abrirse el menú: se suelta todo para
    // que la bola no siga andando al reanudar con el dedo en otra parte.
    juego.entrada?.soltarTodo?.();
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

  /* ── Récords globales: la única parte del juego que sale a la red ────── */

  /**
   * Anota una partida terminada en el servidor. Es «dispara y olvida»: nunca
   * se espera el resultado para pintar nada y nunca puede romper el juego.
   * Sin API (archivo local, servidor apagado) simplemente no hace nada.
   *
   * El récord local ya está guardado por `EscenaMundo` vía `Progreso.js`;
   * esto es solo el espejo público para la tabla de mejores jugadores.
   */
  function anotarEnLaNube(datos = null) {
    if (!api.disponible || !jugador || !datos?.nivel) return Promise.resolve(null);
    return api
      .anotarPartida({
        jugador,
        partida: {
          nivel: datos.nivel,
          puntos: datos.puntos ?? 0,
          monedas: datos.monedas ?? 0,
          totalMonedas: datos.totalMonedas ?? 0,
          completado: datos.completo === true
        }
      })
      .then((resultado) => {
        if (resultado?.ok && Number.isFinite(resultado.posicion)) {
          interfaz?.avisar(`ENVIADO AL SERVIDOR · PUESTO ${resultado.posicion} EN EL RANKING`);
        }
        return resultado;
      })
      .catch(() => null);
  }

  /**
   * Fusiona el progreso local con el del servidor al arrancar: sube lo de este
   * navegador y ADOPTA lo que devuelva el servidor (que fusiona por máximos,
   * ver `backend/src/servicios/progreso.js`). Así el récord no se pierde al
   * cambiar de dispositivo, y si no hay red se sigue jugando igual.
   */
  async function sincronizarConServidor() {
    if (!api.disponible || !jugador) return null;
    const subida = await api.subirProgreso({ jugador, progreso: leerProgreso() });
    if (!subida?.ok || !subida.perfil?.progreso) return null;

    const fusionado = normalizarProgreso(subida.perfil.progreso);
    guardarProgreso(fusionado);
    progreso = fusionado;
    return subida.perfil;
  }

  /** Abre la pantalla de récords y pide la tabla (se pinta «cargando»). */
  function abrirRecords() {
    if (!partida.verRecords()) return false;
    juego.pausar();
    interfaz?.mostrarPantalla(PANTALLAS.RECORDS);
    interfaz?.pintarRecords([], { estado: textoEstadoRecords({ cargando: true }) });
    cargarRecords();
    return true;
  }

  /**
   * Pide el ranking (`GET /api/records`) y pinta lo que llegue, incluido el
   * caso de error: la pantalla siempre cuenta qué pasó, nunca se queda muda.
   */
  function cargarRecords({ nivel = null, limite = 10 } = {}) {
    const peticion = api.disponible
      ? api.records({ nivel, limite })
      : Promise.resolve({ ok: false, error: { mensaje: 'NO HAY SERVIDOR' } });

    return peticion
      .then((resultado) => {
        if (!resultado?.ok) {
          interfaz?.pintarRecords([], {
            estado: textoEstadoRecords({ error: resultado?.error?.mensaje ?? 'SIN CONEXIÓN', nivel })
          });
          return null;
        }
        interfaz?.pintarRecords(filasDeRanking(resultado.records, { jugador }), {
          estado: textoEstadoRecords({ total: resultado.total, nivel })
        });
        return resultado;
      })
      .catch(() => null);
  }

  /* ── Interfaz: botones y teclas ──────────────────────────────────────── */

  interfaz = new Interfaz({
    documento: document,
    alPedir: {
      jugar: () => jugarDesdeMenu(),
      niveles: () => abrirNiveles(),
      records: () => abrirRecords(),
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
    const datos = juego.escena?.datosHud?.() ?? null;
    interfaz.mostrarVictoria({ datos, siguiente });
    anotarEnLaNube(datos); // espejo público del récord (si hay servidor)
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

  interfaz.avisar(
    esPantallaTactil()
      ? 'Botones en pantalla: ◀ ▶ mover, SALTAR e IMPULSO'
      : 'Flechas: moverte · espacio: saltar · X: impulso · P: pausa · R: reiniciar nivel'
  );

  // El récord local y el del servidor se fusionan en segundo plano: si hay red
  // se adoptan los máximos de los dos; si no, se juega exactamente igual.
  sincronizarConServidor().catch(() => null);

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
    abrirRecords,
    cargarRecords,
    anotarEnLaNube,
    sincronizarConServidor,
    api,
    jugador,
    nivelSugerido,
    sincronizarHud
  };

  return juego;
}

arrancar().catch((error) => {
  console.error('[main] No se pudo iniciar el juego:', error);
  mostrarAviso('No se pudo iniciar el juego. Revisa la consola del navegador.');
});
