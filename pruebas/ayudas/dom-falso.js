/**
 * dom-falso.js — doble mínimo de `document` para probar la interfaz.
 *
 * Implementa SOLO lo que usa `src/interfaz/Interfaz.js` (getElementById,
 * createElement, textContent, classList, dataset, style, hidden/disabled,
 * setAttribute, appendChild/replaceChildren y addEventListener). Cada elemento
 * puede "pulsarse" con `disparar('click')`, así las pruebas comprueban el
 * cableado de los botones sin navegador. No es un archivo de pruebas: no lleva
 * `.test.js`.
 */
export function domFalso({ ids = [] } = {}) {
  const elementos = new Map();

  function crearElemento(etiqueta = 'div') {
    const elemento = {
      etiqueta,
      id: '',
      textContent: '',
      hidden: false,
      disabled: false,
      type: '',
      dataset: {},
      style: {},
      hijos: [],
      oyentes: new Map(),
      clases: new Set(),
      atributos: new Map()
    };

    elemento.classList = {
      add: (...valores) => valores.forEach((valor) => elemento.clases.add(valor)),
      remove: (...valores) => valores.forEach((valor) => elemento.clases.delete(valor)),
      contains: (valor) => elemento.clases.has(valor),
      toggle: (valor, activo) => {
        const poner = activo ?? !elemento.clases.has(valor);
        if (poner) elemento.clases.add(valor);
        else elemento.clases.delete(valor);
        return poner;
      }
    };

    Object.defineProperty(elemento, 'className', {
      get: () => [...elemento.clases].join(' '),
      set: (valor) => {
        elemento.clases.clear();
        String(valor)
          .split(/\s+/)
          .filter(Boolean)
          .forEach((clase) => elemento.clases.add(clase));
      }
    });

    elemento.appendChild = (hijo) => {
      elemento.hijos.push(hijo);
      return hijo;
    };
    elemento.replaceChildren = (...nuevos) => {
      elemento.hijos = [...nuevos];
    };
    elemento.setAttribute = (nombre, valor) => elemento.atributos.set(nombre, String(valor));
    elemento.getAttribute = (nombre) =>
      elemento.atributos.has(nombre) ? elemento.atributos.get(nombre) : null;
    elemento.removeAttribute = (nombre) => elemento.atributos.delete(nombre);
    elemento.addEventListener = (tipo, fn) => {
      if (!elemento.oyentes.has(tipo)) elemento.oyentes.set(tipo, new Set());
      elemento.oyentes.get(tipo).add(fn);
    };
    elemento.removeEventListener = (tipo, fn) => elemento.oyentes.get(tipo)?.delete(fn);
    elemento.disparar = (tipo, evento = {}) => {
      for (const fn of [...(elemento.oyentes.get(tipo) ?? [])]) {
        fn({ target: elemento, preventDefault() {}, ...evento });
      }
      return elemento;
    };
    /** Textos de los hijos directos (para comprobar tarjetas). */
    elemento.textos = () => elemento.hijos.map((hijo) => hijo.textContent).filter(Boolean);

    return elemento;
  }

  for (const id of ids) {
    const elemento = crearElemento('div');
    elemento.id = id;
    elementos.set(id, elemento);
  }

  const documento = {
    getElementById: (id) => elementos.get(id) ?? null,
    createElement: (etiqueta) => crearElemento(etiqueta),
    querySelectorAll: () => []
  };

  return {
    documento,
    elementos,
    elemento: (id) => elementos.get(id) ?? null,
    crear: crearElemento
  };
}
