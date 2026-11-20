import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * almacenJson.js — persistencia en UN archivo JSON, sin dependencias.
 *
 * ¿Por qué JSON y no una base de datos? Porque el proyecto guarda récords de un
 * juego de 5 niveles: un fichero pequeño, legible y copiable es más que
 * suficiente, y no obliga a instalar ni administrar nada.
 *
 * Tres detalles que sí importan y están resueltos aquí:
 *
 *  1. ESCRITURA ATÓMICA: se escribe `<archivo>.tmp` y luego se renombra. Un
 *     corte de luz a mitad nunca deja el JSON truncado (el archivo viejo sigue
 *     entero hasta el `rename`, que es atómico en el mismo volumen).
 *  2. UNA SOLA ESCRITURA A LA VEZ: `exclusiva()` encadena las tareas en una
 *     promesa, así dos POST simultáneos no se pisan (leer-modificar-escribir).
 *  3. LECTURA TOLERANTE: si el archivo no existe se devuelve `null`; si está
 *     corrupto se avisa por consola y se empieza de cero. El juego nunca cae
 *     porque el disco tenga basura.
 *
 * La interfaz es la misma que la de `almacenMemoria.js` (leer / guardar /
 * actualizar), así el resto del backend no sabe dónde vive el dato y las
 * pruebas pueden usar memoria.
 */
export function crearAlmacenJson({ carpeta, archivo = 'redball.json', registro = null } = {}) {
  if (!carpeta) throw new Error('crearAlmacenJson necesita una carpeta de datos.');

  const ruta = path.join(carpeta, archivo);
  const rutaTemporal = `${ruta}.tmp`;

  /** Última copia leída: evita releer el disco en cada petición. */
  let cache = null;
  /** Cadena de promesas que serializa el acceso al archivo. */
  let bloqueo = Promise.resolve();

  function exclusiva(tarea) {
    const resultado = bloqueo.then(() => tarea());
    bloqueo = resultado.then(
      () => undefined,
      () => undefined
    );
    return resultado;
  }

  async function cargar() {
    try {
      const crudo = await fs.readFile(ruta, 'utf8');
      cache = JSON.parse(crudo);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        registro?.warn?.(`[almacen] no se pudo leer ${ruta} (${error.message}). Se empieza de cero.`);
      }
      cache = null;
    }
    return cache;
  }

  async function escribir(datos) {
    await fs.mkdir(carpeta, { recursive: true });
    await fs.writeFile(rutaTemporal, JSON.stringify(datos, null, 2), 'utf8');
    await fs.rename(rutaTemporal, ruta);
  }

  return {
    tipo: 'json',
    ruta,

    /** Datos guardados, o null si todavía no hay archivo. */
    leer: () => exclusiva(async () => (await cargar()) ?? null),

    /** Sobrescribe el archivo. */
    guardar: (datos) =>
      exclusiva(async () => {
        cache = structuredClone(datos);
        await escribir(cache);
        return structuredClone(cache);
      }),

    /**
     * Lee, deja mutar y guarda, todo dentro del mismo turno exclusivo.
     * El mutador recibe una copia: si lanza, el archivo no se toca.
     */
    actualizar: (mutador) =>
      exclusiva(async () => {
        const actuales = (await cargar()) ?? null;
        const nuevos = await mutador(actuales === null ? null : structuredClone(actuales));
        if (nuevos === undefined || nuevos === null) return actuales;
        cache = nuevos;
        await escribir(nuevos);
        return nuevos;
      })
  };
}
