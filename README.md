# Red Ball Adventure

Plataformas 2D en pixel art inspirado en los clásicos de Nokia: una bola roja,
plataformas, monedas, enemigos y agua.

## Jugar

```bash
npm start
```

Abre <http://localhost:3000>.

- **Flechas / A D**: moverse (aceleración y fricción reales)
- **Espacio / W / flecha arriba**: saltar (mantén para saltar más alto)
- **X / Shift**: impulso
- **P / Escape**: pausa (menú con continuar, reiniciar, niveles y menú)
- **R**: reiniciar el nivel
- **Intro / Espacio** en los menús: confirmar

El juego abre el **menú principal**: JUGAR empieza en el primer nivel que te
falte por superar, y NIVELES abre la selección (los niveles se desbloquean al
superar el anterior). Con `?nivel=nivel-3` se salta el menú y se prueba ese
nivel suelto; con `?depurar=1` se añaden las líneas técnicas dentro del lienzo.

En móvil aparecen botones táctiles en la parte inferior.

## Niveles

Cinco niveles progresivos, cada uno con su **objetivo** y su dificultad:

| # | Id | Nombre | Ancho | Objetivo |
|---|---|---|---|---|
| 1 | `nivel-1` | Primeros pasos | 1280 px | llegar a la meta |
| 2 | `nivel-2` | Saltos y agua | 1600 px | meta + 3 monedas |
| 3 | `nivel-3` | Cuidado | 1800 px | meta + 6 monedas |
| 4 | `nivel-4` | Carrera | 2000 px | meta + 8 monedas |
| 5 | `nivel-5` | La cumbre | 2200 px | meta + 12 monedas |

### Objetivos

Un nivel declara qué hay que hacer para superarlo, y eso es **dato, no código**:

```js
objetivo: { tipo: 'meta' }                 // solo llegar al portal
objetivo: { tipo: 'meta', monedas: 6 }     // llegar con al menos 6 monedas
objetivo: { tipo: 'monedas' }              // recoger todas (nivel de demostración)
```

- El HUD muestra el objetivo pendiente (`meta + 2/6 monedas`) y, al cumplirlo,
  `¡Nivel completado!`.
- La meta avisa de que la has tocado, pero **no** supera el nivel por sí sola: la
  regla vive en [`src/mundo/objetivo.js`](src/mundo/objetivo.js), así que se puede
  añadir un objetivo nuevo sin tocar la escena ni el mundo.

### Progresión

- El primer nivel está siempre abierto; **superar uno abre el siguiente**. Si
  repites un nivel ya superado, no se pierde nada.
- Al superar un nivel, una cuenta atrás abre el siguiente automáticamente; en el
  último aparece `¡Nivel completado!` y ahí acaba el recorrido.
- La lista de desbloqueados **no se guarda**: se deduce del récord
  (`localStorage`, `redball.progreso.v1`) en
  [`src/nucleo/Progresion.js`](src/nucleo/Progresion.js), así que nunca puede
  contradecir a las partidas guardadas.
- Al arrancar se abre el primer nivel desbloqueado **sin completar**; si ya está
  todo hecho, el último, para repetirlo.

### Probar un nivel suelto

```text
http://localhost:3000/?nivel=nivel-3
```

`?nivel=` se salta la progresión (útil para depurar uno concreto). Sin parámetro,
manda el récord guardado.

## Mecánicas del escenario

Los niveles se construyen con estos objetos:

| Objeto | Qué hace |
|---|---|
| Plataforma | Bloque sólido con material propio (césped, piedra, hielo…) |
| Plataforma elevada | Se atraviesa desde abajo y solo sujeta al caer |
| Rampa | Cuesta que se sube y se baja andando, sin escalones |
| Superficie elástica | Devuelve **más** energía de la que recibe (trampolín) |
| Plataforma móvil | Vaivén horizontal o vertical y **transporta** a quien va encima |
| Plataforma efímera | Avisa, parpadea, desaparece y vuelve |
| Obstáculo | Bulto sólido que solo estorba |
| Obstáculo móvil | Se mueve y además reinicia al jugador |
| Zona de peligro | Pinchos o agua: reinician en el último checkpoint |
| Checkpoint | Bandera que fija el punto de reaparición |
| Moneda | Coleccionable que gira, suena al recogerse y suma puntos |
| Meta | Portal de llegada: avisa de que has llegado (ver **Objetivos**) |

Cada objeto declara sus **capacidades** (`solido`, `superficie`, `peligro`,
`checkpoint`, `coleccionable`, `meta`), así que añadir uno nuevo son dos archivos
y ninguna línea en el motor: [`docs/MUNDO.md`](docs/MUNDO.md).

### Cámara y desplazamiento

El nivel puede ser mucho más grande que la ventana (480×270) y la cámara lo
recorre con el jugador:

- Sigue en **horizontal y vertical** con suavizado exponencial: llega al mismo
  sitio en el mismo tiempo a 30, 60 o 144 Hz.
- El jugador **no queda en el centro**: se le deja al 38 % del ancho y al 30 %
  del alto, así se ve más de lo que viene que de lo ya recorrido.
- Nunca enseña el vacío: la ventana se para en los bordes del nivel. Un nivel que
  cabe entero en pantalla simplemente no se desplaza.
- Plataformas, monedas, obstáculos y jugador se pintan **con el mismo
  desplazamiento** (una sola traslación del lienzo); el HUD y el fondo, sin
  cámara y con su propio paralaje.

Los detalles están en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) §Cámara.

### Monedas, puntuación y récord

- El **HUD** (HTML, encima del lienzo) lleva el contador de monedas con icono, los
  puntos, tu **récord** guardado de ese nivel, los corazones de vidas y una barra
  de progreso. Dentro del lienzo solo queda la **misión** del nivel y los avisos.
- Cada moneda vale **10 puntos**, suena un blip corto (el primer clic o la
  primera tecla desbloquea el audio: los navegadores no dejan sonar antes) y
  suelta una **chispa dorada**; el contador del HUD da un salto.
- La recogida se comprueba contra el **recorrido** de cada paso, así que ninguna
  moneda se escapa cuando vas rápido.
- El récord se guarda nivel por nivel en `localStorage`
  (`redball.progreso.v1`). Si el navegador bloquea el almacén, el juego sigue
  funcionando sin récord (y sin progresión guardada).

### Interfaz y pantallas

Todo lo que no es el nivel es **HTML + CSS** (`index.html` y `Css/ui.css`); el
canvas solo dibuja el juego.

| Pantalla | Qué hace |
|---|---|
| **Título** | JUGAR (arranca el nivel que toca) y NIVELES, con la leyenda de teclas |
| **Selección** | Una tarjeta por nivel: número, nombre, dificultad, monedas del récord, sello `OK` si está superado y `BLOQUEADO` si no |
| **Pausa** | CONTINUAR · REINICIAR NIVEL · NIVELES · MENÚ PRINCIPAL, con el estado de la partida congelada |
| **Victoria** | Resumen de la partida, SIGUIENTE NIVEL (se oculta en el último), REPETIR y NIVELES |
| **Derrota** | «GAME OVER» al quedarte sin vidas: REINTENTAR (con las vidas llenas) o NIVELES |

- Estética 16 bits: fuente *Press Start 2P*, bordes gruesos, sombras duras (sin
  desenfoques), scanlines y botones que se hunden 3 px al pulsarlos.
- Iconos de moneda y corazón son SVG incrustados con `shape-rendering:
  crispEdges`: se ven pixelados a cualquier tamaño sin descargar imágenes.
- `prefers-reduced-motion` desactiva el parpadeo de los botones y el salto del
  contador.
- Tres **vidas** por partida (corazones del HUD): cada peligro o caída gasta una
  y al llegar a cero aparece la pantalla de derrota. Al reintentar se recuperan.

### Efectos visuales

- **Recoger una moneda**: chispa dorada de cuadraditos donde estaba, el contador
  del HUD da un salto y suena el blip.
- **Botar en una superficie elástica**: chispas rosas en el punto de contacto.
- **Aterrizaje fuerte**: polvo claro a los pies (si la caída fue floja no hay
  polvo, o el suelo parecería una nube permanente).
- Nada de transparencias: cada partícula se hace más pequeña al morir y se pinta
  redondeada a la rejilla del lienzo, como el resto del pixel art.

## Desarrollo

```bash
npm test     # pruebas con el runner integrado de Node (sin dependencias)
```

Las pruebas incluyen un **bot** que juega los cinco niveles de verdad (misma
escena, misma física, mismos datos) yendo siempre hacia la derecha: si un salto
deja de ser posible, un peligro cae en la salida de un salto o el objetivo pide
más monedas de las que hay en la ruta, `npm test` falla diciendo en qué nivel y
con cuántas monedas se quedó.

### Añadir un nivel (4 pasos, 0 cambios en el motor)

1. Crear `src/mundo/niveles/nivel-6.js` con `export const NIVEL_6 = {…}`
2. Importarlo en [`src/mundo/niveles/index.js`](src/mundo/niveles/index.js)
3. Añadirlo a `CONTENIDO` con su `orden`
4. `npm test` → [`pruebas/catalogo-niveles.test.js`](pruebas/catalogo-niveles.test.js)
   lo valida solo (ids únicos, orden correcto, meta alcanzable, monedas
   suficientes…) y el bot comprueba que se puede terminar

Un nivel es **datos**:

```js
export const NIVEL_6 = {
  id: 'nivel-6',          // estable: es la clave del récord guardado
  orden: 6,               // orden de juego = orden de desbloqueo
  nombre: 'Nombre',
  dificultad: 5,          // 1..5, solo informativo (HUD)
  ancho: 1600,
  alto: VISTA.ALTO,
  inicio: { x: 60, y: SUELO },
  objetivo: { tipo: 'meta', monedas: 4 },
  objetos: [suelo(0, 1600), moneda(300, SUELO - 14), meta(1400)]
};
```

Los generadores (`suelo`, `moneda`, `meta`, `filaMonedas`, `pinchos`…) están en
[`src/mundo/niveles/ayudas.js`](src/mundo/niveles/ayudas.js), y
[`src/mundo/validar.js`](src/mundo/validar.js) explica cada regla que se
comprueba. Para pasar el catálogo entero por el validador:

```js
import { NIVELES } from './src/mundo/niveles/index.js';
import { validarCatalogo } from './src/mundo/validar.js';

validarCatalogo(NIVELES); // { errores: [], avisos: [] } cuando todo está bien
```

Sin herramienta de build: el navegador carga los ES Modules directamente. Hace
falta servir el juego con `npm start` (no vale abrir `index.html` con doble clic,
los módulos necesitan HTTP).

- Arquitectura, convenciones y hoja de ruta: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
- Interfaz, pantallas, estética y efectos: [`docs/INTERFAZ.md`](docs/INTERFAZ.md)
- Matemática de la física y valores medidos: [`docs/FISICA.md`](docs/FISICA.md)
- Objetos de nivel, mecánicas y datos: [`docs/MUNDO.md`](docs/MUNDO.md)
- Concepto visual: [`docs/VISUAL_CONCEPT.md`](docs/VISUAL_CONCEPT.md)
- Prototipo antiguo jugable: `/Index/Index.html`
- Experimento congelado: [`legacy/`](legacy/README.md)

## Estructura

```text
index.html   entrada: HUD y pantallas en HTML (ES Modules)
src/         código del juego (config, nucleo, escenas, interfaz, ...)
pruebas/     pruebas automáticas
Css/         layout.css (estructura) y ui.css (HUD, menús, controles táctiles)
legacy/      prototipo congelado
```
