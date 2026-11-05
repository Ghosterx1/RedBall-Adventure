# Arquitectura — Red Ball Adventure

Documento vivo. Refleja lo que **está implementado**, no lo que nos gustaría.

## Estado actual

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Esqueleto, bucle de paso fijo, entrada, arranque | **Completada** |
| 2 | Física + Jugador (con pruebas) | **Completada** |
| 3 | Mundo: objetos y mecánicas | **Completada** (incluye `validar.js` y 5 niveles) |
| 4 | Render (nivel 1 idéntico al píxel) | Pendiente |
| 5 | Coleccionables, HUD, estado de partida | **Completada** (monedas, contador, puntuación y récord) |
| 6 | Enemigos con gravedad | Pendiente (la **cámara**, Fase 6 de la hoja de ruta del curso, ya está: ver §Cámara) |
| 7 | Escenas (título, pausa, final) + almacenamiento | **Completada** (HUD y menús en HTML/CSS, vidas, victoria/derrota, partículas) |
| 8 | Audio, partículas, materiales, rebote | Pendiente (el blip de la moneda y las partículas de la Fase 7 ya existen) |

## Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Idioma del código | **Español** | Coherencia con el equipo y con la documentación |
| HTML de entrada | **`/index.html`** (raíz) | Es el estándar que esperan Docker, Vercel, GitHub Pages… |
| Herramienta de build | **Ninguna: ES Modules nativos** | `server.js` ya sirve `application/javascript`; cero dependencias, cero `node_modules` |
| Pruebas | **`node --test` integrado** | Viene con Node 18+; no hace falta instalar nada |
| `redball-touch.html` | **`legacy/`** | 1.623 líneas huérfanas que duplicaban física y niveles |
| Prototipo antiguo | Sigue en **`/Index/Index.html`** | Permite comparar el comportamiento durante la migración |

> Consecuencia de "sin build": `package.json` declara `"type": "module"` y
> `server.js` se convirtió a ESM. Un único sistema de módulos en todo el repo.

## Estructura

```text
index.html              ← entrada nueva (ES Modules)
server.js               ← servidor estático ESM
package.json            ← "type": "module", scripts start/dev/test

src/
  main.js               ← único punto de contacto con el DOM
  config/
    ajustes.js          ← TODOS los números (segundos, px/s)
    paleta.js           ← TODOS los colores (migrados de Interfaz.js)
    materiales.js       ← propiedades de superficies (fase 8)
  nucleo/
    Bucle.js            ← paso fijo + acumulador, sin conocer el juego
    Entrada.js          ← mapa de acciones (teclado + táctil)
    Juego.js            ← orquestador: canvas + escena activa + sonido y HUD inyectados
    BusEventos.js       ← canal lateral entre capas
    Marcador.js         ← puntos y monedas de la partida (puro)
    Progreso.js         ← récord por nivel en localStorage (a prueba de fallos)
    Progresion.js       ← desbloqueo deducido del récord (sin estado propio)
    Partida.js          ← máquina de pantallas: título/niveles/juego/pausa/final
    Vidas.js            ← vidas de la partida (puro, duran más que un nivel)
  audio/
    Sonido.js           ← efectos sintetizados con Web Audio (sin archivos)
  escenas/
    EscenaPrueba.js     ← banco de pruebas de la física (Fase 2, congelado)
    EscenaMundo.js      ← escena real: consume un nivel y las mecánicas del mundo
  fisica/
    aabb.js             ← cajas, solape y aritmética de movimiento (puro)
    Colisiones.js       ← barrido por eje + asentamiento en superficies; contactos
    Fisica.js           ← gravedad, aceleración, fricción, topes, fórmulas del salto
  entidades/
    Jugador.js          ← la pelota: coyote, buffer, salto variable, impulso, rebote
  mundo/
    Objeto.js           ← base: capacidades (solido/superficie/peligro/checkpoint/coleccionable/meta)
    registro.js         ← tipo → fábrica, para niveles en datos y tipos nuevos
    movimiento.js       ← vaivén como función del tiempo (sin deriva)
    Mundo.js            ← agrega por capacidad, transporta pasajeros, zonas, recogida
    objetivo.js         ← qué hay que hacer para superar el nivel (regla pura)
    validar.js          ← errores y avisos de los datos de un nivel (sin lanzar)
    tipos.js            ← barril: importar registra TODOS los tipos
    tipos/              ← plataforma, elevada, rampa, elástica, móvil, efímera,
                          obstáculo, obstáculo móvil, peligro, checkpoint, moneda, meta
    niveles/index.js    ← CATÁLOGO: ordena, busca por id y encadena los niveles
    niveles/ayudas.js   ← generadores de datos (suelo, moneda, meta, pinchos…)
    niveles/nivel-1..5.js ← los cinco niveles jugables (datos puros)
    niveles/demo.js     ← nivel de demostración (datos puros, 21 monedas)
  render/
    Camara.js           ← ventana que sigue al jugador: seguimiento, mundo↔pantalla, visible
    pelota.js           ← dibujo del protagonista, compartido por las escenas
    particulas.js       ← chispas de moneda y polvo de los botes (pixel, sin alpha)
  interfaz/
    Interfaz.js         ← capa DOM: HUD, pantallas y botones (documento inyectado)
    modelo.js           ← datos de vista: tarjetas de nivel y resúmenes (puro)

Css/                    ← OJO: mayúscula. `layout.css` y `ui.css` son del juego nuevo;
                          `Main.css` y `Game.css` siguen sirviendo al prototipo.
pruebas/                ← node --test (*.test.js)
legacy/                 ← prototipo congelado
docs/                   ← esta documentación
```

Las carpetas nuevas usan minúsculas; `Css/`, `Js/` e `Index/` conservan su
mayúscula porque el contenedor Docker sirve los archivos en Linux, donde el caso
**sí** importa. `pruebas/integracion.test.js` verifica el caso exacto de todas
las rutas para que nadie vuelva a romperlo.

## Reglas de dependencia

Se cumplen en una sola dirección; `BusEventos` es el único atajo lateral.

```text
main → interfaz → escenas → (entidades, mundo) → fisica
                    ↓
                  render
   nucleo ← (interfaz y escenas; config es de todos)
   config ← (todas, sin excepciones)
```

- `config/` no importa **nada** del juego.
- `fisica/` no conoce `entidades/` ni `escenas/`: recibe cajas y devuelve contactos.
- `mundo/` no conoce `entidades/`: recibe un "cuerpo" con x, y, ancho, alto y
  devuelve eventos (`{ monedas, checkpoint, peligro, reiniciado }`).
- `audio/` no conoce el juego: no sabe qué es una moneda, solo sintetiza un blip.
  La escena decide cuándo suena y recibe el `Sonido` **inyectado** por `main.js`
  (`juego.sonido`), igual que recibe el almacén: así las pruebas pasan un doble
  y comprueban cuántas veces sonó.
- `nucleo/Progreso.js` no importa `localStorage` directamente: recibe el almacén
  por parámetro (`almacenDelNavegador()` es solo el valor por defecto).
- `render/` no conoce `escenas/`: recibe datos y pinta.
- `interfaz/` es la ÚNICA capa con DOM, y recibe el `document` por parámetro (en
  las pruebas, un doble): no conoce `window`, ni el bucle, ni las escenas.
  `main.js` le pasa datos ya cocinados (`datosHud()`, `tarjetasDeNiveles()`).
- El HUD no duplica contadores: monedas, puntos, vidas y progreso están en el
  DOM; el canvas solo pinta la misión del nivel y los avisos.
- La puntuación **no** vive en la colisión: `Colisiones.resolve()` devuelve
  `Contact[]` y la escena decide qué significa cada contacto.
- `pruebas/integracion.test.js` falla si una capa inferior importa una superior.

## Ciclo de vida de un cuadro

```text
requestAnimationFrame(t)
  └─ Bucle.avanzarHasta(t)
       ├─ delta real recortado a TOPE_TIEMPO (0,25 s)
       ├─ acumula y ejecuta pasos de exactamente 1/60 s:
       │    Juego.actualizar(dt)
       │      ├─ escena.actualizar(dt, juego)   ← física, reglas, cámara
       │      └─ entrada.terminarCuadro()       ← las pulsaciones "recién" caducan
       └─ Juego.dibujar(alfa)
            └─ escena.dibujar(ctx, alfa, juego)
```

**La entrada se cierra por paso, no por cuadro.** A 144 Hz existen cuadros en los
que no toca ejecutar ningún paso; si el cierre fuera por cuadro, una pulsación
rápida podría perderse. Al cerrar por paso, la pulsación la consume el siguiente
paso que se ejecute.

**Pausa:** `bucle.pausar()` deja de simular pero sigue llamando a `dibujar`, así
que el menú de pausa se pinta sobre el nivel congelado sin destruir el estado de
la partida. Desde la Fase 7 el que ordena pausar y reanudar es `main.js` con
`nucleo/Partida.js`; no hay pila de escenas porque las pantallas son secciones
del HTML.

El primer cuadro solo fija la referencia temporal: no simula ni dibuja.

## Convenciones

- Tiempo en **segundos**; velocidades en **px/s**. Nunca "por frame".
- Los factores que en el prototipo eran por frame se aplican con `Math.pow(f, dt * 60)`.
- Ningún número mágico fuera de `src/config/`.
- Ningún color fuera de `src/config/paleta.js`.
- `document`/`window` solo en `main.js` y en `nucleo/Entrada.js`; `interfaz/Interfaz.js`
  recibe el documento inyectado y no toca los globales.
- Nombres y comentarios en español, sin abreviaturas crípticas.

## Cómo ejecutar

```bash
npm start     # http://localhost:3000
npm test      # node --test, sin dependencias
```

| URL | Qué sirve |
|---|---|
| `/` | Juego nuevo (`index.html` → `src/main.js`) |
| `/Index/Index.html` | Prototipo antiguo, intacto |
| `/legacy/redball-touch.html` | Experimento congelado |

Variable `PORT` para cambiar el puerto.

## Línea base medida (contrato de regresión)

Valores medidos en el prototipo con un banco de pruebas headless (1.800 frames,
0 excepciones). Cualquier refactor debe conservarlos o mejorarlos **a propósito**.

| Magnitud | Valor de referencia | Dónde se verifica |
|---|---|---|
| Ápice del salto | 84,18 px | `ajustes.test.js` + `jugador.test.js` |
| Pasos en el aire | 44-46 | `ajustes.test.js` + `jugador.test.js` |
| Alcance horizontal | 230 px | `pruebas/ajustes.test.js` |
| Velocidad máxima | 300 px/s (5 px/frame) | `escena-prueba.test.js` + `jugador.test.js` |
| Independencia del refresco | diferencia ≤ 1 paso, sin deriva | `bucle.test.js` + `escena-prueba.test.js` |
| Dash | **95 px** (antes 26,8 px) | `jugador.test.js` |
| Salto corto (soltar) | 20,13 px frente a 84,18 px | `jugador.test.js` |
| Apoyada sin vibrar | posición idéntica en 600 pasos | `colisiones.test.js` + `jugador.test.js` |
| Cámara: jugador en pantalla | 38 % del ancho · 30 % del alto (nunca el centro) | `camara.test.js` + `camara-nivel.test.js` |
| Cámara: independencia del refresco | diferencia < 1e-9 px entre 30, 60 y 144 Hz | `camara.test.js` |
| Cámara: bordes del nivel | desplazamiento entre 0 y `mundo - vista` (nunca el vacío) | `camara.test.js` + `camara-nivel.test.js` |
| Vidas de la partida | 3 iniciales; nunca bajan de 0; derrota a la tercera muerte | `vidas.test.js` + `escena-interfaz.test.js` |
| Pantallas de la interfaz | 6 estados, solo transiciones legales (tabla congelada) | `partida.test.js` |
| HUD: repintados | 0 mientras la firma del estado no cambie | `interfaz.test.js` |
| Partículas | tope 96, vida 0,28-0,45 s, tamaño 2 px que decrece | `particulas.test.js` |
| Botones de la interfaz | 12, cada uno avisa una sola vez | `interfaz.test.js` + `arranque.test.js` |

## Deuda técnica y fase en la que se paga

| Problema (auditoría) | Estado |
|---|---|
| Sin `deltaTime`: física atada a 60 Hz | ✅ resuelto (Fase 1) |
| Teclas "pegadas" al perder el foco | ✅ resuelto (`Entrada.soltarTodo`) |
| `redball-touch.html` huérfano (53 % del repo) | ✅ movido a `legacy/` |
| Ruta hermana no bloqueada en `server.js` | ✅ corregido (`path.relative`) |
| CSS del juego nuevo con caso incorrecto en Linux | ✅ cubierto por prueba |
| Dash inútil (26,8 px) | ✅ resuelto (95 px, Fase 2) |
| Física y puntuación acopladas | ✅ resuelto (fases 2 y 5): el mundo devuelve eventos y la escena suma |
| 12 pinchos flotantes | ✅ resuelto: `validarNivel` los marca y los niveles nuevos no los tienen |
| Niveles duplicados en código | ✅ resuelto: niveles como datos (Fase 3) |
| Objetos cableados a mano en cada escena | ✅ resuelto: registro de tipos (Fase 3) |
| `ctx.ellipse` excesivo por cuadro | Fase 4 |
| Enemigos que flotan (sin gravedad) | Fase 6 |
| Sin pausa ni menús | ✅ resuelto (Fase 7): `nucleo/Partida.js` + `interfaz/Interfaz.js` |
| Audio limitado al blip de la moneda | Fase 8 |

## Física (Fase 2, completada)

La matemática completa y los valores medidos están en **`docs/FISICA.md`**.
Resumen de lo que ya existe:

```text
src/fisica/aabb.js       cajas, solape, limitar, moverHacia
src/fisica/Colisiones.js barrido por eje (X y luego Y) → Contact[]
src/fisica/Fisica.js     gravedad, acelerar, frenar, limitarVelocidad, desplazar,
                         alturaMaxima, tiempoEnAire, parametrosSalto
src/entidades/Jugador.js coyote, buffer, salto variable, impulso, rebote, suelo
```

Criterios cumplidos: `ajustes.test.js` sigue verde con la física modular, el
ápice se mantiene en 84,18 px medido a través de `Jugador`, y el impulso pasó de
26,8 px a **95 px**.

## Mundo (Fase 3, completada)

Mecánicas y contrato completo en **`docs/MUNDO.md`**. Resumen:

```text
src/mundo/Objeto.js      capacidades: solido, superficie, peligro, checkpoint
src/mundo/registro.js    tipo → fábrica (niveles en datos, tipos nuevos sin motor)
src/mundo/Mundo.js       agrega por capacidad, transporta pasajeros, zonas
src/mundo/tipos/         plataforma, elevada, rampa, elástica, móvil, efímera,
                         obstáculo, obstáculo móvil, peligro, checkpoint
src/render/Camara.js     seguimiento con suavizado independiente del refresco
src/escenas/EscenaMundo.js  cablea entrada → mundo → jugador → zonas → cámara
```

Lo que se añadió al motor (todo **opcional**; sin declararlo, la Fase 2 se
comporta igual): superficies inclinadas (`asentarEnSuperficies`), escalón de
hasta 6 px al andar, y rebote definido por el objeto (`restitucion`,
`impulsoRebote`) con tope `REBOTE_MAXIMO`.

Bug corregido de paso: `IMPULSO_ENFRIREAMIENTO` (nombre mal escrito) dejaba el
enfriamiento del impulso en `NaN`, así que el impulso **solo funcionaba una vez
por partida**. Ahora se recarga cada 0,5 s (`jugador.test.js`).

## Coleccionables, HUD y récord (Fase 5, completada)

La mecánica completa está en **`docs/MUNDO.md`** §5. Resumen de las piezas
nuevas:

```text
src/mundo/tipos/Moneda.js    coleccionable: giro por tiempo, recoger() idempotente
src/mundo/Mundo.js           recogerColeccionables() (barrido) + totales del nivel
src/nucleo/Marcador.js       puntos y monedas de la partida (valor configurable)
src/nucleo/Progreso.js       récord por nivel en localStorage, siempre normalizado
src/audio/Sonido.js          blip de dos notas con Web Audio (sin archivos)
src/escenas/EscenaMundo.js   evento → marcador → sonido → HUD → récord
src/config/ajustes.js        JUEGO.VALOR_MONEDA (10) · AUDIO · MUNDO.MONEDA_*
```

Tres decisiones que conviene recordar:

1. **El objeto no puntúa ni suena.** `Moneda.recoger()` solo se marca como
   cogida y devuelve `true`; quien suma, suena y guarda es la escena. Cambiar el
   valor de una moneda no toca el mundo, y el mundo se puede probar sin audio.
2. **La recogida se barre contra el recorrido del paso** (`barreHasta`, suma de
   Minkowski), con un tope de 48 px para que una reaparición no arrase el nivel.
3. **Se persiste por hechos, no por tiempo**: al completar el nivel y al salir de
   la escena. `#guardarProgreso` firma el último guardado (`puntos:monedas`) para
   no escribir dos veces lo mismo ni contar dos veces la partida.

Lo que fija `pruebas/escena-monedas.test.js`: las 21 monedas del nivel demo dan
**210 puntos**, `datosHud()` devuelve `monedas 21/21` y `puntos 210` (desde la
Fase 7 ese contador lo pinta el HUD del DOM, y la prueba comprueba además que el
canvas NO lo duplica), suena un solo blip por paso (aunque caigan dos monedas) y
el récord **nunca empeora**.

## Niveles, objetivos y progresión

Cinco niveles jugables (`nivel-1`…`nivel-5`) que son **datos**: el motor no
conoce ninguno. Piezas nuevas:

```text
src/mundo/niveles/index.js   catálogo: ordena, busca por id, da el siguiente
src/mundo/niveles/ayudas.js  generadores de datos (suelo, moneda, meta, pinchos…)
src/mundo/objetivo.js        normalizarObjetivo / estadoObjetivo / textoObjetivo (puro)
src/mundo/tipos/Meta.js      capacidad `meta`: avisa de la llegada, no puntúa
src/mundo/validar.js         validarNivel / validarCatalogo → errores y avisos
src/nucleo/Progresion.js     desbloqueo deducido del récord (sin estado propio)
src/escenas/EscenaMundo.js   objetivo → HUD → récord → cuenta atrás al siguiente
src/main.js                  arranca en el primer nivel sin completar (o `?nivel=`)
```

Cuatro decisiones que conviene recordar:

1. **El objetivo es una regla, no un `if` esparcido.** `estadoObjetivo()` recibe
   `{ monedas, totalMonedas, metaAlcanzada }` y devuelve si está cumplido y qué
   falta. La escena solo pinta; añadir un objetivo nuevo no toca ni el mundo ni
   la escena.
2. **La meta no supera el nivel, avisa.** `Meta.alcanzar()` es idempotente y
   devuelve `true` una sola vez; quien decide es el objetivo (`meta` sola, `meta`
   + monedas, `monedas`…). Así un mismo objeto sirve para niveles distintos.
3. **La progresión se deduce, no se guarda.** No hay lista de desbloqueados: el
   primer nivel siempre está abierto y cada nivel completado (campo `completado`
   del récord) abre el siguiente. No puede haber estado contradictorio porque no
   hay estado duplicado.
4. **Los datos se validan antes de jugarlos.** `validarCatalogo(NIVELES)` corre en
   `npm test` y en cualquier momento: ids únicos, orden, cajas dentro del nivel,
   meta con apoyo, monedas suficientes para el objetivo…

Y un quinto, de proceso: **los niveles se juegan en las pruebas**. Un bot
(`pruebas/ayudas/bot.js`) recorre cada nivel con la física real; si un salto deja
de ser posible o el objetivo pide más monedas de las que caen en la ruta, `npm
test` falla diciendo dónde. Es la única forma de que "escribir datos" no se
convierta en "escribir datos rotos".

## Cámara y desplazamiento del mundo (Fase 6 del curso, completada)

`src/render/Camara.js` es matemática pura (no dibuja ni toca el DOM) y
`EscenaMundo` es la única que la usa; los números viven en `CAMARA`.

```text
src/render/Camara.js      objetivoPara / seguir / centrar / aplicar / restaurar
                          mundoAPantalla / pantallaAMundo / visible / redimensionar
src/config/ajustes.js     CAMARA = { SUAVIZADO: 8, MARGEN_X: 0.38, MARGEN_Y: 0.3 }
src/escenas/EscenaMundo.js  la crea con el tamaño del nivel, la centra al entrar y
                            al reaparecer, la persigue en cada paso y la aplica al dibujar
```

Los requisitos, uno por uno:

| Requisito | Dónde se cumple |
|---|---|
| Seguimiento horizontal **y** vertical | `objetivoPara()` calcula los dos ejes por separado (`margenX`, `margenY`) |
| Movimiento suave | `seguir()`: `1 - e^(-SUAVIZADO·dt)`, exponencial e independiente del refresco |
| El jugador **no** queda en el centro | márgenes 38 % / 30 %: mira más hacia delante y hacia abajo que hacia atrás |
| Límites del escenario | `limitar(…, 0, mundoAncho - ancho)`: nunca se ve el vacío; si el nivel cabe, el eje queda en 0 |
| Plataformas, monedas y obstáculos se desplazan | **una** traslación del lienzo (`aplicar()`), no un offset por objeto |
| Niveles más grandes que la pantalla | `mundoAncho`/`mundoAlto` salen del nivel; `redimensionar()` recalcula los límites |
| Coordenadas de mundo vs de pantalla | mundo dentro de `aplicar()`/`restaurar()`, HUD fuera, y `mundoAPantalla`/`pantallaAMundo` para la conversión explícita |

Cinco decisiones que conviene recordar:

1. **La cámara es una traslación, no un desplazamiento por objeto.** `aplicar()`
   hace un `ctx.translate(-x, -y)`; el mundo y el jugador se pintan en
   coordenadas de MUNDO y el HUD en coordenadas de PANTALLA. Por eso un tipo de
   objeto nuevo se desplaza bien sin tocar la cámara, y no hay dos fórmulas que
   puedan discrepar.
2. **Suavizado exponencial, no `lerp` con constante fija.** `1 - e^(-k·dt)`
   compone igual a 30, 60 o 144 Hz; sumar una fracción por cuadro ataría la
   cámara al refresco (el mismo error que se evitó en el bucle y en la física).
3. **Márgenes en vez de centrado.** Centrar al jugador deja medio nivel de
   información detrás y ninguno delante; al 38 % se ve el doble de lo que viene.
   Es también lo que hace que la cámara no parezca pegada al personaje.
4. **Los límites mandan sobre el margen.** `limitar()` va por fuera del margen:
   al principio y al final del nivel el jugador se aparta del 38 %, que es
   exactamente lo que se quiere (no enseñar el vacío).
5. **Se redondea al dibujar, no al calcular.** `this.x` es decimal (movimiento
   suave); `desplazamiento` redondea una vez porque media pantalla desplazada
   emborrona el pixel art. El redondeo no se guarda, así que no acumula error ni
   tiembla cuando el jugador está quieto.

Lo que fijan las pruebas: `pruebas/camara.test.js` (12) cubre el contrato puro —
margen, bordes, independencia del refresco, ambos ejes, `visible()`,
`redimensionar()` y estabilidad del redondeo— y `pruebas/camara-nivel.test.js`
(7) juega una **torre de 1600×540** (dos pantallas de alto y tres de ancho) con
la escena real: la ventana viaja hasta los bordes en los dos ejes y vuelve, deja
al jugador al 30 % en mitad del nivel, todos los objetos se pintan con el mismo
offset y una etiqueta fuera de la ventana ni siquiera se dibuja.

Nota: los cinco niveles actuales miden `VISTA.ALTO` de alto, así que en ellos el
eje vertical se queda en 0. La torre de las pruebas es el caso que justifica que
`objetivoPara()` siga el eje Y; el día que un nivel sea más alto, ya funciona.

## Interfaz y experiencia del jugador (Fase 7, completada)

Toda la interfaz que no es el nivel es **HTML + CSS**; el canvas solo dibuja el
mundo. Piezas nuevas:

```text
index.html                  HUD del DOM + cinco pantallas (título, niveles, pausa, victoria, derrota)
Css/ui.css                  estética 16 bits: HUD, botones, tarjetas, scanlines, corazones
src/nucleo/Partida.js       máquina de pantallas con tabla de transiciones congelada
src/nucleo/Vidas.js         vidas de la PARTIDA (no del nivel), nunca negativas
src/interfaz/Interfaz.js    capa DOM: escribe el HUD y enseña/oculta pantallas
src/interfaz/modelo.js      datos de vista: tarjetas de nivel y resúmenes (puro)
src/render/particulas.js    chispas de moneda y polvo de rebote (cuadraditos, sin alpha)
src/escenas/EscenaMundo.js  datosHud(), vidas inyectadas, derrota, autoAvanzar, partículas
src/nucleo/Juego.js         gancho `alDibujar`: el HUD se sincroniza tras pintar
src/main.js                 controlador de flujo: botones y teclas → escena y pantalla
```

Los requisitos, uno por uno:

| Requisito | Dónde se cumple |
|---|---|
| Menú principal | `#pantalla-titulo` (`pantalla--opaca`): logo, JUGAR, NIVELES y leyenda de teclas |
| Botón de iniciar partida | `#boton-jugar` → `jugarDesdeMenu()` → primer nivel sin completar |
| Selección de niveles | `#pantalla-niveles`: una tarjeta por nivel con dificultad, monedas y candado |
| Contador de monedas | `#hud-monedas` (icono + `3/12`) alimentado por `EscenaMundo.datosHud()` |
| Indicador de progreso | `#hud-progreso`: barra segmentada + `aria-valuenow` |
| Menú de pausa | `#pantalla-pausa` (P, Escape o perder el foco) con 4 acciones |
| Pantalla de victoria | `#pantalla-victoria` al recibir `nivel:completado`; decide el paso de nivel |
| Pantalla de derrota | `#pantalla-derrota` cuando las vidas llegan a 0 (`partida:derrota`) |
| Reiniciar nivel | botón del menú de pausa y tecla R: misma pantalla, escena nueva |
| Efectos al recoger y rebotar | `particulas.js` (chispa dorada / polvo y chispas rosas) + `hud__valor--pop` + blip |

Seis decisiones que conviene recordar:

1. **Un solo contador visible.** Monedas, puntos, vidas, récord y progreso viven
   en el HUD del DOM; el canvas se queda con la misión del nivel y los avisos.
   `escena-monedas.test.js` comprueba además que el canvas **no** vuelve a pintar
   el contador: si alguien lo duplica, la prueba falla.
2. **La pantalla es un estado, no un booleano.** `Partida` guarda la pantalla
   actual y su tabla de transiciones; pausar dos veces no rompe nada y no se puede
   "ganar" desde el menú. `main.js` traduce cada cambio a `bucle.pausar()` +
   `interfaz.mostrarPantalla()`.
3. **Las vidas son del jugador, no del nivel.** `main.js` crea UNA `Vidas` y se la
   pasa a cada `EscenaMundo`; sin vidas inyectadas el motor no impone "game over",
   así el bot de las pruebas puede morir mil veces sin terminar la partida.
4. **El HUD se sincroniza al dibujar, no con eventos sueltos.**
   `Juego.alDibujar` llama a `Interfaz.sincronizarHud(escena.datosHud())` y la
   interfaz compara una firma de texto: si nada cambió, no toca el DOM (0
   escrituras por cuadro).
5. **La interfaz se prueba sin navegador.** `Interfaz` recibe el documento por
   parámetro y `pruebas/ayudas/dom-falso.js` implementa solo lo que usa (incluido
   `disparar('click')`), así botones, tarjetas y pantallas se prueban con
   `node --test`.
6. **El paso de nivel lo decide la pantalla de victoria.** Con interfaz, la escena
   se abre con `autoAvanzar: false`: supera el nivel, avisa por el bus y espera.
   SIGUIENTE / REPETIR / NIVELES son botones (y teclas), no temporizadores.

La estética: la misma fuente *Press Start 2P* del HUD del canvas, bordes de 3 px,
sombras duras de 3-4 px, scanlines con `repeating-linear-gradient` y animaciones a
`steps()` (nada de curvas suaves). La moneda y el corazón son SVG en `data:` con
`shape-rendering="crispEdges"`: no hay imágenes que descargar y no se ven
borrosos. `prefers-reduced-motion` apaga el latido del botón y el salto del
contador.

Lo que fijan las pruebas nuevas: `partida.test.js` (tabla de pantallas),
`vidas.test.js` (vidas que nunca bajan de cero), `interfaz.test.js` (HUD,
corazones, rejilla de niveles, botones y "sin HTML no rompe"),
`modelo-interfaz.test.js` (tarjetas y resúmenes), `particulas.test.js` (tope, vida,
tamaño que decrece, azar inyectado) y `escena-interfaz.test.js` (vidas → derrota,
`datosHud()`, `autoAvanzar`, chispas de moneda y de trampolín). `arranque.test.js`
ejecuta el `main.js` **real** con un DOM falso: abre el menú, pulsa JUGAR, pausa
con P, reinicia con R y comprueba el HUD.

## Siguiente paso

Render del nivel 1 idéntico al píxel (Fase 4): los cinco niveles ya se juegan, se
validan, se recorren con cámara y tienen interfaz completa, así que lo que queda
ahí es la capa visual, no las mecánicas. Después, enemigos con gravedad (Fase 6 de
esta tabla): al vivir en el mundo ya se desplazan solos con la cámara, y el
contacto que quita vida puede gastar las `Vidas` que ya existen (`vidas.perder()`
+ `partida:derrota`), así que tampoco hay que inventar el final de partida. Queda
para la Fase 8 el audio completo (salto, rebote, victoria y derrota) y los
materiales por superficie.

