/**
 * contexto-falso.js — doble de `CanvasRenderingContext2D` para pruebas.
 * Registra cada orden de dibujo, así se puede comprobar QUE se dibuja algo sin
 * tener un navegador. No es un archivo de pruebas: no lleva `.test.js`.
 */
export function contextoFalso() {
  const llamadas = [];
  const registrar = (nombre) => (...args) => llamadas.push([nombre, ...args]);

  return {
    llamadas,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: registrar('fillRect'),
    strokeRect: registrar('strokeRect'),
    clearRect: registrar('clearRect'),
    beginPath: registrar('beginPath'),
    closePath: registrar('closePath'),
    moveTo: registrar('moveTo'),
    lineTo: registrar('lineTo'),
    arc: registrar('arc'),
    ellipse: registrar('ellipse'),
    fill: registrar('fill'),
    stroke: registrar('stroke'),
    fillText: registrar('fillText'),
    save: registrar('save'),
    restore: registrar('restore'),
    translate: registrar('translate'),
    scale: registrar('scale')
  };
}
