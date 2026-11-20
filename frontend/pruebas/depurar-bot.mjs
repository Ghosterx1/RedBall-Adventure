import { jugarNivel } from './ayudas/bot.js';
import { NIVELES } from '../src/mundo/niveles/index.js';

const id = process.argv[2] ?? 'nivel-2';
const desde = Number(process.argv[3] ?? 0);
const hasta = Number(process.argv[4] ?? 99999);
const datos = NIVELES.find((n) => n.id === id) ?? NIVELES[1];

const r = jugarNivel(datos, {
  maxSegundos: 30,
  onPaso: (i, escena) => {
    const j = escena.jugador;
    if (i % 4 === 0 && j.x >= desde && j.x <= hasta) {
      console.log(
        i,
        'x', j.x.toFixed(1),
        'y', j.y.toFixed(1),
        'vx', j.vx.toFixed(0),
        'suelo', j.enSuelo,
        'reini', escena.reinicios
      );
    }
  }
});

console.log('FIN completo', r.completo, 'x', r.x, 'monedas', r.monedas, 'reini', r.reinicios);
