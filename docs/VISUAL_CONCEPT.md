# Concepto Visual - Red Ball Adventure

## 1. Dirección de arte

**Estilo:** Estilo *Bounce / Bounce Touch*: todo redondito y caricaturesco.
Cielo cian brillante, colinas verdes de lomos redondeados, sol gigante detrás
del suelo, nubes de bolitas, cactus y piedras, y la pelota roja con ojos
grandes que se tocan en el centro.

**Reglas visuales clave:**
- Cero ángulos rectos: islas, suelo, agua y HUD usan esquinas redondeadas
  (`roundRectPath`, elipses y lomos).
- Cielo cian `#1b9ce6` con sol amarillo-naranja (`#ffe066` → `#ffb62e`).
- Resolución interna 480 × 270 escalada; píxeles nítidos.

## 2. Paleta

| Rol | Hex |
|---|---|
| Cielo | `#1b9ce6` |
| Sol | `#ffb62e` (borde) / `#ffe066` (centro) |
| Colina lejana | `#4cbd45` |
| Colina cercana | `#2f9e2f` |
| Pasto | `#3ecb3e` + lomos claros `#8ee04a` |
| Tierra | `#2f6b35` con bultos `#256b2c` |
| Pelota | `#d8281f` + brillo `#ff7a6b` + sombra `#931b14` |
| Anillo | `#f6b40b` + `#ffe082` |
| Agua | `#2f9df2` / olas `#8fd6fb` |
| Enemigo | `#2b3038` |
| Cactus | `#2fa33b` + brillo `#6ee668` |
| Piedra | `#9e9e9e` + `#c4c4c4` |
| HUD (píldoras) | blanco `rgba(255,255,255,0.88)` + texto `#205c2a` |

## 3. Personaje

- Cuerpo redondo 16×16 con sombreado por clip (brillo arriba-izquierda,
  sombra abajo) y contorno `#200c0c`.
- Ojos: dos óvalos blancos grandes que casi se tocan en el centro; párpado
  rojo que cubre la mitad superior (recortado en la forma del ojo); pupilas
  negras grandes siguiendo el movimiento.
- Parpadeo cada ~3.5 s; squash & stretch al saltar/aterrizar.
- Boca sonrisa pequeña.

## 4. Escenario

- **Islas/suelo:** pasto tipo "pastel gigante" con lomos redondeados arriba y
  esquinas inferiores curvas; tierra oscura con bultos.
- **Fondo:** cielo + sol + colinas en 2 capas de parallax (0.3×/0.5×) + nubes
  de bolitas (0.22×, deriva lenta).
- **Decoración:** cactus con brazos redondeados, piedras grises brillantes,
  flores de 5 pétalos con tallo largo.
- **Agua:** fosa con esquinas inferiores redondeadas, olas animadas y brillos.
- **Pinchos:** triángulos negros con brillo (el único elemento punzante).
- **Enemigos:** bolas oscuras con 8 púas y cara enojada, patrullen.
- **Checkpoints:** asta + banderín (dorado al activar).
- **Meta:** asta negra, bola dorada y bandera roja ondeando con estrella.

## 5. HUD (píldoras redondeadas)

- Píldora de corazón  **❤ ❤ ❤** (vidas, gris las gastadas).
- Píldora de anillo dorado + `n/total`.
- Píldora `SCORE 00000`.
- Píldora `LV n`.
- Título y pantallas de fin redondeadas (píldoras para score/continue).

## 6. Niveles

3 niveles (GREEN HILLS, SKY PEAKS, DANGER ZONE), checkpoints a mitad,
cactus/piedras repartidos y dificultad creciente.

## 7. Controles

- Teclado: ← → mover, ESPACIO saltar, X impulso.
- Táctil: ◀ ▶ JUMP.

## 8. Empaquetado (Docker / Node.js)

- `server.js` — servidor estático `http` nativo, `PORT` configurable.
- `Dockerfile` — `node:22-alpine`, expone 3000.
- `.dockerignore` — `.git`, `node_modules`, `*.md`.

## 9. Próximos pasos

1. Spritesheets PNG en `Assets/`.
2. Más decoraciones (setas, troncos, arbustos redondos).
3. Audio chiptune.
4. Progreso en localStorage.