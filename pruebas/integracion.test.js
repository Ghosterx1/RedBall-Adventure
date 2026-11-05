import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Pruebas de integración estáticas: Node no puede ejecutar main.js (toca el DOM),
 * así que aquí se verifica el cableado HTML ↔ módulos ↔ servidor.
 */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (relativo) => readFileSync(path.join(RAIZ, relativo), 'utf8');

/**
 * Comprueba que una ruta existe RESPETANDO mayúsculas y minúsculas.
 * En Windows `existsSync` ignora el caso, así que `./css/x.css` apuntando en
 * realidad a `Css/x.css` pasaría la comprobación pero rompería en Linux (Docker).
 * Este proyecto se sirve desde Docker, así que el caso es parte del contrato.
 */
function existeConCasoExacto(relativo) {
  const partes = relativo.split('/').filter((parte) => parte && parte !== '.');
  let actual = RAIZ;
  for (const parte of partes) {
    let entradas;
    try {
      entradas = readdirSync(actual);
    } catch {
      return false;
    }
    if (!entradas.includes(parte)) return false;
    actual = path.join(actual, parte);
  }
  return true;
}

test('index.html carga main.js como módulo y declara los controles', () => {
  const html = leer('index.html');

  assert.match(html, /<script type="module" src="\.\/src\/main\.js"><\/script>/);
  assert.match(html, /id="juego"/, 'main.js busca el canvas por id="juego"');
  assert.match(html, /id="aviso"/, 'main.js escribe los avisos en #aviso');

  for (const accion of ['izquierda', 'derecha', 'salto', 'impulso']) {
    assert.match(html, new RegExp(`data-accion="${accion}"`), `falta el botón "${accion}"`);
  }
});

test('todos los recursos relativos de index.html existen con el caso exacto', () => {
  const html = leer('index.html');
  const rutas = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map((m) => m[1]);

  assert.ok(rutas.includes('src/main.js'));
  assert.ok(rutas.length >= 3, `solo se referencian ${rutas.length} recursos`);
  for (const ruta of rutas) {
    assert.ok(
      existeConCasoExacto(ruta),
      `no existe el recurso referenciado con ese caso exacto: ${ruta}`
    );
  }
});

test('todo el grafo de importaciones de src/ resuelve a archivos reales', () => {
  const pendientes = [path.join(RAIZ, 'src', 'main.js')];
  const visitados = new Set();

  while (pendientes.length > 0) {
    const archivo = pendientes.pop();
    if (visitados.has(archivo)) continue;
    visitados.add(archivo);

    const codigo = readFileSync(archivo, 'utf8');
    for (const coincidencia of codigo.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const destino = path.resolve(path.dirname(archivo), coincidencia[1]);
      const relativa = path.relative(RAIZ, destino).split(path.sep).join('/');
      assert.ok(
        existeConCasoExacto(relativa),
        `import roto o con caso incorrecto en ${path.basename(archivo)}: ${coincidencia[1]}`
      );
      pendientes.push(destino);
    }
  }

  assert.ok(visitados.size >= 8, `solo se alcanzaron ${visitados.size} módulos desde main.js`);
});

test('las capas inferiores no importan capas superiores', () => {
  const prohibido = {
    'src/config': ['nucleo', 'escenas', 'entidades', 'mundo', 'render', 'fisica'],
    'src/fisica': ['escenas', 'entidades', 'render', 'mundo'],
    'src/nucleo': ['escenas', 'entidades', 'mundo', 'render'],
    'src/entidades': ['escenas', 'render'],
    'src/mundo': ['escenas', 'entidades', 'render', 'nucleo'],
    'src/render': ['escenas', 'entidades', 'mundo', 'nucleo']
  };

  for (const [capa, vetadas] of Object.entries(prohibido)) {
    const carpeta = path.join(RAIZ, capa);
    if (!existsSync(carpeta)) continue;

    // Se revisan TODOS los módulos de la capa, no una lista cerrada: al añadir
    // archivos nuevos la regla de dependencias debe seguir aplicándose sola.
    for (const archivo of readdirSync(carpeta).filter((nombre) => nombre.endsWith('.js'))) {
      const codigo = readFileSync(path.join(carpeta, archivo), 'utf8');

      for (const coincidencia of codigo.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        for (const capaVetada of vetadas) {
          assert.ok(
            !coincidencia[1].includes(`/${capaVetada}/`),
            `${capa}/${archivo} no puede importar ${coincidencia[1]}`
          );
        }
      }
    }
  }
});

test('el servidor sirve el juego nuevo en la raíz y conserva el prototipo en legacy/', () => {
  const servidor = leer('server.js');

  assert.match(servidor, /const RUTA_INICIO = '\/index\.html'/);
  assert.doesNotMatch(servidor, /\brequire\(/, 'server.js ya es ESM');
  assert.ok(existsSync(path.join(RAIZ, 'legacy', 'redball-touch.html')));
  assert.ok(existsSync(path.join(RAIZ, 'Index', 'Index.html')), 'el prototipo debe seguir jugable');
});

test('main.js es el controlador de flujo: menú, niveles, juego y finales', () => {
  const main = leer('src/main.js');

  assert.match(main, /from '\.\/escenas\/EscenaMundo\.js'/);
  assert.match(main, /from '\.\/interfaz\/Interfaz\.js'/);
  assert.match(main, /from '\.\/nucleo\/Partida\.js'/);
  assert.match(main, /from '\.\/nucleo\/Vidas\.js'/);

  // El nivel que toca jugar sale de la progresión (o del ?nivel= de la URL).
  assert.match(main, /nivelInicial\(progreso, ids\)/);
  assert.match(main, /new EscenaMundo\(\{/);
  assert.match(main, /autoAvanzar: false/, 'con interfaz, el paso de nivel lo decide la victoria');
  assert.doesNotMatch(main, /cambiarEscena\(new EscenaPrueba\(\)\)/);

  // Los eventos del nivel llegan al flujo por el bus, no por variables globales.
  for (const evento of ['nivel:completado', 'partida:derrota']) {
    assert.ok(main.includes(`bus.on('${evento}'`), `main.js no escucha "${evento}"`);
  }
});

test('cada id que usa la interfaz existe en index.html', async () => {
  const { BOTONES_INTERFAZ, IDS_INTERFAZ, PANTALLAS_INTERFAZ } = await import(
    '../src/interfaz/Interfaz.js'
  );
  const html = leer('index.html');

  const ids = [
    ...Object.values(IDS_INTERFAZ),
    ...Object.values(PANTALLAS_INTERFAZ),
    ...Object.keys(BOTONES_INTERFAZ)
  ];
  assert.ok(ids.length >= 20, `solo se declaran ${ids.length} ids de interfaz`);

  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`), `falta id="${id}" en index.html`);
  }
});

test('index.html carga las dos hojas de estilo de la interfaz', () => {
  const html = leer('index.html');

  assert.match(html, /href="\.\/Css\/layout\.css"/);
  assert.match(html, /href="\.\/Css\/ui\.css"/);
  assert.match(html, /class="hud"/, 'el HUD del DOM debe existir en el HTML');
  assert.match(html, /id="pantallas"/, 'las pantallas se superponen al lienzo');
});

test('todo tipo de objeto de src/mundo/tipos/ está en el barril', () => {
  const carpeta = path.join(RAIZ, 'src', 'mundo', 'tipos');
  const archivos = readdirSync(carpeta).filter((nombre) => nombre.endsWith('.js'));
  const barril = leer('src/mundo/tipos.js');

  assert.ok(archivos.length >= 10, `solo hay ${archivos.length} tipos`);
  for (const archivo of archivos) {
    const nombre = archivo.replace('.js', '');
    assert.match(
      barril,
      new RegExp(`from '\\./tipos/${nombre}\\.js'`),
      `${archivo} no está importado en src/mundo/tipos.js (¿no se registrará?)`
    );
  }
});
