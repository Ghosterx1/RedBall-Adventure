/**
 * tipos.js — barril de tipos de objeto.
 *
 * Importar este módulo REGISTRA todos los tipos (cada archivo de tipos/ llama a
 * registrarTipo al cargarse). Por eso Mundo importa de aquí y no de registro.js:
 * así el catálogo siempre está completo.
 *
 * Añadir un objeto nuevo:
 *   1. crear src/mundo/tipos/MiObjeto.js (con `static tipo` y registrarTipo)
 *   2. añadir una línea de import y otra de export aquí
 *   Nada más: ni el motor, ni la física, ni las escenas cambian.
 */

import './tipos/Plataforma.js';
import './tipos/PlataformaElevada.js';
import './tipos/Rampa.js';
import './tipos/Elastica.js';
import './tipos/Movil.js';
import './tipos/Efimera.js';
import './tipos/Obstaculo.js';
import './tipos/ObstaculoMovil.js';
import './tipos/Peligro.js';
import './tipos/Checkpoint.js';
import './tipos/Moneda.js';
import './tipos/Meta.js';

export { Objeto } from './Objeto.js';
export { Plataforma, COLOR_SUPERFICIE } from './tipos/Plataforma.js';
export { PlataformaElevada } from './tipos/PlataformaElevada.js';
export { Rampa } from './tipos/Rampa.js';
export { Elastica } from './tipos/Elastica.js';
export { Movil } from './tipos/Movil.js';
export { Efimera } from './tipos/Efimera.js';
export { Obstaculo } from './tipos/Obstaculo.js';
export { ObstaculoMovil } from './tipos/ObstaculoMovil.js';
export { Peligro } from './tipos/Peligro.js';
export { Checkpoint } from './tipos/Checkpoint.js';
export { Moneda } from './tipos/Moneda.js';
export { Meta } from './tipos/Meta.js';
export { crearObjeto, registrarTipo, tiposRegistrados, hayTipo } from './registro.js';
