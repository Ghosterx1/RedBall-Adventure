# Información RedBall-Adventure

**RedBall-Adventure** es un juego de plataformas 2D en pixel art inspirado en los
clásicos de Nokia. Manejas una bola roja que tiene que cruzar **cinco niveles**
esquivando pinchos, agua y enemigos, recogiendo monedas y llegando a la meta.
Se juega en el navegador, sin instalar nada en el móvil ni en el ordenador, y
guarda tu récord y los rankings en línea.

El proyecto es un **monorepo** con dos partes que corren en el mismo proceso:

- `frontend/` — el juego (HTML + CSS + JavaScript, dibujado en un `<canvas>`).
- `backend/` — la API de récords en Express, que además sirve el juego.

---

## Qué incluye el juego

- **5 niveles** con dificultad progresiva y desbloqueo uno tras otro.
- **Objetivos por nivel**: a veces basta llegar a la meta, otras hay que
  llegar con un mínimo de monedas (`meta + 6 monedas`).
- **Mecánicas**: plataformas, rampas, trampolines, plataformas móviles y
  efímeras, checkpoints, pinchos y agua.
- **3 vidas** por partida, contador de monedas, puntuación y récord por nivel.
- **Récords en línea**: ranking global y por nivel (puntos y nombre, si lo pones).
- **Controles táctiles** y diseño responsive: se juega igual en el celular
  (vertical u horizontal) y el lienzo se ajusta a la pantalla.
- Pausa, pantalla de victoria, de derrota y selección de niveles.

### Controles

| Acción | Teclas |
|---|---|
| Moverse | Flechas izquierda/derecha o `A` / `D` |
| Saltar (mantener = más alto) | `Espacio`, `W` o flecha arriba |
| Impulso | `X` o `Shift` |
| Reiniciar nivel | `R` |
| Pausa | `P` o `Escape` |
| Confirmar en los menús | `Intro` o `Espacio` |

---

## Requisitos previos

| Herramienta | Versión | Obligatorio |
|---|---|---|
| [Node.js](https://nodejs.org) | 20.11 o superior (probado en 22) | Sí |
| npm | el que viene con Node | Sí |
| Git | cualquiera reciente | Sí (para clonar) |
| Docker | opcional | No (solo si quieres el contenedor) |

Comprobar la versión instalada:

```bash
node --version   # debe ser v20.11.0 o mayor
npm --version
```

---

## Cómo clonarlo y ejecutarlo

```bash
# 1. Clonar el repositorio
git clone https://github.com/Ghosterx1/RedBall-Adventure.git

# 2. Entrar en la carpeta
cd RedBall-Adventure

# 3. Instalar dependencias (solo descarga express)
npm install

# 4. Arrancar el juego y la API
npm start
```

Después abre **<http://localhost:3000>** en el navegador. Ese mismo servidor
sirve el juego y la API (`/api`), así que no hay que configurar nada.

> Importante: no abras `frontend/index.html` con doble clic. El juego usa
> módulos de JavaScript modernos y necesita servirse por HTTP.

### Otros comandos útiles

```bash
npm run dev      # igual que npm start, pero se reinicia al guardar cambios
npm test         # ejecuta todas las pruebas
```

### Con Docker (opcional)

```bash
docker compose up --build     # luego http://localhost:3000
```

Los récords se guardan en un volumen, así que no se pierden al reiniciar.

---

## Dependencias

El proyecto se hizo con la idea de **depender de lo mínimo**:

| Dependencia | Versión | Para qué |
|---|---|---|
| [`express`](https://expressjs.com) | `^5.1.0` | Servidor HTTP de la API y de los archivos del juego |

- **No hay dependencias de desarrollo**: las pruebas usan el runner que ya
  incluye Node (`node --test`), sin Jest, Mocha ni similares.
- **No hay empaquetador**: el navegador carga los archivos `.js` directamente
  (ES Modules), así que no hace falta Webpack, Vite ni Babel.
- Para los datos no hay base de datos: la API guarda todo en un archivo JSON
  (`backend/datos/redball.json`) que se crea solo la primera vez.

---

## Tecnologías utilizadas

| Tecnología | Dónde se usa |
|---|---|
| **HTML5** | Estructura del HUD, menús y pantallas (`frontend/index.html`) |
| **CSS3** | Estética pixel art, layout responsive y botones táctiles (`frontend/Css/`) |
| **JavaScript (ES Modules)** | Toda la lógica del juego: física, colisiones, cámara, escenas |
| **Canvas 2D** | Dibujo del juego (pixel art sin imágenes externas) |
| **Web Audio API** | Efectos de sonido (`AudioContext`) |
| **`localStorage`** | Récord y progreso guardados en el navegador |
| **Node.js** | Ejecuta el servidor y las pruebas |
| **Express 5** | API REST de récords, perfiles y catálogo de niveles |
| **`node --test`** | Pruebas automáticas (420 pruebas, sin dependencias) |
| **Archivo JSON** | Persistencia de los récords (sin base de datos) |
| **Docker + Docker Compose** | Despliegue en un contenedor |
| **Git / GitHub** | Control de versiones y publicación |

---

## Estructura del proyecto

```text
RedBall-Adventure/
├── frontend/            el juego (lo que ve el navegador)
│   ├── index.html       entrada: HUD y pantallas
│   ├── src/             código del juego (núcleo, escenas, física, mundo…)
│   ├── Css/             estilos
│   └── pruebas/         pruebas del juego
├── backend/             API de récords (Express)
│   ├── src/             servidor, rutas, servicios, almacenes, middlewares
│   ├── pruebas/         pruebas de la API
│   └── datos/           redball.json (se crea solo; no se versiona)
├── docs/                documentación técnica
├── Dockerfile
└── package.json         scripts del monorepo
```

---

## Pruebas

```bash
npm test              # 420 pruebas (frontend + backend)
npm run test:frontend # solo el juego (323)
npm run test:backend  # solo la API (97)
```

Entre las pruebas del juego hay un **bot** que juega los cinco niveles de
principio a fin: si un salto deja de ser posible o falta una moneda para
cumplir el objetivo, la prueba falla y dice en qué nivel fue.

---

## API de récords (resumen)

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/api/salud` | Comprobar que el servidor está vivo |
| `GET` | `/api/niveles` | Catálogo de niveles |
| `GET` | `/api/records` | Ranking global o por nivel (`?nivel=nivel-3`) |
| `POST` | `/api/records` | Enviar una partida terminada |
| `GET` | `/api/perfiles/:id` | Progreso guardado de un jugador |
| `PUT` | `/api/perfiles/:id/progreso` | Sincronizar el progreso del navegador |

Prueba rápida con el servidor encendido: <http://localhost:3000/api/salud>

---

## Documentación

- Guía extendida (niveles, mecánicas, interfaz, cómo añadir un nivel):
  [`docs/GUIA-COMPLETA.md`](docs/GUIA-COMPLETA.md)
- API, almacenamiento y despliegue: [`docs/BACKEND.md`](docs/BACKEND.md)
- Arquitectura y convenciones: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
- Física del juego: [`docs/FISICA.md`](docs/FISICA.md)
- Objetos y mecánicas de los niveles: [`docs/MUNDO.md`](docs/MUNDO.md)
- Interfaz y estilo visual: [`docs/INTERFAZ.md`](docs/INTERFAZ.md)

---

## Autor y licencia

Proyecto de **Ghosterx1** — <https://github.com/Ghosterx1/RedBall-Adventure>

Distribuido bajo licencia **ISC**. Puedes usarlo, modificarlo y compartirlo
libremente citando la autoría.
