import { NIVEL, VISTA } from '../config/ajustes.js';
import { PALETA } from '../config/paleta.js';
import { ACCIONES } from '../nucleo/Entrada.js';
import { Marcador } from '../nucleo/Marcador.js';
import { guardarProgreso, leerProgreso, registrarPartida, registroDe } from '../nucleo/Progreso.js';
import { Jugador } from '../entidades/Jugador.js';
import { Mundo } from '../mundo/Mundo.js';
import { NIVEL_DEMO } from '../mundo/niveles/demo.js';
import {
  NIVELES,
  idDeNivel,
  indiceDeNivel,
  nivelPorId,
  siguienteNivel
} from '../mundo/niveles/index.js';
import { estadoObjetivo, normalizarObjetivo, textoObjetivo } from '../mundo/objetivo.js';
import { Camara } from '../render/Camara.js';
import { dibujarPelota } from '../render/pelota.js';
import { Particulas } from '../render/particulas.js';

/**
 * EscenaMundo.js — primera escena "real": consume un NIVEL (datos) y las
 * mecánicas de src/mundo/.
 *
 * La escena solo CABLEA: entrada → mundo → jugador → zonas → cámara → dibujo.
 * No conoce ningún tipo de objeto: pide `mundo.solidos`, `mundo.superficies`…
 * Por eso añadir un objeto nuevo no la toca.
 *
 * También es quien traduce los EVENTOS del mundo a efectos: una moneda recogida
 * suma en el marcador, suena (el sonido se inyecta en `juego.sonido`) y lanza
 * una chispa de partículas; un bote o un aterrizaje fuerte levantan polvo; y si
 * con ello se cumple el OBJETIVO del nivel, se guarda el récord y se avisa por
 * el bus (`nivel:completado`) para que la interfaz enseñe la victoria. Los
 * objetos ni suenan ni saben puntuar, y el motor no sabe cuál es el objetivo:
 * eso es dato del nivel (mundo/objetivo.js).
 *
 * HUD: dentro del canvas solo se pinta la MISIÓN del nivel y los avisos
 * momentáneos. Monedas, puntos, vidas y barra de progreso salen de `datosHud()`
 * y los pinta la interfaz del DOM (src/interfaz/Interfaz.js). El canvas no
 * duplica contadores: si algún día cambia el diseño, solo hay una verdad.
 *
 * Orden de un paso (importante, ver Mundo.js):
 *   1. mover el mundo      (plataformas y obstáculos publican su delta)
 *   2. transportar         (quien va encima de algo móvil se mueve con ello)
 *   3. mover al jugador    (física con los sólidos de ESTE paso)
 *   4. revisar zonas       (recogida, checkpoint, meta, peligro, caída, pisada)
 *   5. comprobar objetivo  (¿monedas? ¿meta? ¿meta con monedas?)
 */

const LADO_BOLA = 24;
/** Segundos que dura el marco rojo al reaparecer y el aviso en pantalla. */
const DESTELLO = 0.25;
const AVISO_TIEMPO = 1.2;


export class EscenaMundo {
  /**
   * @param {object}   opciones
   * @param {object}   [opciones.nivel]     datos del nivel (tienen prioridad)
   * @param {string}   [opciones.nivelId]   id a buscar en el catálogo
   * @param {object[]} [opciones.niveles]   catálogo (por defecto, el del juego)
   * @param {object}   [opciones.vidas]     instancia de nucleo/Vidas.js que
   *   comparte toda la partida. Sin ella NO hay límite de vidas: el motor no
   *   impone "game over" y el bot de las pruebas puede morir sin acabar.
   * @param {boolean}  [opciones.autoAvanzar] true (por defecto) pasa de nivel
   *   sola tras `NIVEL.TRANSICION`; false deja que la interfaz enseñe la
   *   pantalla de victoria y decida qué hacer.
   *
   * Sin argumentos abre el nivel de demostración: las pruebas y la depuración
   * siguen funcionando igual que antes de existir el catálogo.
   */
  constructor({
    nivel = null,
    nivelId = null,
    niveles = NIVELES,
    vidas = null,
    autoAvanzar = true
  } = {}) {
    /** Catálogo con el que se resuelve `nivelId` y el "siguiente nivel". */
    this.niveles = niveles;
    /** Datos del nivel que se juega. */
    this.nivel = nivel ?? nivelPorId(nivelId, niveles) ?? NIVEL_DEMO;
    /** Identificador estable para guardar el récord por nivel. */
    this.nivelId = idDeNivel(this.nivel);
    /** Posición en el catálogo (-1 si el nivel no pertenece a él). */
    this.indice = indiceDeNivel(this.nivelId, niveles);
    this.totalNiveles = niveles.length;
    /** Nivel siguiente (null si es el último o no está en el catálogo). */
    this.siguiente = siguienteNivel(this.nivelId, niveles);
    /** Objetivo de finalización, normalizado a datos. */
    this.objetivo = normalizarObjetivo(this.nivel.objetivo);

    this.mundo = null;
    this.jugador = null;
    this.camara = null;
    this.tiempo = 0;
    this.destello = 0;
    this.mensaje = '';
    this.mensajeTiempo = 0;
    this.reinicios = 0;
    this.checkpoints = 0;
    this.etiquetas = true;

    /** Puntos y monedas de esta partida. */
    this.marcador = new Marcador();
    /** Progreso persistido (récord por nivel) y su almacén. */
    this.progreso = null;
    this.almacen = undefined;
    this.record = 0;
    this.completo = false;
    this.firmaGuardada = null;
    /** ¿Ha tocado ya la meta? (solo cuenta para los objetivos con meta) */
    this.metaAlcanzada = false;
    /** Foto del objetivo en este instante (la pinta el HUD). */
    this.estadoObjetivo = estadoObjetivo(this.objetivo);
    /** Cuenta atrás al pasar de nivel: { nivelId, restante }. */
    this.transicion = null;

    /**
     * Vidas compartidas de la partida (nucleo/Vidas.js) o null. Sin ellas la
     * escena no limita nada: morir solo reinicia al checkpoint, como siempre.
     */
    this.vidas = vidas ?? null;
    /** ¿Se pasa de nivel sola al superarlo? (false → decide la interfaz) */
    this.autoAvanzar = autoAvanzar !== false;
    /** true al quedarse sin vidas: congela la simulación y avisa de la derrota. */
    this.derrota = false;
    /** Chispas de monedas y polvo de rebotes (render/particulas.js). */
    this.particulas = new Particulas();
    /** Líneas técnicas dentro del canvas (se activa con ?depurar=1). */
    this.depuracion = false;
  }

  entrar(juego = null) {
    this.mundo = new Mundo(this.nivel);
    const inicio = this.mundo.inicio;
    this.jugador = new Jugador({
      x: inicio.x - LADO_BOLA / 2,
      y: inicio.y - LADO_BOLA,
      ancho: LADO_BOLA,
      alto: LADO_BOLA
    });
    this.camara = new Camara({
      ancho: VISTA.ANCHO,
      alto: VISTA.ALTO,
      mundoAncho: this.mundo.ancho,
      mundoAlto: this.mundo.alto
    });
    this.camara.centrar(this.jugador.centro);

    this.marcador = new Marcador({ totalMonedas: this.mundo.totalColeccionables });
    // `juego.almacen` permite inyectar otro almacén en pruebas; sin él se usa
    // localStorage, y si el navegador lo bloquea el progreso queda vacío.
    this.almacen = juego?.almacen;
    this.progreso = leerProgreso(this.almacen);
    this.record = registroDe(this.progreso, this.nivelId).puntos;
    this.completo = false;
    this.firmaGuardada = null;

    this.tiempo = 0;
    this.destello = 0;
    this.mensaje = '';
    this.mensajeTiempo = 0;
    this.reinicios = 0;
    this.checkpoints = 0;
    // Estado del objetivo limpio: un nivel nuevo empieza sin meta y sin monedas.
    this.metaAlcanzada = false;
    this.estadoObjetivo = estadoObjetivo(this.objetivo, {
      monedas: 0,
      totalMonedas: this.mundo.totalColeccionables,
      metaAlcanzada: false
    });
    this.transicion = null;
    this.derrota = false;
    this.particulas.limpiar();
    return this;
  }

  /** Al salir de la escena se guarda el récord de la partida. */
  salir() {
    this.#guardarProgreso();
  }

  /** Texto breve en pantalla (checkpoint, reinicio…). */
  avisar(texto) {
    this.mensaje = texto;
    this.mensajeTiempo = AVISO_TIEMPO;
    return this;
  }

  /**
   * Foto del estado de la partida para el HUD del DOM (monedas, puntos, vidas,
   * progreso…). Es una función pura sobre el estado de la escena: no toca el
   * DOM, así se prueba con `node --test` y la interfaz solo tiene que escribir.
   *
   * `progreso` (0..1) es lo que llena la barra: monedas recogidas si el nivel
   * las exige y, si solo pide llegar a la meta, lo cerca que está el jugador
   * del portal. Al superar el nivel vale 1 (barra llena).
   */
  datosHud() {
    const marcador = this.marcador;
    const vidas = this.vidas;
    return {
      nivel: this.nivelId,
      nombre: this.nivel?.nombre ?? this.nivelId,
      numero: this.indice >= 0 ? this.indice + 1 : 1,
      total: this.totalNiveles,
      cabecera: this.#cabeceraNivel(),
      monedas: marcador?.monedas ?? 0,
      totalMonedas: marcador?.totalMonedas ?? 0,
      puntos: marcador?.puntos ?? 0,
      record: this.record,
      vidas: vidas ? vidas.restantes : null,
      vidasMaximo: vidas ? vidas.maximo : 0,
      progreso: this.#progresoNivel(),
      objetivo: textoObjetivo(this.estadoObjetivo),
      completo: this.completo,
      derrota: this.derrota,
      tiempo: Math.round(this.tiempo * 10) / 10,
      reinicios: this.reinicios
    };
  }

  actualizar(dt, juego) {
    const entrada = juego.entrada;
    const j = this.jugador;
    // Sin vidas la partida está perdida: la escena se congela (el bucle también
    // se pausa desde main.js) para que la pantalla de derrota no se mueva.
    if (!j || !this.mundo || this.derrota) return;

    // 1. El mundo se mueve (y publica cuánto se ha movido cada objeto).
    this.mundo.actualizar(dt);

    // 2. Quien va encima de una plataforma móvil viaja con ella.
    const arrastre = this.mundo.transportePara(j);
    if (arrastre.dx !== 0 || arrastre.dy !== 0) {
      j.x += arrastre.dx;
      j.y += arrastre.dy;
    }

    // 3. El jugador, con la foto de sólidos y superficies de este paso.
    //    Se guarda la vy de entrada: al aterrizar ya vale 0 y sin ella no se
    //    sabe si el golpe fue flojo (sin polvo) o fuerte (polvo).
    const vyAntes = j.vy;
    j.actualizar(dt, {
      control: {
        eje: entrada.ejeHorizontal(),
        salto: entrada.recienPresionada(ACCIONES.SALTO),
        saltoMantenido: entrada.estaPresionada(ACCIONES.SALTO),
        impulso: entrada.recienPresionada(ACCIONES.IMPULSO)
      },
      solidos: this.mundo.solidos,
      superficies: this.mundo.superficies,
      limites: this.mundo.limites
    });
    this.#efectosDelJugador(j, vyAntes);

    // 4. Zonas y recogida: monedas, checkpoints, peligros, caídas y avisos.
    const evento = this.mundo.revisar(j);

    if (evento.monedas.length > 0) {
      for (const moneda of evento.monedas) {
        this.marcador.contarMoneda(moneda.valor);
        // Chispa dorada donde estaba la moneda: efecto inmediato de la recogida.
        this.particulas.estallido({
          x: moneda.x + moneda.ancho / 2,
          y: moneda.y + moneda.alto / 2,
          colores: [PALETA.ORO, PALETA.ORO_CLARO],
          cuantas: 7
        });
      }
      // Un solo blip por paso aunque caigan dos monedas a la vez.
      juego.sonido?.moneda?.();
    }

    // Meta tocada: el mundo solo avisa; si eso supera el nivel lo decide el
    // objetivo del nivel (más abajo, en #revisarObjetivo).
    if (evento.meta && !this.metaAlcanzada) {
      this.metaAlcanzada = true;
      juego.sonido?.moneda?.();
    }

    if (evento.checkpoint) {
      this.checkpoints += 1;
      this.avisar('Checkpoint');
    }
    if (evento.reiniciado) {
      this.reinicios += 1;
      this.destello = DESTELLO;
      this.avisar(evento.peligro?.motivo === 'caida' ? 'Caída' : 'Peligro');
      this.camara.centrar(j.centro);
      this.#perderVida(juego);
    }

    // 5. ¿Objetivo cumplido? (todas las monedas, la meta o la meta con monedas)
    this.#revisarObjetivo(juego);

    this.destello = Math.max(0, this.destello - dt);
    this.mensajeTiempo = Math.max(0, this.mensajeTiempo - dt);
    this.particulas.actualizar(dt);
    this.camara.seguir(j.centro, dt);
    this.tiempo += dt;

    // Cuenta atrás del cambio de nivel (deja ver el mensaje antes de saltar).
    if (this.transicion) {
      this.transicion.restante -= dt;
      if (this.transicion.restante <= 0) this.#avanzarDeNivel(juego);
    }
  }

  dibujar(ctx) {
    const camara = this.camara;
    const desplazamiento = camara ? camara.desplazamiento : { x: 0, y: 0 };

    this.#dibujarFondo(ctx, desplazamiento);

    if (camara && this.mundo) {
      // Todo el nivel se dibuja en coordenadas de mundo: la cámara traslada.
      camara.aplicar(ctx);
      this.mundo.dibujar(ctx);
      if (this.etiquetas) this.#dibujarEtiquetas(ctx);
      if (this.jugador) dibujarPelota(ctx, this.jugador);
      // Chispas y polvo en coordenadas de MUNDO: la cámara ya está aplicada.
      this.particulas.dibujar(ctx);
      camara.restaurar(ctx);
    }

    this.#dibujarHud(ctx);
  }

  /** Cielo, sol y colinas con paralaje (el fondo se mueve menos que el nivel). */
  #dibujarFondo(ctx, desplazamiento) {
    ctx.fillStyle = PALETA.CIELO;
    ctx.fillRect(0, 0, VISTA.ANCHO, VISTA.ALTO);

    ctx.fillStyle = PALETA.SOL_A;
    ctx.beginPath();
    ctx.arc(VISTA.ANCHO - 70 - desplazamiento.x * 0.05, 46, 22, 0, Math.PI * 2);
    ctx.fill();

    const sueloY = VISTA.ALTO - 30;
    const periodo = 320;
    const base = -(((desplazamiento.x * 0.35) % periodo) + periodo) % periodo;

    ctx.fillStyle = PALETA.COLINA_LEJANA;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(base + i * periodo, sueloY + 10, 150, 70, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    const periodoCerca = 260;
    const baseCerca = -(((desplazamiento.x * 0.6) % periodoCerca) + periodoCerca) % periodoCerca;
    ctx.fillStyle = PALETA.COLINA_CERCANA;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(baseCerca + i * periodoCerca, sueloY + 20, 130, 46, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Nombres sobre cada objeto: es un banco de pruebas, no la fase final. */
  #dibujarEtiquetas(ctx) {
    ctx.fillStyle = PALETA.TEXTO_AZUL;
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (const objeto of this.mundo.objetos) {
      if (!objeto.etiqueta || objeto.visible === false) continue;
      // Solo se etiqueta lo que está en la ventana: la cámara ya sabe qué se ve.
      if (this.camara && !this.camara.visible(objeto.caja, 24)) continue;
      ctx.fillText(objeto.etiqueta, objeto.centroX, objeto.y - 2);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  /**
   * HUD DENTRO del canvas: solo la MISIÓN del nivel (lo que hay que hacer aquí)
   * y los avisos momentáneos. Monedas, puntos, vidas y progreso se pintan en el
   * HUD del DOM (`src/interfaz/Interfaz.js`): un único contador visible y texto
   * grande, que además no tapa el nivel.
   */
  #dibujarHud(ctx) {
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = PALETA.TEXTO_AZUL;
    ctx.fillText(this.#textoObjetivoHud(), 6, 6);

    // Líneas técnicas: solo con ?depurar=1, nunca en la partida normal.
    if (this.depuracion) {
      ctx.fillText(this.#cabeceraNivel(), 6, 20);
      ctx.fillText(
        `t ${this.tiempo.toFixed(1)}s  ren ${this.reinicios}  cp ${this.checkpoints}  rec ${this.record}`,
        6,
        34
      );
      if (this.jugador) {
        const estado = this.jugador.enSuelo ? 'suelo' : 'aire';
        ctx.fillText(`vx ${this.jugador.vx.toFixed(0)}  ${estado}  p ${this.particulas.vivas}`, 6, 48);
      }
    }

    if (this.mensajeTiempo > 0 && this.mensaje) {
      ctx.fillStyle = PALETA.AVISO;
      ctx.textAlign = 'center';
      ctx.fillText(this.mensaje, VISTA.ANCHO / 2, this.depuracion ? 68 : 22);
      ctx.textAlign = 'left';
    }

    // Marco rojo al reaparecer: aviso inmediato sin usar transparencias.
    if (this.destello > 0) {
      ctx.fillStyle = PALETA.ROJO;
      ctx.fillRect(0, 0, VISTA.ANCHO, 3);
      ctx.fillRect(0, VISTA.ALTO - 3, VISTA.ANCHO, 3);
    }
  }

  /** Cabecera del HUD: "nivel 2/5  Saltos y agua" (o el nombre si no es del catálogo). */
  #cabeceraNivel() {
    const nombre = this.nivel.nombre ?? this.nivelId;
    if (this.indice < 0) return nombre;
    return `nivel ${this.indice + 1}/${this.totalNiveles}  ${nombre}`;
  }

  /** Línea del objetivo: "dificultad 3/5  meta + 2/6 monedas". */
  #textoObjetivoHud() {
    const dificultad = Number.isFinite(this.nivel.dificultad)
      ? `dificultad ${this.nivel.dificultad}/${NIVEL.DIFICULTAD_MAXIMA}`
      : 'dificultad -';
    return `${dificultad}  ${textoObjetivo(this.estadoObjetivo)}`;
  }

  /**
   * Fracción 0..1 que llena la barra de progreso. Tres casos, en este orden:
   *  - nivel superado → 1 (la barra se llena aunque no queden monedas),
   *  - objetivo con monedas → monedas recogidas / exigidas,
   *  - objetivo solo de meta → lo que se ha avanzado hacia el portal.
   * Nunca devuelve NaN: una división rara daría una barra rota.
   */
  #progresoNivel() {
    if (this.completo) return 1;

    const estado = this.estadoObjetivo;
    if (estado.requeridas > 0) {
      return limitar(estado.monedas / estado.requeridas, 0, 1);
    }

    const meta = this.mundo?.delTipo?.('meta')?.[0] ?? null;
    const inicio = this.mundo?.inicio ?? null;
    if (!meta || !inicio || !this.jugador) return 0;

    const recorrido = Math.max(1, meta.x - inicio.x);
    return limitar((this.jugador.x - inicio.x) / recorrido, 0, 1);
  }

  /**
   * Gasta una vida de la partida (si hay vidas). Cuando no queda ninguna, la
   * escena se marca en derrota y se avisa por el bus: `main.js` congela el
   * bucle y enseña la pantalla de derrota. Sin vidas inyectadas no pasa nada.
   */
  #perderVida(juego = null) {
    if (!this.vidas) return this.reinicios;
    const restantes = this.vidas.perder();
    juego?.bus?.emitir?.('vida:perdida', { nivel: this.nivelId, vidas: restantes });

    if (this.vidas.agotadas) {
      this.derrota = true;
      this.avisar('Sin vidas');
      juego?.bus?.emitir?.('partida:derrota', { nivel: this.nivelId, datos: this.datosHud() });
    }
    return restantes;
  }

  /**
   * Efectos del jugador: polvo al aterrizar fuerte y chispas al botar en una
   * superficie elástica. El motor ya deja las señales en el jugador (`reboto`,
   * `aterrizo`); aquí solo se decide si merecen partículas.
   */
  #efectosDelJugador(j, vyAntes = 0) {
    const x = j.x + j.ancho / 2;
    const pies = j.y + j.alto;

    if (j.reboto) {
      // Trampolín: chispas rosas hacia arriba, como el material del objeto.
      this.particulas.estallido({
        x,
        y: pies - 2,
        colores: [PALETA.ELASTICO_CLARO, PALETA.ELASTICO],
        cuantas: 8,
        velocidad: 120,
        duracion: 0.4,
        gravedad: 240
      });
      return;
    }

    // Aterrizaje: solo si el golpe fue fuerte (caer de un salto pequeño no
    // levanta polvo, si no el suelo parecería una nube permanente).
    if (j.aterrizo && vyAntes > 220) {
      this.particulas.polvo({ x, y: pies, cuantas: 4, velocidad: 70, duracion: 0.28 });
    }
  }

  /**
   * Recalcula el objetivo y, la primera vez que se cumple, guarda el récord y
   * prepara el paso al nivel siguiente. Devuelve si el nivel está superado.
   */
  #revisarObjetivo(juego = null) {
    this.estadoObjetivo = estadoObjetivo(this.objetivo, {
      monedas: this.marcador.monedas,
      totalMonedas: this.marcador.totalMonedas,
      metaAlcanzada: this.metaAlcanzada
    });
    if (!this.estadoObjetivo.cumplido || this.completo) return this.completo;

    this.completo = true;
    const siguienteId = this.siguiente ? idDeNivel(this.siguiente) : null;
    this.avisar(siguienteId ? '¡Nivel superado!' : '¡Nivel completado!');
    this.#guardarProgreso(); // queda guardado aunque se cierre la pestaña
    juego?.bus?.emitir?.('nivel:completado', { nivel: this.nivelId, siguiente: siguienteId });

    // Un respiro antes del cambio: el aviso tiene que poder leerse. Con la
    // interfaz delante (`autoAvanzar: false`) NO se programa: la pantalla de
    // victoria es quien decide si se sigue, se repite o se va a los niveles.
    if (siguienteId && this.autoAvanzar) {
      this.transicion = { nivelId: siguienteId, restante: NIVEL.TRANSICION };
    }
    return true;
  }

  /**
   * Carga el nivel siguiente en ESTA escena (`juego.cambiarEscena`) o, si el
   * juego no tiene gestor de escenas (pruebas), lo deja dicho en un aviso. El
   * récord ya está guardado, así que aquí no se puede perder nada.
   */
  #avanzarDeNivel(juego = null) {
    const nivelId = this.transicion?.nivelId ?? null;
    this.transicion = null;
    if (!nivelId) return null;

    if (typeof juego?.cambiarEscena !== 'function') {
      this.avisar(`Siguiente: ${nivelId}`);
      return null;
    }
    return juego.cambiarEscena(new EscenaMundo({ nivelId, niveles: this.niveles }));
  }

  /**
   * Guarda el récord del nivel (solo mejora, nunca empeora).
   * Se salta escrituras idénticas: así ni se toca el almacén sin motivo ni se
   * cuenta dos veces la misma partida al completar el nivel y salir de él.
   */
  #guardarProgreso() {
    if (!this.marcador) return false;
    const firma = `${this.marcador.puntos}:${this.marcador.monedas}`;
    if (firma === this.firmaGuardada) return false;
    this.firmaGuardada = firma;

    this.progreso = registrarPartida(this.progreso, {
      nivel: this.nivelId,
      puntos: this.marcador.puntos,
      monedas: this.marcador.monedas,
      totalMonedas: this.marcador.totalMonedas,
      // `completado` es la verdad de la progresión: lo pone el objetivo del
      // nivel, no el marcador (un nivel se puede superar sin coger monedas).
      completado: this.completo
    });
    this.record = Math.max(this.record, this.marcador.puntos);
    return guardarProgreso(this.progreso, this.almacen);
  }
}

/** Encierra un número en [minimo, maximo] (los datos que llegan pueden ser raros). */
function limitar(valor, minimo, maximo) {
  if (!Number.isFinite(valor)) return minimo;
  return Math.min(maximo, Math.max(minimo, valor));
}
