# Física — matemática y valores medidos

Documento de referencia de `src/fisica/` y `src/entidades/Jugador.js`.
Todo lo que hay aquí está verificado por `pruebas/fisica.test.js`,
`pruebas/colisiones.test.js` y `pruebas/jugador.test.js`.

## 1. Convenios

| Concepto | Convenio | Por qué |
|---|---|---|
| Eje Y | **crece hacia abajo** | Es el del lienzo: `y = 0` es el borde superior |
| Caer | `vy > 0` | Consecuencia del anterior |
| Saltar | `vy < 0` | Consecuencia del anterior |
| Tiempo | segundos | Nunca "por frame" |
| Velocidad | px/s | Igual en cualquier refresco |
| Paso | `dt = 1/60 s` fijo | Lo garantiza `nucleo/Bucle.js` |

## 2. Integración: Euler semi-implícito

En cada paso, en este orden:

```text
v ← v + a·dt          (primero la velocidad)
x ← x + v·dt          (después la posición, con la velocidad NUEVA)
```

- El orden inverso (*Euler explícito*) **inyecta energía**: con aceleración
  constante el cuerpo "flota" y acumula error.
- El semi-implícito es estable y determinista con `dt` fijo, que es el caso.
- El sesgo de discretización es **constante**, no aleatorio: con `g = 1152` y
  `v0 = -450`, el ápice continuo sería 87,89 px y el discreto mide **84,18 px**.
  Ese 4 % es el mismo sesgo que tenía el prototipo, y es el contrato de
  regresión del proyecto.

## 3. Relaciones entre las variables del salto

Con gravedad `g` constante y velocidad inicial `v0` hacia arriba:

| Magnitud | Fórmula | Valor con las constantes actuales |
|---|---|---|
| Altura del ápice | `h = v0^2 / (2g)` | 87,89 px (teórico) / **84,18 px** (medido) |
| Tiempo total en el aire | `t = 2·v0 / g` | 0,781 s (**44-46 pasos**) |
| Alcance horizontal | `R = v_max · t` | ~230 px |
| Velocidad en el instante `t` | `v(t) = v0 + g·t` | 0 en el ápice |
| Altura en el instante `t` | `y(t) = v0·t + g·t^2/2` | parábola |

### Diseño inverso (altura y duración ajustables por separado)

Si se quiere un salto de altura `h` y duración total `t`:

```text
v0 = 4h / t          g = 8h / t^2
```

Implementado en `fisica/Fisica.js` como `parametrosSalto(h, t)`, con inversas
`alturaMaxima(v, g)` y `tiempoEnAire(v, g)`. Cambiar `GRAVEDAD` y
`SALTO_VELOCIDAD` a la vez con estas fórmulas cambia el salto **sin cambiar su
forma**, y las pruebas comprueban la ida y vuelta exacta.

## 4. Horizontal: aceleración, desaceleración y fricción

**Con entrada** (aceleración acotada hacia un objetivo):

```text
objetivo = eje · VELOCIDAD_MAXIMA
vx ← moverHacia(vx, objetivo, ACELERACION · dt)
```

`moverHacia` recorta el paso y **nunca sobrepasa el objetivo**: no hay
sobreoscilación y `vx` llega a 300 px/s exactos (0,167 s a 1800 px/s^2).
Al invertir la dirección eso mismo actúa como **desaceleración**: pasa por cero
antes de acelerar al otro lado (verificado en `fisica.test.js`).

**Sin entrada** (fricción exponencial del material):

```text
vx ← vx · f^(dt·60)        f = 0.8 césped · 0.9 piedra · 0.98 hielo
si |vx| < UMBRAL_PARADA → vx = 0
```

Elevar a `dt·60` convierte un factor pensado "por frame a 60 Hz" en el mismo
decaimiento **por segundo** a cualquier tasa. El umbral de parada evita el
deslizamiento infinito de 0,3 px/s. En el aire se usa `AMORTIGUAMIENTO_AIRE`
(0,98): casi sin freno.

## 5. Colisiones: barrido por eje (*swept AABB*)

No se pregunta *"¿estoy solapado?"* sino *"¿cuánto puedo avanzar antes de
chocar?"*:

```text
permitido = |desplazamiento|
para cada sólido que se solape en el eje PERPENDICULAR:
    distancia = borde_del_sólido - borde_de_la_caja      (>= 0)
    permitido = min(permitido, distancia)
avanzar exactamente `permitido` y emitir un contacto si se recortó
```

Consecuencias (todas con prueba):

| Propiedad | Cómo se consigue |
|---|---|
| **No se atraviesa** a ninguna velocidad | La distancia se mide al borde, no por penetración: da igual un paso de 5 o de 400 px |
| **No vibra** | La caja queda *exactamente* en el borde; no se empuja fuera una penetración consumida |
| **El suelo no bloquea el avance horizontal** | El eje perpendicular se compara con desigualdad **estricta** (`> y + margen`) |
| **Sin enganchones en esquinas** | X se resuelve antes que Y (dos resoluciones independientes) |
| **Plataformas atravesables** | `unSoloSentido`: solo bloquean con `dy > 0` y si la caja venía de arriba |
| **No depende del orden** | Se toma el mínimo de todas las distancias |

Un contacto es `{ eje, normal, solido, material, esLimite }`, donde `normal` es
la dirección en la que **empuja la superficie** (suelo → `{x:0, y:-1}`). La
colisión no sabe de rebotes, puntos ni muerte: eso lo decide quien la usa.

## 6. Suelo, rebote, salto variable e impulso

- `enSuelo` se recalcula **cada paso** desde los contactos (`normal.y < 0`).
  Apoyada, la gravedad mete 0,32 px y el barrido la devuelve al borde exacto: la
  posición es idéntica en los 600 pasos de la prueba → **sin temblor**.
- **Rebote**: `vy ← -|vy_impacto| · restitución`, solo si `restitución > 0` y
  `|vy_impacto| >= UMBRAL_REBOTE` (80 px/s). La serie geométrica se agota sola:

  | Rebote | vy de salida | Altura |
  |---|---|---|
  | 1 | 231 px/s | 23,2 px |
  | 2 | 126 px/s | 6,9 px |
  | 3 | 68 px/s | 2,0 px → bajo el umbral: reposo |

- **Salto variable**: al soltar el botón subiendo, `vy ← max(vy, v0·0.5)` una
  sola vez. Medido: **84,18 px** mantenido frente a **20,13 px** de toque corto.
- **Coyote time** (0,1 s) y **buffer de salto** (0,13 s): la pelota perdona
  pulsaciones imprecisas. Es lo que hace que el control "se sienta justo".
- **Impulso**: 600 px/s durante 9 pasos enteros (`round(0.15/dt)`), **95 px**
  medidos, con 0,5 s de enfriamiento. Se usa un contador de pasos y no un
  temporizador en segundos para que la distancia sea exacta y no dependa de
  redondeos de coma flotante.

## 7. Valores medidos (regresión)

| Magnitud | Medido | Prueba |
|---|---|---|
| Ápice, salto mantenido | 84,18 px | `jugador.test.js` |
| Pasos en el aire | 44-46 | `jugador.test.js` |
| Ápice, toque corto | 20,13 px | `jugador.test.js` |
| Velocidad máxima horizontal | 300 px/s exactos | `jugador.test.js` |
| Parada desde 300 px/s (césped) | 0,5 s | `jugador.test.js` |
| Impulso | 95 px en 10 pasos | `jugador.test.js` |
| Rebotes en plataforma elástica | 231 → 126 → 68 px/s | `jugador.test.js` |
| Posición apoyada en 600 pasos | idéntica, `vy = 0` | `colisiones.test.js` |
| Paso máximo sin atravesar | 400 px en un solo paso | `colisiones.test.js` |
| Escalón máximo que se sube | 6 px (`MUNDO.ESCALON_MAXIMO`) | `colisiones.test.js` |
| Rampa: pasos en el aire subiendo/bajando | 0 | `rampas.test.js` |
| Trampolín frente a `blando` (mismo impacto) | 161,7 px frente a 11,9 px | `jugador.test.js` |

## 8. Deuda conocida de esta fase

- El jugador es una **caja** de 24x24 px aunque se pinte como círculo: es lo
  habitual en plataformas 2D y hace que las esquinas sean predecibles.
- El ancho de la caja hace que la pelota quede "apoyada" mientras cualquier
  parte de su caja pise la plataforma (hasta 24 px de voladizo visual).
- No hay *sub-pasos*: si en el futuro aparecen sólidos de 1 px o velocidades
  extremas, el barrido ya lo cubre, pero conviene medirlo antes de asumirlo.
- `render/` ya existe para lo que no es física (cámara y dibujo de la pelota),
  pero `EscenaPrueba` sigue pintando directamente; se unificará en la Fase 4.
- La caja mide 24x24 y las rampas se resuelven por el **centro** de la caja: en
  el canto de una cornisa puede sobrar hasta `RAMPA_TOLERANCIA` de desnivel. Lo
  absorbe el escalón del apartado 9.

## 9. Ampliaciones de la Fase 3 (rampas, escalones y rebotes por objeto)

Tres capacidades nuevas, **opcionales**: si el mundo no las declara, el motor se
comporta exactamente igual que en la Fase 2 (las pruebas antiguas siguen verdes).

### 9.1 Superficies inclinadas (`Colisiones.asentarEnSuperficies`)

Una rampa no es un rectángulo: expone `alturaEn(x)` y `normalEn(x)`. Después del
barrido se asienta el cuerpo sobre la pendiente:

```text
desnivel = alturaEn(centro_x) - (y + alto)
|desnivel| > RAMPA_TOLERANCIA (7 px)  → no se toca (vuela o pasa por debajo)
desnivel > 0 y vy < 0                → no se toca (está saltando: se suelta)
en otro caso                         → y = alturaEn(centro_x) - alto   (contacto de suelo)
```

- **Subir**: el avance horizontal de 5 px/60 Hz hunde la caja ~2,5 px en la
  cuesta; el asentamiento la devuelve a la superficie → se sube andando, sin
  escalones ni bloqueos horizontales.
- **Bajar**: la gravedad solo aporta 0,32 px/paso, así que sin asentamiento la
  bola *botaría* por la cuesta. Con él se queda pegada (0 pasos en el aire
  medidos en `rampas.test.js`).
- **Una sola dirección**: desde > 7 px por debajo no engancha, así que se puede
  saltar a través de ella desde abajo.
- **Guarda antisolape**: si asentarse metiera la caja dentro de un bloque (una
  rampa que muere en una cornisa), el ajuste se descarta. Sin esto, rampa y
  canto se pelearían cada paso.

### 9.2 Escalón (`MUNDO.ESCALON_MAXIMO = 6 px`)

En el barrido horizontal, si lo que frena es el **canto** de un sólido cuya cara
superior queda entre 1 y 6 px por encima de los pies, la caja sube a esa cara y
el movimiento continúa (se recalcula una vez). Es lo que permite que una rampa
termine limpiamente en una plataforma 3,84 px más alta. Con `escalon: 0` en las
opciones se desactiva.

### 9.3 Rebote definido por el objeto

El material da una `restitucion` base (`blando` 0,55), pero el **sólido** puede
sobreescribirla con `restitucion` e `impulsoRebote` (px/s extra):

```text
vy ← -min(REBOTE_MAXIMO, |vy_impacto| · restitucion_objeto + impulsoRebote)
```

Una restitución > 1 devuelve más energía de la que llega (trampolín), así que es
obligatorio el tope `MUNDO.REBOTE_MAXIMO = 620 px/s`. Con `restitucion = 1,2` e
`impulsoRebote = 140`, un impacto de 420 px/s pediría 644 px/s y sale a **620**
(regla verificada en `jugador.test.js`). El umbral de 80 px/s sigue aplicándose:
por eso se puede **posar** en el trampolín y saltar con normalidad.

