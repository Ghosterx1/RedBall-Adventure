/**
 * almacen-falso.js — dobles de `localStorage` para pruebas.
 *
 * `almacenFalso` imita la API real guardando en memoria; `almacenRoto` lanza en
 * cada operación, como un navegador en modo privado con la cuota llena. Sirven
 * para probar la persistencia sin tocar el disco.
 */
export function almacenFalso({ inicial = null } = {}) {
  const datos = new Map();
  if (inicial) {
    for (const [clave, valor] of Object.entries(inicial)) datos.set(clave, valor);
  }

  return {
    datos,
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => {
      datos.set(clave, String(valor));
    },
    removeItem: (clave) => {
      datos.delete(clave);
    },
    clear: () => datos.clear()
  };
}

/** Almacén que siempre falla (Safari privado, cuota llena, cookies bloqueadas). */
export function almacenRoto() {
  return {
    getItem() {
      throw new Error('almacén bloqueado');
    },
    setItem() {
      throw new Error('cuota llena');
    }
  };
}
