/**
 * almacenMemoria.js — mismo contrato que `almacenJson.js`, pero en RAM.
 *
 * Se usa en las pruebas del backend: no tocan el disco, no dejan archivos y
 * arrancan en un estado conocido. Los contadores `lecturas`/`escrituras`
 * permiten comprobar que una petición de solo lectura no escribe.
 */
export function crearAlmacenMemoria(datosIniciales = null) {
  let datos = datosIniciales === null ? null : structuredClone(datosIniciales);
  let lecturas = 0;
  let escrituras = 0;
  let bloqueo = Promise.resolve();

  function exclusiva(tarea) {
    const resultado = bloqueo.then(() => tarea());
    bloqueo = resultado.then(
      () => undefined,
      () => undefined
    );
    return resultado;
  }

  return {
    tipo: 'memoria',
    ruta: ':memoria:',

    get lecturas() {
      return lecturas;
    },
    get escrituras() {
      return escrituras;
    },

    leer: () =>
      exclusiva(async () => {
        lecturas += 1;
        return datos === null ? null : structuredClone(datos);
      }),

    guardar: (nuevos) =>
      exclusiva(async () => {
        escrituras += 1;
        datos = structuredClone(nuevos);
        return structuredClone(datos);
      }),

    actualizar: (mutador) =>
      exclusiva(async () => {
        escrituras += 1;
        const actuales = datos === null ? null : structuredClone(datos);
        const nuevos = await mutador(actuales);
        if (nuevos === undefined || nuevos === null) return actuales;
        datos = structuredClone(nuevos);
        return structuredClone(datos);
      })
  };
}
