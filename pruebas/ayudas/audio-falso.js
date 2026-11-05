/**
 * audio-falso.js — doble de `AudioContext` para pruebas.
 *
 * Guarda cada oscilador, cada envolvente y cada conexión, para poder comprobar
 * QUÉ se programó (notas, tiempos, volumen) sin tarjeta de sonido ni navegador.
 * No es un archivo de pruebas: no lleva `.test.js`.
 */
export function audioFalso() {
  const osciladores = [];
  const ganancias = [];

  const contexto = {
    state: 'running',
    currentTime: 0,
    destination: { nombre: 'salida' },
    osciladores,
    ganancias,
    reanudado: 0,

    createOscillator() {
      const oscilador = {
        type: 'sine',
        /** [[frecuencia, instante], …] */
        notas: [],
        arrancado: null,
        parado: null,
        conectado: null,
        frequency: {
          setValueAtTime(valor, cuando) {
            oscilador.notas.push([valor, cuando]);
          }
        },
        connect(destino) {
          oscilador.conectado = destino;
          return destino;
        },
        start(cuando) {
          oscilador.arrancado = cuando;
        },
        stop(cuando) {
          oscilador.parado = cuando;
        }
      };
      osciladores.push(oscilador);
      return oscilador;
    },

    createGain() {
      const ganancia = {
        /** [['ataque'|'caida'|'inicio', valor, instante], …] */
        envolvente: [],
        conectado: null,
        gain: {
          setValueAtTime(valor, cuando) {
            ganancia.envolvente.push(['inicio', valor, cuando]);
          },
          linearRampToValueAtTime(valor, cuando) {
            ganancia.envolvente.push(['ataque', valor, cuando]);
          },
          exponentialRampToValueAtTime(valor, cuando) {
            ganancia.envolvente.push(['caida', valor, cuando]);
          }
        },
        connect(destino) {
          ganancia.conectado = destino;
          return destino;
        }
      };
      ganancias.push(ganancia);
      return ganancia;
    },

    resume() {
      contexto.reanudado += 1;
    }
  };

  return contexto;
}
