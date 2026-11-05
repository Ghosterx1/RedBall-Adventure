# Interfaz y experiencia del jugador

Todo lo que no es el nivel se escribe con **HTML + CSS**. El `<canvas>` solo
dibuja el mundo (plataformas, monedas, jugador, partículas) y la **misión** del
nivel; los menús, el contador de monedas, las vidas y la barra de progreso son
elementos del documento.

```text
index.html      estructura: HUD, marco del lienzo y cinco pantallas
Css/layout.css  página y tamaño del lienzo (sin colores de juego)
Css/ui.css      HUD, pantallas, botones, tarjetas de nivel y controles táctiles
src/interfaz/Interfaz.js   escribe el HUD y enseña/oculta pantallas
src/interfaz/modelo.js     calcula lo que se pinta (puro, sin DOM)
src/nucleo/Partida.js      qué pantalla toca y qué saltos son legales
```

## Pantallas

Cinco secciones dentro de `#pantallas`, superpuestas al lienzo. Solo una lleva la
clase `pantalla--activa`; el resto están en `display: none`.

| Sección | Modo de `Partida` | Fondo |
|---|---|---|
| `#pantalla-titulo` | `titulo` | opaco (cielo y suelo pixelados) |
| `#pantalla-niveles` | `niveles` | opaco |
| `#pantalla-pausa` | `pausa` | translúcido (se ve el nivel congelado) |
| `#pantalla-victoria` | `victoria` | translúcido |
| `#pantalla-derrota` | `derrota` | translúcido |

`PANTALLAS_INTERFAZ` (en `Interfaz.js`) es el único mapa modo → sección, y
`pruebas/integracion.test.js` comprueba que **todos** esos ids existen en
`index.html`: si alguien renombra una sección y se olvida del HTML, `npm test`
falla.

## HUD

| Elemento | Contenido |
|---|---|
| `#hud-monedas` | `3/12` con el icono de moneda (SVG en `data:`) |
| `#hud-puntos` | puntos de la partida |
| `#hud-record` | `RÉCORD 210`; se oculta solo si no hay récord (`hidden`) |
| `#hud-vidas` | un `<span class="vidas__corazon">` por vida; las gastadas llevan `--vacia` |
| `#hud-nivel` | `NIVEL 2/5 · SALTOS Y AGUA` |
| `#hud-progreso` | barra segmentada; el relleno crece con `style.width` |

Todo sale de `EscenaMundo.datosHud()`. La interfaz compara una firma de texto y
**no escribe en el DOM si nada ha cambiado**, así que sincronizar cada cuadro no
cuesta repintados.

## Cómo añadir una pantalla o un botón

1. Añadir la sección en `index.html` con un id nuevo (sin `pantalla--activa`).
2. Registrar el id en `PANTALLAS_INTERFAZ` (si es una pantalla) o en
   `BOTONES_INTERFAZ` (si es un botón, con el nombre de la intención).
3. Si hay modo nuevo, añadirlo a `PANTALLAS` y a `TRANSICIONES` de
   `src/nucleo/Partida.js` (la tabla es la que autoriza el salto).
4. Atender la intención en `main.js` (`alPedir.<accion>`).
5. `npm test`: los ids del HTML, la tabla de transiciones y los botones están
   cubiertos por pruebas.


## Estética

- **Fuente**: `Press Start 2P` (la misma del HUD del canvas), cargada por Google
  Fonts en `index.html`. Todo el texto de interfaz está en mayúsculas.
- **Bordes y sombras duras**: `border: 3px` y `box-shadow: 0 4px 0 var(--ui-sombra)`.
  Nada de desenfoques ni degradados suaves: el relieve es de 3-4 px, como en un
  botón de recreativa.
- **Interacción**: los botones se hunden 3 px con `translateY` al pulsarlos y se
  marcan con `outline` amarillo al navegar con teclado (`:focus-visible`).
- **Scanlines**: `repeating-linear-gradient` de 2 px sobre 4 en cada pantalla
  (efecto CRT), sin imágenes.
- **Iconos**: moneda y corazón son SVG incrustados en `data:` con
  `shape-rendering="crispEdges"` e `image-rendering: pixelated`. Se ven nítidos a
  cualquier tamaño y no hay peticiones de red.
- **Animaciones**: a `steps()` (salto del contador al coger moneda, latido del
  botón principal). `prefers-reduced-motion: reduce` las apaga.
- **Accesibilidad**: `role="progressbar"` con `aria-valuenow`, `role="status"` con
  `aria-live="polite"` para el aviso, `aria-label` en las tarjetas (incluido
  "bloqueado") y foco visible en todo lo interactivo.

## Vidas, victoria y derrota

- `src/nucleo/Vidas.js` empieza con `JUEGO.VIDAS_INICIALES` (3). El HUD pinta los
  corazones que quedan.
- Cada peligro o caída reinicia al checkpoint **y** gasta una vida. Al llegar a 0
  la escena se marca en derrota, emite `partida:derrota` y se congela; `main.js`
  pausa el bucle y enseña `#pantalla-derrota`.
- Reintentar reinicia las vidas (`vidas.reiniciar()`); reiniciar el nivel desde la
  pausa **no** las devuelve: las vidas son de la partida.
- Al superar el nivel la escena emite `nivel:completado` con el id del siguiente.
  `main.js` pausa el bucle y enseña `#pantalla-victoria`; el botón SIGUIENTE
  arranca ese nivel y se oculta cuando no hay más.

## Efectos

| Cuándo | Qué se ve | Dónde se decide |
|---|---|---|
| Recoger una moneda | chispa dorada de cuadraditos + salto del contador + blip | `EscenaMundo` / `Particulas` / `Interfaz.destelloMoneda()` |
| Botar en un trampolín | chispas rosas del color del material | `EscenaMundo.#efectosDelJugador()` |
| Aterrizar fuerte | polvo claro a los pies (solo si la caída supera 220 px/s) | `EscenaMundo.#efectosDelJugador()` |

Las partículas viven en coordenadas de mundo, así que la cámara las desplaza
igual que a las plataformas, y se dibujan como cuadrados que se encogen (sin
`globalAlpha`) para no romper el pixel art.

## Cómo probarlo sin navegador

```bash
npm test
```

- `pruebas/interfaz.test.js`: HUD, corazones, tarjetas y botones con un documento
  falso (`pruebas/ayudas/dom-falso.js`).
- `pruebas/arranque.test.js`: ejecuta `main.js` de verdad con ese documento falso
  (menú → JUGAR → pausa con P → reiniciar con R).
- `pruebas/escena-interfaz.test.js`: vidas, derrota, `datosHud()`, `autoAvanzar` y
  partículas, sin DOM.
- En el navegador, `?depurar=1` añade las líneas técnicas dentro del lienzo y
  `window.partidaUI` permite forzar pantallas desde la consola.
