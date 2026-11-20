/**
 * paleta.js — ÚNICA fuente de colores del juego.
 * Migrada 1:1 desde Js/Interfaz.js (const BT = {...}) sin cambiar un solo valor,
 * para que la Fase 4 pueda reproducir los niveles pixel a pixel.
 * Regla: ninguna constante de color puede escribirse fuera de este archivo.
 */

export const PALETA = Object.freeze({
  // Cielo y sol
  CIELO: '#1b9ce6',
  CIELO_CLARO: '#7ec6f3',
  SOL_A: '#ffe066',
  SOL_B: '#ffb62e',

  // Colinas y terreno
  COLINA_LEJANA: '#4cbd45',
  COLINA_CERCANA: '#2f9e2f',
  PASTO_ALTO: '#8ee04a',
  PASTO: '#3ecb3e',
  TIERRA: '#2f6b35',
  TIERRA_GRUMO: '#256b2c',

  // Protagonista
  BOLA: '#d8281f',
  BOLA_CLARA: '#ff7a6b',
  BOLA_OSCURA: '#931b14',
  BOLA_CONTORNO: '#200c0c',

  // Neutros
  BLANCO: '#ffffff',
  NEGRO: '#1a1a1a',

  // Coleccionables / interfaz
  ORO: '#f6b40b',
  ORO_CLARO: '#ffe082',
  ROJO: '#e02a20',

  // Agua
  AGUA: '#2f9df2',
  AGUA_CLARA: '#8fd6fb',
  AGUA_OSCURA: '#1f7fc4',

  // Enemigos
  ENEMIGO: '#2b3038',
  GRIS_APAGADO: '#9e9e9e',

  // Vegetación
  FLOR_ROSA: '#e64a5a',
  FLOR_ROSA_OSCURA: '#c22f42',
  FLOR_CENTRO: '#ffd83d',
  TALLOS: '#43d43f',
  CACTUS: '#2fa33b',
  CACTUS_CLARO: '#6ee668',

  // Sólidos
  PIEDRA: '#9e9e9e',
  PIEDRA_CLARA: '#c4c4c4',

  // Texto y detalles que estaban dispersos en Interfaz.js
  TEXTO_OSCURO: '#205c2a',
  TEXTO_AZUL: '#083b66',
  ENLACE_AZUL: '#1461c0',
  NIVELES_VERDE: '#143d18',
  PIEDRA_HIELO: '#c9d7e2',
  ORO_CONTORNO: '#c99a00',
  CORAZON: '#ff3232',

  // Objetos del mundo (Fase 3)
  METAL: '#5a6473',
  METAL_CLARO: '#98a4b5',
  ELASTICO: '#e04ec0',
  ELASTICO_CLARO: '#ff9ee8',
  FANTASMA: '#8e7fd6',
  FANTASMA_CLARA: '#c9c0f2',
  PINCHO: '#b6c0cc',
  PINCHO_OSCURO: '#6d7885',
  BANDERA: '#f2f2f2',
  BANDERA_ACTIVA: '#3ddc84',
  META: '#ffde3d',
  META_CLARA: '#fff6b8',
  META_APAGADA: '#c9b04a',
  AVISO: '#ff9f1c',
  PELIGRO_SUAVE: '#ff6b6b'
});
