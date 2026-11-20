import { Router } from 'express';

import { ErrorHttp } from '../errores.js';
import { NIVELES, catalogoNiveles } from '../dominio.js';
import { leerEntero, leerJugador, leerNivel, leerObjeto, leerPartida, leerTexto } from '../validar.js';
import { normalizarBase } from '../almacen/esquema.js';
import {
  anotarPartida,
  buscarJugador,
  guardarProgreso,
  perfilPublico,
  ranking
} from '../servicios/records.js';

/**
 * rutas/api.js — el contrato HTTP. Seis endpoints, todos en JSON:
 *
 *   GET  /api/salud                    estado del servicio
 *   GET  /api/niveles                 catálogo (ids, nombres, dificultad)
 *   GET  /api/records                 ranking global o por nivel
 *   POST /api/records                 anotar una partida terminada
 *   GET  /api/perfiles/:id            progreso guardado de un jugador
 *   PUT  /api/perfiles/:id/progreso   sincronizar el progreso del navegador
 *
 * Las rutas NO saben de disco ni de validación fina: piden los datos ya
 * validados (`../validar.js`) y delegan en los servicios. Express 5 reenvía
 * solo cualquier promesa rechazada al middleware de errores, así que aquí no
 * hace falta un try/catch por endpoint.
 */
export function crearApi({ config, almacen }) {
  const api = Router();
  const limiteRanking = config?.limiteRanking ?? 50;

  api.get('/salud', async (req, res) => {
    const base = normalizarBase(await almacen.leer());
    res.json({
      ok: true,
      servicio: 'redball-api',
      version: config?.versionApi ?? 1,
      entorno: config?.entorno ?? 'development',
      tiempoActivo: Math.round(process.uptime()),
      niveles: NIVELES.length,
      jugadores: Object.keys(base.jugadores).length
    });
  });

  api.get('/niveles', (req, res) => {
    const niveles = catalogoNiveles();
    res.json({ ok: true, version: config?.versionApi ?? 1, total: niveles.length, niveles });
  });

  api.get('/records', async (req, res) => {
    const nivel = req.query.nivel === undefined || req.query.nivel === '' ? null : leerNivel(req.query.nivel);
    const limite = leerEntero(req.query.limite, {
      campo: 'limite',
      maximo: limiteRanking,
      porDefecto: Math.min(10, limiteRanking)
    });

    const base = normalizarBase(await almacen.leer());
    const records = ranking(base, { nivel, limite });
    res.json({ ok: true, nivel, total: records.length, records });
  });

  api.post('/records', async (req, res) => {
    const id = leerJugador(req.body?.jugador);
    const nombre = leerTexto(req.body?.nombre, { campo: 'nombre', porDefecto: '' });
    const partida = leerPartida(req.body);

    const resultado = await anotarPartida({
      almacen,
      id,
      nombre,
      ...partida,
      limite: limiteRanking
    });

    // 201 si el jugador es nuevo; 200 si se ha actualizado uno existente.
    res.status(resultado.nuevo ? 201 : 200).json({ ok: true, ...resultado });
  });

  api.get('/perfiles/:id', async (req, res) => {
    const id = leerJugador(req.params.id);
    const base = normalizarBase(await almacen.leer());
    const jugador = buscarJugador(base, id);
    if (!jugador) {
      throw new ErrorHttp(404, 'JUGADOR_DESCONOCIDO', `No hay ningún perfil con el id "${id}".`);
    }
    res.json({ ok: true, perfil: perfilPublico(jugador) });
  });

  api.put('/perfiles/:id/progreso', async (req, res) => {
    const id = leerJugador(req.params.id);
    const nombre = leerTexto(req.body?.nombre, { campo: 'nombre', porDefecto: '' });
    const progreso = leerObjeto(req.body?.progreso, 'progreso');

    const resultado = await guardarProgreso({ almacen, id, nombre, progreso });
    res.status(resultado.nuevo ? 201 : 200).json({ ok: true, ...resultado });
  });

  return api;
}
