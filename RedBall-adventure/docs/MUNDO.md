# Mundo — objetos, mecánicas y datos de nivel

Documento vivo de las **fases 3 y 5**. Refleja lo que está implementado en
`src/mundo/`, en `src/nucleo/` (marcador y récord) y en
`src/escenas/EscenaMundo.js`.

## 1. La idea: capacidades, no tipos

Un objeto del mundo **no se define por su clase**, sino por lo que declara
poder hacer. El motor y la escena preguntan *"¿eres sólido?"*, nunca *"¿eres una
plataforma?"*:

| Capacidad (getter) | Devuelve | Quién la usa |
|---|---|---|
| `solido` | el propio rect (o `null` si no bloquea) | `fisica/Colisiones.js` |
| `superficie` | objeto con `alturaEn(x)` / `normalEn(x)` | `fisica/Colisiones.js` |
| `peligro` | rect que reinicia al jugador | `Mundo.revisar` |
| `checkpoint` | rect con `punto` de reaparición | `Mundo.revisar` |
| `coleccionable` | el propio objeto (o `null` si ya se cogió) | `Mundo.revisar` |

Y cinco **ganchos opcionales**: `actualizar(dt, mundo)`, `dibujar(ctx)`,
`alPisar(cuerpo)`, `recoger()` y `reiniciar()`. Implementar `recoger()` es lo que
convierte un objeto en recogible: el mundo cuenta los que lo tienen para saber el
TOTAL del nivel, aunque ya estén cogidos (`Mundo.totalColeccionables`).

Consecuencias prácticas:

- `Mundo.solidos`, `Mundo.superficies`, `Mundo.peligros`, `Mundo.checkpoints` y
  `Mundo.coleccionables` son **filtros por capacidad**, no listas por tipo. No
  hay un solo `switch`.
- Un objeto puede tener **varias** capacidades a la vez: el obstáculo móvil es
  sólido *y* peligroso sin heredar de nada raro.
- Quitar una capacidad es devolver `null`: así desaparece una plataforma efímera
  (`get solido() { return this.estado === 'oculta' ? null : this; }`) **sin que
  el motor sepa que existen las plataformas efímeras**.

## 2. Los doce objetos

Todos viven en `src/mundo/tipos/`, se auto-registran y leen sus números de
`MUNDO` (`src/config/ajustes.js`).

| `tipo` | Clase | Capacidades | Propiedades propias |
|---|---|---|---|
| `plataforma` | `Plataforma` | sólido | `material`, `unSoloSentido`, `bloquea` |
| `plataformaElevada` | `PlataformaElevada` | sólido (una sola dirección) | `material` (siempre `unSoloSentido`) |
| `rampa` | `Rampa` | superficie | `pendiente` (`'sube'`/`'baja'`) o `desnivel`, `material` |
| `elastica` | `Elastica` | sólido | `restitucion` (> 1), `impulsoRebote` (px/s) |
| `movil` | `Movil` | sólido | `eje`, `recorrido`, `velocidad`, `pausa`, `fase` |
| `efimera` | `Efimera` | sólido (mientras se ve) | `retardo`, `aviso`, `reaparicion` (s) |
| `obstaculo` | `Obstaculo` | sólido | `forma`, `material` |
| `obstaculoMovil` | `ObstaculoMovil` | sólido + peligro | `eje`, `recorrido`, `velocidad`, `pausa`, `fase`, `haceDano` |
| `peligro` | `Peligro` | peligro | `forma` (`pinchos`/`agua`/`banda`), `motivo` |
| `checkpoint` | `Checkpoint` | checkpoint | `activo` (estado), `punto` (derivada) |
| `moneda` | `Moneda` | coleccionable | `valor` (puntos), `giro` (rad/s), `balanceo` (px), `fase`; estado `recogida`, `efecto` |
| `meta` | `Meta` | meta | `alcanzada` (estado), `ancho`/`alto` de `MUNDO`; `alcanzar()` idempotente |

Comportamientos comprobados en `pruebas/mundo-objetos.test.js`:

- **Móvil**: `Vaiven` calcula la posición como **función del tiempo**, no
  acumulando velocidad. Un paso de 1/60 y dos de 1/120 dejan la plataforma en el
  mismo sitio (error < 1e-9) y un ciclo completo vuelve al origen.
- **Efímera**: máquina de estados `firme → aviso → oculta → firme` con timers en
  segundos; al ocultarse su `solido` pasa a `null`.
- **Rampa**: `alturaEn` devuelve `null` fuera del tramo y la normal es unitaria.
- **Elástica**: `restitucion = 1,2` e `impulsoRebote = 140`; con el mismo impacto
  sube **161,7 px** frente a los **11,9 px** del material `blando` (13,6 veces
  más) y nunca supera `REBOTE_MAXIMO`.
- **Checkpoint**: se enciende una sola vez y su `punto` se da en coordenadas de
  "pies" (centro, a ras de suelo), para que el mundo no sepa cuánto mide la bola.
- **Moneda**: el giro se calcula con el **tiempo acumulado**, así que sale el
  mismo ángulo a 60 que a 144 Hz; `recoger()` es idempotente (devuelve `true` una
  sola vez) y el balanceo vertical es solo dibujo: su caja de colisión no se mueve.

## 3. Datos de nivel

Un nivel es **JSON puro**: nada de clases ni funciones. `Mundo` los fabrica con
`crearObjeto`.

```js
{
  tipo: 'movil',
  x: 288, y: 164, ancho: 48, alto: 8,
  eje: 'y', recorrido: 56, velocidad: 40
}
```

`src/mundo/niveles/demo.js` es el nivel de demostración: 960x270 px con las diez
mecánicas (rampa, cornisa atravesable, obstáculo, plataforma móvil, obstáculo
móvil, trampolín, efímera, agua, pinchos, dos checkpoints), **21 monedas**
repartidas por el recorrido y `etiqueta` en cada objeto para el banco de pruebas.

### El catálogo y el objetivo

`src/mundo/niveles/index.js` es la frontera entre motor y contenido: enumera los
niveles (`NIVEL_1`…`NIVEL_5`), los ordena por `orden` y los busca por `id`. El
motor (`Mundo`, `EscenaMundo`) **no conoce ningún nivel concreto**: recibe datos,
así que un nivel nuevo (o uno que llegue por JSON) es contenido, no código.

```js
{
  id: 'nivel-3',            // estable: clave del récord guardado
  orden: 3,                 // orden de juego = orden de desbloqueo
  nombre: 'Cuidado',
  dificultad: 3,            // 1..5, informativo (HUD)
  ancho: 1800, alto: VISTA.ALTO,
  inicio: { x: 60, y: 240 },
  objetivo: { tipo: 'meta', monedas: 6 },
  objetos: [ /* … */ ]
}
```

`objetivo` se normaliza en `src/mundo/objetivo.js` y hay dos tipos:

| `tipo` | Se supera cuando… | Extra |
|---|---|---|
| `meta` | se toca el objeto `meta` **y** se llevan las `monedas` exigidas | `monedas` (0 por defecto) |
| `monedas` | se recogen **todas** las monedas del nivel | — |

Quien decide es `estadoObjetivo(objetivo, { monedas, totalMonedas, metaAlcanzada })`,
una función **pura**: la escena solo le pasa los datos y pinta lo que devuelve
(`cumplido`, `faltanMonedas`, texto del HUD). Un objetivo nuevo (por ejemplo
`{ tipo: 'tiempo', segundos: 30 }`) se añade ahí, sin tocar el mundo ni la escena.

### ¿Está bien escrito el nivel? (`validar.js`)

`validarNivel(datos)` y `validarCatalogo(niveles)` devuelven listas con **código
estable**, nunca lanzan:

- **Error** (el nivel no se puede jugar): `tipo-desconocido`, `caja` inválida,
  `fuera-del-nivel`, `objetivo`, `sin-meta`, `sin-monedas`, `monedas-imposibles`
  (se exigen más monedas de las que existen), `id-duplicado`, `orden`, `inicio`
  sin suelo firme, `dimensiones` imposibles…,
- **Aviso** (se juega, pero huele mal): `sin-nombre`, `sin-dificultad`,
  `nivel-pequeno`, `sin-checkpoint`, `peligro-flotante`, `meta-sin-apoyo`,
  `multiples-metas`.

Valida construyendo los objetos de verdad (`crearObjeto`), así que si el catálogo
de tipos cambia, el validador cambia con él.

Las monedas se declaran como cualquier otro objeto (`{ tipo: 'moneda', x, y }`)
y el total lo cuenta el mundo al construirse, no el nivel: si mañana una moneda
la genera otro objeto, el HUD sigue acertando.

`Mundo.desdeNivel(datos)` equivale a `new Mundo(datos)`. El constructor acepta
también objetos ya construidos, así que una prueba puede pasar `[efimera]` sin
pasar por JSON.

## 4. Añadir un objeto nuevo (2 archivos, 0 cambios en el motor)

Ejemplo real: una plataforma que se mueve en diagonal y corta el paso.

```js
// src/mundo/tipos/Diagonal.js
import { Plataforma } from './Plataforma.js';
import { registrarTipo } from '../registro.js';

export class Diagonal extends Plataforma {
  static tipo = 'diagonal';

  constructor({ velocidad = 20, ...resto } = {}) {
    super(resto);
    this.velocidad = velocidad;
  }

  actualizar(dt) {
    const antes = { x: this.x, y: this.y };
    this.x += this.velocidad * dt;
    this.y += this.velocidad * dt;
    this.delta = { dx: this.x - antes.x, dy: this.y - antes.y };
  }
}

registrarTipo(Diagonal.tipo, (datos) => new Diagonal(datos));
```

Después, **una línea** en `src/mundo/tipos.js`:

```js
import './tipos/Diagonal.js';
export { Diagonal } from './tipos/Diagonal.js';
```

Y ya está: entra en `mundo.solidos`, se dibuja con el `dibujar` heredado,
transporta pasajeros (`delta`), y las pruebas de integración comprueban que todo
archivo de `tipos/` está en el barril (`pruebas/integracion.test.js`). No hace
falta tocar `Mundo.js`, `Fisica.js`, `Jugador.js` ni `EscenaMundo.js`.

Si el objeto necesita una capacidad nueva (por ejemplo "congela al jugador"),
el orden es: **primero** un getter en `Objeto.js` (por defecto `null`), **después**
el tipo que lo devuelve y **por último** quien lo consume. Nunca un `switch`.

## 5. Un paso de simulación

Lo cablea `EscenaMundo.actualizar`, y el orden importa:

```text
1. mundo.actualizar(dt)        cada objeto se mueve y publica su `delta`
2. mundo.transportePara(j)     si va sobre algo móvil, se mueve con ello
3. jugador.actualizar(...)     física con solidos/superficies/limites del mundo
4. mundo.revisar(j)            recogida → checkpoint → peligro/caída → "me han pisado"
```

- **2 antes que 3**: si la plataforma se mueve primero, el jugador que va encima
  recibe el mismo desplazamiento y el barrido posterior lo deja apoyado. La
  tolerancia es el propio `delta` del objeto (`|pies - cara| ≤ |dy| + 1`), así
  que también funciona bajando: sin ella el pasajero se quedaría atrás.
- **4 después de 3**: `revisar` necesita los contactos de este paso. Si toca
  peligro o se cae fuera, `revisar` recoloca al jugador en
  `mundo.reaparicion()` (último checkpoint o `inicio`), sube `reinicios` y la
  escena marca un destello. Si no muere, avisa a los sólidos pisados con
  `alPisar` — así la efímera arranca su cuenta atrás sin que el mundo sepa qué
  es una efímera.
- **La recogida va primero**: lo que se toca en el mismo paso en que te caes al
  agua también cuenta. `revisar` devuelve
  `{ monedas, checkpoint, peligro, reiniciado }`.
- El jugador **no** se reinicia dentro de `Jugador`: morir es una decisión del
  mundo, no de la entidad.

### Recogida a alta velocidad (barrido continuo)

Una moneda mide 14 px y el jugador avanza como mucho 10,3 px por paso, así que
el solape puntual casi siempre basta. Casi: un paso largo (un tirón de la
ventana, un `dt` recortado) o un objeto diminuto podrían *saltárselo*. Por eso
`Mundo.recogerColeccionables` compara el **recorrido** del paso, no dos fotogramas:

```text
fisica/aabb.js  barreHasta(cuerpo, {dx, dy}, objetivo)
```

Suma de Minkowski + test de franjas: el problema se reduce a "¿el segmento
centro→centro+desplazamiento toca el rectángulo del objetivo expandido por media
caja?". Es exacto — no inventa choques en diagonal — y cuesta lo mismo que un
solape normal.

Dos salvaguardas:

| Regla | Motivo |
|---|---|
| Se barre solo si el salto del paso es ≤ `RECOGIDA_BARRIDO_MAXIMO` (48 px) | Un salto mayor solo puede ser un teletransporte (reaparición al morir, cambio de nivel). Sin este tope, morir arrasaría todas las monedas de la línea de vuelta |
| `recoger()` es idempotente | Barrer un tramo no puede contar dos veces la misma moneda |

La caja del paso anterior la guarda el propio `Mundo` (`ultimaCajaJugador`), así
que la escena no tiene que acordarse de nada; `reiniciar()` la olvida.

## 6. Reglas de diseño que impone el motor

| Regla | Por qué |
|---|---|
| Una rampa debe **morir en el canto** de la plataforma alta, no flotando | El asentamiento usa el centro de la caja: el desnivel al llegar al canto lo absorbe el escalón (≤ 6 px) |
| Las superficies se resuelven por el **centro** de la caja | Hace predecible el contacto y evita enganchones; el precio es hasta 12 px de voladizo |
| `recorrido` de un móvil es siempre **positivo** desde su posición inicial | `y` crece hacia abajo: para subir, se coloca el origen arriba |
| Los peligros **no son sólidos** | Entrar es el castigo; si bloquearan, no se podría caer dentro del agua |
| Un `checkpoint` da su `punto` como **pies** | El mundo no necesita saber el tamaño del jugador |
| Los objetos ocultos devuelven `solido = null` | Desaparecer no necesita ninguna condición especial en el motor |
| Las monedas **no** son sólidas ni peligrosas | Se atraviesan: el gesto es pasar por encima, no chocar |
| La **meta** tampoco es sólida, ni peligrosa, ni puntúa | Es un aviso de llegada; quien decide si el nivel se supera es `mundo/objetivo.js` |
| Lo recogible se detecta contra el **recorrido** del paso | Ninguna moneda se escapa a alta velocidad, y el tope de 48 px evita que una reaparición arrase el nivel |
| `recoger()` es idempotente | El mundo puede mirar la misma moneda varias veces sin contarla dos veces |

## 7. Pruebas

| Archivo | Qué fija |
|---|---|
| `pruebas/mundo-objetos.test.js` | registro de tipos, capacidades y propiedades de cada objeto, dibujo sin DOM |
| `pruebas/mundo-sistema.test.js` | agregación por capacidad, transporte de pasajeros, checkpoints, peligros, caída, efímera pisada, nivel demo |
| `pruebas/rampas.test.js` | asentamiento (unidad) + subir, bajar, saltar y atravesar desde abajo (integración con `Jugador`) |
| `pruebas/escena-mundo.test.js` | cableado completo con el `Bucle` real: avanzar, morir, checkpoint, HUD |
| `pruebas/camara.test.js` | márgenes, bordes del nivel y suavizado independiente del refresco |
| `pruebas/moneda.test.js` | capacidad `coleccionable`, animación por tiempo, `recoger()` idempotente, dibujo y reset |
| `pruebas/recogida.test.js` | recogida normal, **alta velocidad** (barrido), diagonal sin falsos positivos, teletransporte, totales |
| `pruebas/marcador.test.js` | puntuación y contador de monedas (puro, con datos sucios) |
| `pruebas/escena-monedas.test.js` | mundo → marcador → HUD → sonido → récord, de punta a punta |
| `pruebas/meta.test.js` | capacidad `meta`: registro, `alcanzar()` idempotente, `apoyo`, dibujo apagado, reset |
| `pruebas/objetivo.test.js` | normalización y evaluación de los objetivos (`meta`, `meta` + monedas, `monedas`), texto del HUD |
| `pruebas/validar.test.js` | cada error y aviso del validador, con datos rotos a propósito |
| `pruebas/catalogo-niveles.test.js` | los 5 niveles del catálogo pasan `validarCatalogo` sin errores ni avisos |
| `pruebas/niveles-jugables.test.js` | un **bot** termina los 5 niveles: sin reinicios, con monedas y récord marcado |
| `pruebas/progresion.test.js` | desbloqueo encadenado deducido del récord, `nivelInicial`, `avance` |
| `pruebas/escena-objetivo.test.js` | cableado objetivo → HUD → récord → nivel siguiente (cuenta atrás) |

## 8. Deuda conocida de esta fase

- **El validador no conoce al jugador**: comprueba datos (tipos, cajas dentro
  del nivel, meta con apoyo, monedas suficientes para el objetivo…) pero no sabe
  si un salto es posible. Eso lo mide el **bot** de
  `pruebas/niveles-jugables.test.js`, que juega los cinco niveles de verdad.
- **Una plataforma que se mueve *hacia* un jugador parado puede solaparlo**: el
  barrido impide *entrar* en un sólido, no que un sólido entre en ti. Se evita
  con velocidades moderadas (`MOVIL_VELOCIDAD = 40 px/s`).
- **Sin colisión entre objetos**: dos plataformas móviles pueden cruzarse; solo
  el jugador colisiona.
- **La rampa es un segmento recto**: no hay curvas ni pendientes variables, pero
  cualquier objeto con `alturaEn`/`normalEn` funcionaría igual.
- **El obstáculo móvil hace daño siempre**, incluso apoyándose encima. Si molesta,
  `haceDano: false` lo convierte en un ascensor sólido.
- **Una moneda recogida no vuelve** hasta reiniciar el nivel (`Mundo.reiniciar()`):
  no hay coleccionables que reaparezcan. Si algún día se necesitan, basta con que
  su `coleccionable` vuelva a devolver `this` y que `recoger()` admita repetirse.
- **El récord guarda puntos y monedas, nada más**: sin tiempo, vidas ni monedas
  por nivel distintas a las del propio nivel. Ampliarlo es tocar `nivelNormalizado`
  de `nucleo/Progreso.js` y subir `VERSION_PROGRESO`.
- **`EscenaPrueba` sigue existiendo** como banco de física (Fase 2) y comparte
  `render/pelota.js`; desaparecerá en la Fase 4 con el nivel 1 real.

