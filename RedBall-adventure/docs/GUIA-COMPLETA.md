# Guía completa de RedBall-Adventure

> Versión extendida del [README](../README.md): controles, niveles, mecánicas,
> interfaz, API y cómo añadir contenido. Para empezar basta el README; aquí está
> el detalle de cómo funciona cada pieza.

Plataformas 2D en pixel art inspirado en los clásicos de Nokia: una bola roja,
plataformas, monedas, enemigos y agua. Monorepo con el juego en el navegador
(`frontend/`) y una API de récords en Express (`backend/`).

## Jugar

```bash
npm install   # solo installa express (workspaces)
npm start
```

Abre <http://localhost:3000>. El mismo proceso sirve el juego y la API: el
navegador habla con `/api/records` sin CORS, sin tokens y sin configuración.

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

### En el celular

En **móvil y tablet** aparecen botones táctiles y la página se recoloca sola
según cómo sostengas el teléfono:

- **Vertical**: el lienzo se queda arriba y el mando va abajo, al alcance de los
  pulgares (◀ ▶ a la izquierda y SALTAR/IMPULSO a la derecha).
- **Apaisado**: los botones pasan a dos columnas pegadas a los bordes de la
  pantalla y el lienzo usa todo el alto disponible, así que se ve casi el doble
  de grande.
- El tamaño del lienzo sale de una sola variable CSS (`--ancho-juego` en
  `frontend/Css/layout.css`) que descuenta el HUD, los botones, los márgenes y
  las zonas seguras del notch. Usa `100dvh`, así que no se desborda cuando el
  navegador esconde su barra, y los menús se compactan (y se pueden desplazar)
  si no caben.
- Con un menú abierto los botones se esconden: solo están cuando se juega.

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
  regla vive en [`frontend/src/mundo/objetivo.js`](../frontend/src/mundo/objetivo.js),
  así que se puede añadir un objetivo nuevo sin tocar la escena ni el mundo.

### Progresión

- El primer nivel está siempre abierto; **superar uno abre el siguiente**. Si
  repites un nivel ya superado, no se pierde nada.
- Al superar un nivel, una cuenta atrás abre el siguiente automáticamente; en el
  último aparece `¡Nivel completado!` y ahí acaba el recorrido.
- La lista de desbloqueados **no se guarda**: se deduce del récord
  (`localStorage`, `redball.progreso.v1`) en
  [`frontend/src/nucleo/Progresion.js`](../frontend/src/nucleo/Progresion.js), así
  que nunca puede contradecir a las partidas guardadas.
- El mismo récord se **sincroniza con la API** (`PUT /api/perfiles/:id/progreso`)
  cuando hay conexión. Si no la hay, el juego funciona igual y lo manda luego: la
  fusión es de máximos, así que nada se pierde ni se duplica.
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
y ninguna línea en el motor: [`docs/MUNDO.md`](../docs/MUNDO.md).

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

Los detalles están en [`docs/ARQUITECTURA.md`](../docs/ARQUITECTURA.md) §Cámara.

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

Todo lo que no es el nivel es **HTML + CSS** (`frontend/index.html` y
`frontend/Css/ui.css`); el canvas solo dibuja el juego.

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

## API de récords

El backend (`backend/`) es Express 5 con **una sola dependencia** y sin base de
datos: un JSON pequeño, legible y copiable (`backend/datos/redball.json`).

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/api/salud` | Estado del servicio (`HEALTHCHECK` de Docker) |
| `GET` | `/api/niveles` | Catálogo de niveles (sin la geometría) |
| `GET` | `/api/records` | Ranking global o `?nivel=nivel-3` |
| `POST` | `/api/records` | Anotar una partida terminada |
| `GET` | `/api/perfiles/:id` | Progreso guardado de un jugador |
| `PUT` | `/api/perfiles/:id/progreso` | Sincronizar el progreso del navegador |

- El **jugador** se identifica con un id anónimo (`jug-ab12`) que el navegador
  genera una vez y guarda; no hay registro, ni contraseña, ni correo.
- El **récord nunca empeora**: la fusión la hace la misma función que usa el
  navegador (`Progreso.registrarPartida()`), así que el servidor y el
  `localStorage` no pueden discrepar. Si borras el progreso local y sincronizas,
  recuperas exactamente lo que tenías.
- Todo se puede probar a mano: <http://localhost:3000/api/salud>.

```bash
# anotar una partida
curl -X POST http://localhost:3000/api/records -H "Content-Type: application/json" \
  -d '{"jugador":"jug-ab12","nombre":"ANA","nivel":"nivel-1","puntos":120,"monedas":2,"totalMonedas":2,"completado":true}'

# ver el ranking por nivel
curl "http://localhost:3000/api/records?nivel=nivel-1&limite=5"
```

La configuración sale del entorno, con valores por defecto que funcionan sin
`.env` (`PORT`, `HOST`, `NODE_ENV`, `CORS_ORIGENES`, `FRONTEND_DIR`, `DATOS_DIR`,
`DATOS_ARCHIVO`, `LIMITE_CUERPO`, `LIMITE_PETICIONES`, `LIMITE_RANKING`). La copia
comentada es [`.env.example`](../.env.example) y el contrato completo, con códigos de
error y detalles de almacenamiento, está en [`docs/BACKEND.md`](../docs/BACKEND.md).

Docker: un solo contenedor, sin build del frontend.

```bash
docker compose up --build     # http://localhost:3000
```

## Desarrollo

```bash
npm test              # todo: frontend (323) + backend (97) = 420 pruebas
npm run test:frontend # solo el juego
npm run test:backend  # solo la API
```

Runner integrado de Node (`node --test`), sin framework ni dependencias de
desarrollo. Las pruebas del backend levantan la API real en un puerto libre y le
hablan por HTTP con un almacén en memoria; las del frontend incluyen un **bot**
que juega los cinco niveles de verdad (misma escena, misma física, mismos datos)
yendo siempre hacia la derecha: si un salto deja de ser posible, un peligro cae
en la salida de un salto o el objetivo pide más monedas de las que hay en la
ruta, `npm test` falla diciendo en qué nivel y con cuántas monedas se quedó.

### Añadir un nivel (4 pasos, 0 cambios en el motor)

1. Crear `frontend/src/mundo/niveles/nivel-6.js` con `export const NIVEL_6 = {…}`
2. Importarlo en [`frontend/src/mundo/niveles/index.js`](../frontend/src/mundo/niveles/index.js)
3. Añadirlo a `CONTENIDO` con su `orden`
4. `npm test` → [`frontend/pruebas/catalogo-niveles.test.js`](../frontend/pruebas/catalogo-niveles.test.js)
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
[`frontend/src/mundo/niveles/ayudas.js`](../frontend/src/mundo/niveles/ayudas.js), y
[`frontend/src/mundo/validar.js`](../frontend/src/mundo/validar.js) explica cada
regla que se comprueba. Para pasar el catálogo entero por el validador:

```js
import { NIVELES } from './frontend/src/mundo/niveles/index.js';
import { validarCatalogo } from './frontend/src/mundo/validar.js';

validarCatalogo(NIVELES); // { errores: [], avisos: [] } cuando todo está bien
```

Sin herramienta de build: el navegador carga los ES Modules directamente. Hace
falta servir el juego con `npm start` (no vale abrir `index.html` con doble clic,
los módulos necesitan HTTP).

- Arquitectura, convenciones y hoja de ruta: [`docs/ARQUITECTURA.md`](../docs/ARQUITECTURA.md)
- API, almacenamiento y despliegue: [`docs/BACKEND.md`](../docs/BACKEND.md)
- Interfaz, pantallas, estética y efectos: [`docs/INTERFAZ.md`](../docs/INTERFAZ.md)
- Matemática de la física y valores medidos: [`docs/FISICA.md`](../docs/FISICA.md)
- Objetos de nivel, mecánicas y datos: [`docs/MUNDO.md`](../docs/MUNDO.md)
- Concepto visual: [`docs/VISUAL_CONCEPT.md`](../docs/VISUAL_CONCEPT.md)
- Prototipo antiguo jugable: <http://localhost:3000/Index/Index.html>
- Experimento congelado: [`frontend/legacy/`](../frontend/legacy/README.md)

## Estructura

```text
frontend/            el juego (es lo único que ve el navegador)
  index.html         entrada: HUD y pantallas en HTML (ES Modules)
  src/               código del juego (config, nucleo, escenas, interfaz, ...)
  Css/               layout.css (estructura) y ui.css (HUD, menús, táctil)
  pruebas/           pruebas automáticas del frontend
  Index/, legacy/    prototipo antiguo y experimento congelado
backend/             API de récords (Express 5, sin build)
  src/               app, rutas, servicios, almacenes y middlewares
  pruebas/           pruebas de contrato HTTP y de los middlewares
  datos/             redball.json (se crea solo, no se versiona)
docs/                arquitectura, física, mundo, interfaz y backend
Dockerfile           un contenedor: Express sirve API + juego
```

El frontend nunca importa de `backend/`; el backend sí importa los módulos
**puros** del frontend (`Progreso.js`, `mundo/niveles/`), así las reglas del
juego (récord, fusión, catálogo) están escritas una sola vez.