import { PALETA } from '../config/paleta.js';

/**
 * pelota.js — dibujo del protagonista. Recibe cualquier "cuerpo" con x, y,
 * ancho, alto y `mirando`: así la usan la escena real y el banco de pruebas sin
 * duplicar píxeles. No conoce la clase Jugador ni el estado del juego.
 */
export function dibujarPelota(ctx, cuerpo) {
  const cx = cuerpo.x + cuerpo.ancho / 2;
  const cy = cuerpo.y + cuerpo.alto / 2;
  const radio = Math.min(cuerpo.ancho, cuerpo.alto) / 2;

  ctx.fillStyle = PALETA.BOLA;
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.fill();

  // Brillo arriba a la izquierda: da volumen sin degradados (pixel art).
  ctx.fillStyle = PALETA.BOLA_CLARA;
  ctx.beginPath();
  ctx.arc(cx - radio * 0.35, cy - radio * 0.35, radio * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETA.BOLA_CONTORNO;
  ctx.beginPath();
  ctx.arc(cx, cy, radio - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Ojos: miran hacia donde se mueve.
  const mirando = cuerpo.mirando ?? 1;
  ctx.fillStyle = PALETA.BLANCO;
  ctx.beginPath();
  ctx.arc(cx - 3 + mirando, cy - 3, 3.2, 0, Math.PI * 2);
  ctx.arc(cx + 4 + mirando, cy - 3, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PALETA.NEGRO;
  ctx.beginPath();
  ctx.arc(cx - 2.4 + mirando * 1.6, cy - 3, 1.4, 0, Math.PI * 2);
  ctx.arc(cx + 4.6 + mirando * 1.6, cy - 3, 1.4, 0, Math.PI * 2);
  ctx.fill();
}
