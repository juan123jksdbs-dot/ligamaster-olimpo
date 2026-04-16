// controllers/organizadorController.js
// ─────────────────────────────────────────────────────────
// Controlador para el módulo Organizador
// Aquí se implementan todas las acciones de la liga
// para equipos, jugadores, árbitros, calendario y estadísticas.
// ─────────────────────────────────────────────────────────
const pool = require('../config/db');

class OrganizadorController {
  async getOrCreateTorneo(tenantId) {
    const resultado = await pool.query('SELECT id FROM torneos WHERE tenant_id = $1 LIMIT 1', [tenantId]);
    if (resultado.rows.length > 0) {
      return resultado.rows[0].id;
    }

    const creado = await pool.query(
      `INSERT INTO torneos (tenant_id, nombre, formato)
       VALUES ($1, 'Torneo Principal', 'Liga') RETURNING id`,
      [tenantId]
    );
    return creado.rows[0].id;
  }

  _buildRoundRobin(teams) {
    const lista = [...teams];
    if (lista.length % 2 === 1) {
      lista.push(null);
    }
    const rounds = [];
    const n = lista.length;

    for (let ronda = 0; ronda < n - 1; ronda += 1) {
      const pairings = [];
      for (let i = 0; i < n / 2; i += 1) {
        const local = lista[i];
        const visitante = lista[n - 1 - i];
        if (local !== null && visitante !== null) {
          pairings.push([local, visitante]);
        }
      }
      rounds.push(pairings);
      const last = lista.pop();
      lista.splice(1, 0, last);
    }

    return rounds;
  }

  async getPartidos(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const resultado = await pool.query(`
        SELECT
          p.id,
          p.fecha_hora,
          p.goles_local,
          p.goles_visitante,
          p.estatus,
          el.nombre AS equipo_local,
          ev.nombre AS equipo_visitante,
          COALESCE(a.nombre, 'Sin asignar') AS arbitro,
          j.numero AS jornada_numero,
          p.campo_id,
          c.nombre AS campo_nombre
        FROM partidos p
        JOIN equipos el ON p.equipo_local_id = el.id
        JOIN equipos ev ON p.equipo_visitante_id = ev.id
        LEFT JOIN arbitros a ON p.arbitro_id = a.id
        LEFT JOIN campos c ON p.campo_id = c.id
        JOIN jornadas j ON p.jornada_id = j.id
        WHERE p.tenant_id = $1
        ORDER BY p.fecha_hora ASC
      `, [tenantId]);

      res.json(resultado.rows);
    } catch (err) {
      console.error('Error obteniendo partidos:', err);
      res.status(500).json({ error: 'Error al obtener partidos' });
    }
  }

  async crearPartido(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const { jornada_id, equipo_local_id, equipo_visitante_id, arbitro_id, fecha_hora, campo_id } = req.body;

      if (!equipo_local_id || !equipo_visitante_id || !fecha_hora) {
        return res.status(400).json({ error: 'Equipo local, equipo visitante y fecha son obligatorios.' });
      }

      if (equipo_local_id === equipo_visitante_id) {
        return res.status(400).json({ error: 'Los equipos local y visitante deben ser diferentes.' });
      }

      const torneoId = await this.getOrCreateTorneo(tenantId);
      let jornadaId = jornada_id;

      if (!jornadaId) {
        jornadaId = await this._createOrGetJornada(tenantId, torneoId, 1);
      }

      const resultado = await pool.query(
        `INSERT INTO partidos (tenant_id, jornada_id, equipo_local_id, equipo_visitante_id, arbitro_id, fecha_hora, campo_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [tenantId, jornadaId, equipo_local_id, equipo_visitante_id, arbitro_id || null, fecha_hora, campo_id || null]
      );

      res.status(201).json({ mensaje: 'Partido registrado correctamente.', id: resultado.rows[0].id });
    } catch (err) {
      console.error('Error creando partido:', err);
      res.status(500).json({ error: 'Error al crear partido' });
    }
  }

  async actualizarPartido(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const partidoId = req.params.id;
      const { jornada_id, equipo_local_id, equipo_visitante_id, arbitro_id, fecha_hora, estatus, goles_local, goles_visitante, campo_id } = req.body;

      const resultado = await pool.query(
        `UPDATE partidos
         SET jornada_id = $1,
             equipo_local_id = $2,
             equipo_visitante_id = $3,
             arbitro_id = $4,
             fecha_hora = $5,
             estatus = $6,
             goles_local = $7,
             goles_visitante = $8,
             campo_id = $9
         WHERE id = $10 AND tenant_id = $11
         RETURNING id`,
        [jornada_id || null, equipo_local_id || null, equipo_visitante_id || null, arbitro_id || null,
         fecha_hora || null, estatus || 'Programado', goles_local || 0, goles_visitante || 0, campo_id || null, partidoId, tenantId]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Partido no encontrado.' });
      }

      res.json({ mensaje: 'Partido actualizado correctamente.' });
    } catch (err) {
      console.error('Error actualizando partido:', err);
      res.status(500).json({ error: 'Error al actualizar partido' });
    }
  }

  async eliminarPartido(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const partidoId = req.params.id;
      const resultado = await pool.query('DELETE FROM partidos WHERE id = $1 AND tenant_id = $2 RETURNING id', [partidoId, tenantId]);

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Partido no encontrado.' });
      }

      res.json({ mensaje: 'Partido eliminado correctamente.' });
    } catch (err) {
      console.error('Error eliminando partido:', err);
      res.status(500).json({ error: 'Error al eliminar partido' });
    }
  }

  async getJugadores(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const resultado = await pool.query(`
        SELECT
          j.id,
          j.nombre,
          j.numero_camiseta,
          j.posicion,
          j.fecha_nacimiento,
          j.equipo_id,
          e.nombre AS equipo,
          j.foto_url,
          j.ine_pdf_url,
          j.acta_pdf_url,
          j.estatus,
          j.observaciones
        FROM jugadores j
        JOIN equipos e ON j.equipo_id = e.id
        WHERE j.tenant_id = $1
        ORDER BY j.nombre`,
        [tenantId]
      );

      res.json(resultado.rows);
    } catch (err) {
      console.error('Error obteniendo jugadores:', err);
      res.status(500).json({ error: 'Error al obtener jugadores' });
    }
  }

  async crearJugador(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const { nombre, numero_camiseta, posicion, fecha_nacimiento, equipo_id } = req.body;

      if (!nombre || !posicion || !equipo_id) {
        return res.status(400).json({ error: 'Nombre, posición y equipo son obligatorios.' });
      }

      const resultado = await pool.query(
        `INSERT INTO jugadores (tenant_id, equipo_id, nombre, numero_camiseta, posicion, fecha_nacimiento)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [tenantId, equipo_id, nombre, numero_camiseta || null, posicion, fecha_nacimiento || null]
      );

      res.status(201).json({ mensaje: 'Jugador registrado correctamente.', id: resultado.rows[0].id });
    } catch (err) {
      console.error('Error creando jugador:', err);
      res.status(500).json({ error: 'Error al crear jugador' });
    }
  }

  async actualizarJugador(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const jugadorId = req.params.id;
      const { nombre, numero_camiseta, posicion, fecha_nacimiento, equipo_id } = req.body;

      const resultado = await pool.query(
        `UPDATE jugadores
         SET nombre = $1,
             numero_camiseta = $2,
             posicion = $3,
             fecha_nacimiento = $4,
             equipo_id = $5
         WHERE id = $6 AND tenant_id = $7 RETURNING id`,
        [nombre, numero_camiseta || null, posicion, fecha_nacimiento || null, equipo_id, jugadorId, tenantId]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Jugador no encontrado.' });
      }

      res.json({ mensaje: 'Jugador actualizado correctamente.' });
    } catch (err) {
      console.error('Error actualizando jugador:', err);
      res.status(500).json({ error: 'Error al actualizar jugador' });
    }
  }

  async eliminarJugador(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const jugadorId = req.params.id;
      const resultado = await pool.query('DELETE FROM jugadores WHERE id = $1 AND tenant_id = $2 RETURNING id', [jugadorId, tenantId]);

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Jugador no encontrado.' });
      }

      res.json({ mensaje: 'Jugador eliminado correctamente.' });
    } catch (err) {
      console.error('Error eliminando jugador:', err);
      res.status(500).json({ error: 'Error al eliminar jugador' });
    }
  }

  async cambiarEstatusJugador(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const jugadorId = req.params.id;
      const { estatus, observaciones } = req.body;

      if (!['pendiente', 'autorizado', 'rechazado'].includes(estatus)) {
        return res.status(400).json({ error: 'Estatus inválido.' });
      }

      const resultado = await pool.query(
        `UPDATE jugadores
         SET estatus = $1, observaciones = $2
         WHERE id = $3 AND tenant_id = $4 RETURNING id`,
        [estatus, observaciones || null, jugadorId, tenantId]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Jugador no encontrado.' });
      }

      res.json({ mensaje: `Jugador ${estatus} correctamente.` });
    } catch (err) {
      console.error('Error cambiando estatus de jugador:', err);
      res.status(500).json({ error: 'Error al actualizar estatus' });
    }
  }

  async getEquipos(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const resultado = await pool.query('SELECT id, nombre, entrenador, escudo_url FROM equipos WHERE tenant_id = $1 ORDER BY nombre', [tenantId]);
      res.json(resultado.rows);
    } catch (err) {
      console.error('Error obteniendo equipos:', err);
      res.status(500).json({ error: 'Error al obtener equipos' });
    }
  }

  async crearEquipo(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const { nombre, entrenador, escudo_url } = req.body;

      if (!nombre) {
        return res.status(400).json({ error: 'El nombre del equipo es obligatorio.' });
      }

      const torneoId = await this.getOrCreateTorneo(tenantId);
      const resultado = await pool.query(
        `INSERT INTO equipos (tenant_id, torneo_id, nombre, entrenador, escudo_url, categoria)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, entrenador, escudo_url, categoria`,
        [tenantId, torneoId, nombre, entrenador || null, escudo_url || null, req.body.categoria || null]
      );

      res.status(201).json({ mensaje: 'Equipo registrado correctamente.', equipo: resultado.rows[0] });
    } catch (err) {
      console.error('Error creando equipo:', err);
      res.status(500).json({ error: 'Error al crear equipo' });
    }
  }

  async actualizarEquipo(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const equipoId = req.params.id;
      const { nombre, entrenador, escudo_url } = req.body;

      const resultado = await pool.query(
        `UPDATE equipos SET nombre = $1, entrenador = $2, escudo_url = $3, categoria = $4
         WHERE id = $5 AND tenant_id = $6 RETURNING id`,
        [nombre, entrenador || null, escudo_url || null, req.body.categoria || null, equipoId, tenantId]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Equipo no encontrado.' });
      }

      res.json({ mensaje: 'Equipo actualizado correctamente.' });
    } catch (err) {
      console.error('Error actualizando equipo:', err);
      res.status(500).json({ error: 'Error al actualizar equipo' });
    }
  }

  async eliminarEquipo(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const equipoId = req.params.id;
      const resultado = await pool.query('DELETE FROM equipos WHERE id = $1 AND tenant_id = $2 RETURNING id', [equipoId, tenantId]);

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Equipo no encontrado.' });
      }

      res.json({ mensaje: 'Equipo eliminado correctamente.' });
    } catch (err) {
      console.error('Error eliminando equipo:', err);
      res.status(500).json({ error: 'Error al eliminar equipo' });
    }
  }

  async getArbitros(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const resultado = await pool.query('SELECT id, nombre, certificacion FROM arbitros WHERE tenant_id = $1 ORDER BY nombre', [tenantId]);
      res.json(resultado.rows);
    } catch (err) {
      console.error('Error obteniendo árbitros:', err);
      res.status(500).json({ error: 'Error al obtener árbitros' });
    }
  }

  async crearArbitro(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const { nombre, certificacion } = req.body;

      if (!nombre) {
        return res.status(400).json({ error: 'El nombre del árbitro es obligatorio.' });
      }

      const resultado = await pool.query(
        `INSERT INTO arbitros (tenant_id, nombre, certificacion)
         VALUES ($1, $2, $3) RETURNING id, nombre, certificacion`,
        [tenantId, nombre, certificacion || null]
      );

      res.status(201).json({ mensaje: 'Árbitro registrado correctamente.', arbitro: resultado.rows[0] });
    } catch (err) {
      console.error('Error creando árbitro:', err);
      res.status(500).json({ error: 'Error al crear árbitro' });
    }
  }

  async actualizarArbitro(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const arbitroId = req.params.id;
      const { nombre, certificacion } = req.body;

      const resultado = await pool.query(
        `UPDATE arbitros SET nombre = $1, certificacion = $2
         WHERE id = $3 AND tenant_id = $4 RETURNING id`,
        [nombre, certificacion || null, arbitroId, tenantId]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Árbitro no encontrado.' });
      }

      res.json({ mensaje: 'Árbitro actualizado correctamente.' });
    } catch (err) {
      console.error('Error actualizando árbitro:', err);
      res.status(500).json({ error: 'Error al actualizar árbitro' });
    }
  }

  async eliminarArbitro(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const arbitroId = req.params.id;
      const resultado = await pool.query('DELETE FROM arbitros WHERE id = $1 AND tenant_id = $2 RETURNING id', [arbitroId, tenantId]);

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Árbitro no encontrado.' });
      }

      res.json({ mensaje: 'Árbitro eliminado correctamente.' });
    } catch (err) {
      console.error('Error eliminando árbitro:', err);
      res.status(500).json({ error: 'Error al eliminar árbitro' });
    }
  }

  async getPosiciones(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const resultado = await pool.query(`
        SELECT * FROM vista_posiciones
        WHERE tenant_id = $1
        ORDER BY puntos DESC, ganados DESC, empatados DESC, perdidos ASC, equipo`,
        [tenantId]
      );
      res.json(resultado.rows);
    } catch (err) {
      console.error('Error obteniendo posiciones:', err);
      res.status(500).json({ error: 'Error al obtener posiciones' });
    }
  }

  async getGoleadores(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const resultado = await pool.query(`
        SELECT * FROM vista_goleadores
        WHERE tenant_id = $1
        ORDER BY goles DESC, jugador`,
        [tenantId]
      );
      res.json(resultado.rows);
    } catch (err) {
      console.error('Error obteniendo goleadores:', err);
      res.status(500).json({ error: 'Error al obtener goleadores' });
    }
  }

  async registrarGol(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const { partido_id, jugador_id, minuto, es_autogol = false } = req.body;

      if (!partido_id || !jugador_id || minuto == null) {
        return res.status(400).json({ error: 'Partido, jugador y minuto son obligatorios.' });
      }

      const partidoResult = await pool.query(
        'SELECT equipo_local_id, equipo_visitante_id FROM partidos WHERE id = $1 AND tenant_id = $2',
        [partido_id, tenantId]
      );
      if (partidoResult.rows.length === 0) {
        return res.status(404).json({ error: 'Partido no encontrado.' });
      }

      const jugadorResult = await pool.query(
        'SELECT equipo_id FROM jugadores WHERE id = $1 AND tenant_id = $2',
        [jugador_id, tenantId]
      );
      if (jugadorResult.rows.length === 0) {
        return res.status(404).json({ error: 'Jugador no encontrado.' });
      }

      const equipoJugador = jugadorResult.rows[0].equipo_id;
      const partido = partidoResult.rows[0];
      let updateScoreQuery = null;

      if (es_autogol) {
        if (equipoJugador === partido.equipo_local_id) {
          updateScoreQuery = 'UPDATE partidos SET goles_visitante = goles_visitante + 1 WHERE id = $1 AND tenant_id = $2';
        } else if (equipoJugador === partido.equipo_visitante_id) {
          updateScoreQuery = 'UPDATE partidos SET goles_local = goles_local + 1 WHERE id = $1 AND tenant_id = $2';
        }
      } else {
        if (equipoJugador === partido.equipo_local_id) {
          updateScoreQuery = 'UPDATE partidos SET goles_local = goles_local + 1 WHERE id = $1 AND tenant_id = $2';
        } else if (equipoJugador === partido.equipo_visitante_id) {
          updateScoreQuery = 'UPDATE partidos SET goles_visitante = goles_visitante + 1 WHERE id = $1 AND tenant_id = $2';
        }
      }

      if (!updateScoreQuery) {
        return res.status(400).json({ error: 'El jugador no pertenece a ningún equipo del partido.' });
      }

      const golInsert = await pool.query(
        `INSERT INTO goles (tenant_id, partido_id, jugador_id, minuto, es_autogol)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [tenantId, partido_id, jugador_id, minuto, es_autogol]
      );

      await pool.query(updateScoreQuery, [partido_id, tenantId]);
      res.status(201).json({ mensaje: 'Gol registrado correctamente.', id: golInsert.rows[0].id });
    } catch (err) {
      console.error('Error registrando gol:', err);
      res.status(500).json({ error: 'Error al registrar gol' });
    }
  }

  async actualizarGol(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const golId = req.params.id;
      const { minuto, es_autogol } = req.body;

      const resultado = await pool.query(
        `UPDATE goles SET minuto = $1, es_autogol = $2
         WHERE id = $3 AND tenant_id = $4 RETURNING id`,
        [minuto, es_autogol, golId, tenantId]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Gol no encontrado.' });
      }

      res.json({ mensaje: 'Gol actualizado correctamente.' });
    } catch (err) {
      console.error('Error actualizando gol:', err);
      res.status(500).json({ error: 'Error al actualizar gol' });
    }
  }

  async eliminarGol(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const golId = req.params.id;
      const resultado = await pool.query('DELETE FROM goles WHERE id = $1 AND tenant_id = $2 RETURNING id', [golId, tenantId]);

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Gol no encontrado.' });
      }

      res.json({ mensaje: 'Gol eliminado correctamente.' });
    } catch (err) {
      console.error('Error eliminando gol:', err);
      res.status(500).json({ error: 'Error al eliminar gol' });
    }
  }

  async _createOrGetJornada(tenantId, torneoId, numero) {
    const resultado = await pool.query('SELECT id FROM jornadas WHERE tenant_id = $1 AND torneo_id = $2 AND numero = $3 LIMIT 1', [tenantId, torneoId, numero]);
    if (resultado.rows.length > 0) {
      return resultado.rows[0].id;
    }

    const hoy = new Date();
    const fechaInicio = new Date(hoy);
    const fechaFin = new Date(hoy);
    fechaFin.setDate(fechaFin.getDate() + 1);

    const creado = await pool.query(
      `INSERT INTO jornadas (tenant_id, torneo_id, numero, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [tenantId, torneoId, numero, fechaInicio, fechaFin]
    );

    return creado.rows[0].id;
  }

  async getJornadas(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const resultado = await pool.query('SELECT id, numero, fecha_inicio, fecha_fin FROM jornadas WHERE tenant_id = $1 ORDER BY numero', [tenantId]);
      res.json(resultado.rows);
    } catch (err) {
      console.error('Error obteniendo jornadas:', err);
      res.status(500).json({ error: 'Error al obtener jornadas' });
    }
  }

  async generarRol(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const { overwrite = false, categoria = null } = req.body;
      const torneoId = await this.getOrCreateTorneo(tenantId);

      let sql = 'SELECT id, nombre FROM equipos WHERE tenant_id = $1 AND torneo_id = $2';
      const params = [tenantId, torneoId];

      if (categoria && categoria !== 'General') {
        sql += ' AND categoria = $3';
        params.push(categoria);
      }

      sql += ' ORDER BY nombre';
      const equiposResult = await pool.query(sql, params);
      const equipos = equiposResult.rows.map((row) => row.id);

      if (equipos.length < 2) {
        return res.status(400).json({ error: `Se necesitan al menos 2 equipos para generar el rol (${categoria || 'General'}).` });
      }

      const existResult = await pool.query('SELECT COUNT(*) FROM partidos WHERE tenant_id = $1', [tenantId]);
      const existe = parseInt(existResult.rows[0].count, 10);
      if (existe > 0 && !overwrite) {
        return res.status(409).json({ error: 'Ya existen partidos programados. Usa overwrite=true para regenerar el rol.' });
      }

      if (overwrite) {
        if (categoria && categoria !== 'General') {
          // Si es por categoría, solo borrar partidos de equipos de ESA categoría
          await pool.query(
            `DELETE FROM partidos WHERE tenant_id = $1 AND (
              equipo_local_id IN (SELECT id FROM equipos WHERE tenant_id = $1 AND categoria = $2)
              OR equipo_visitante_id IN (SELECT id FROM equipos WHERE tenant_id = $1 AND categoria = $2)
            )`, [tenantId, categoria]
          );
        } else {
          await pool.query('DELETE FROM partidos WHERE tenant_id = $1', [tenantId]);
          await pool.query('DELETE FROM jornadas WHERE tenant_id = $1', [tenantId]);
        }
      }

      const rounds = this._buildRoundRobin(equipos);
      const partidosCreados = [];
      const hoy = new Date();

      for (let i = 0; i < rounds.length; i += 1) {
        const numeroJornada = i + 1;
        const fechaInicio = new Date(hoy);
        fechaInicio.setDate(hoy.getDate() + i * 7);
        const fechaFin = new Date(fechaInicio);
        fechaFin.setDate(fechaInicio.getDate() + 1);

        const jornadaResult = await pool.query(
          `INSERT INTO jornadas (tenant_id, torneo_id, numero, fecha_inicio, fecha_fin)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [tenantId, torneoId, numeroJornada, fechaInicio, fechaFin]
        );
        const jornadaId = jornadaResult.rows[0].id;

        for (let j = 0; j < rounds[i].length; j += 1) {
          const [local, visitante] = rounds[i][j];
          const horaPartido = new Date(fechaInicio);
          horaPartido.setHours(12 + j, 0, 0, 0);

          const partidoResult = await pool.query(
            `INSERT INTO partidos (tenant_id, jornada_id, equipo_local_id, equipo_visitante_id, fecha_hora)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [tenantId, jornadaId, local, visitante, horaPartido]
          );

          partidosCreados.push({
            id: partidoResult.rows[0].id,
            jornada: numeroJornada,
            equipo_local_id: local,
            equipo_visitante_id: visitante,
            fecha_hora: horaPartido
          });
        }
      }

      res.json({ mensaje: `Rol generado correctamente con ${partidosCreados.length} partidos.`, partidos: partidosCreados });
    } catch (err) {
      console.error('Error generando rol:', err);
      res.status(500).json({ error: 'Error al generar el rol de partidos' });
    }
  }

  // ── CAMPOS ────────────────────────────────────────────────────────
  async getCampos(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const resultado = await pool.query('SELECT id, nombre, direccion, capacidad, activo FROM campos WHERE tenant_id = $1 ORDER BY nombre', [tenantId]);
      res.json(resultado.rows);
    } catch (err) {
      console.error('Error obteniendo campos:', err);
      res.status(500).json({ error: 'Error al obtener campos' });
    }
  }

  async crearCampo(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const { nombre, direccion, capacidad } = req.body;

      if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });

      const resultado = await pool.query(
        `INSERT INTO campos (tenant_id, nombre, direccion, capacidad)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [tenantId, nombre, direccion || null, capacidad || null]
      );

      res.status(201).json({ mensaje: 'Campo registrado correctamente.', campo: resultado.rows[0] });
    } catch (err) {
      console.error('Error creando campo:', err);
      res.status(500).json({ error: 'Error al crear campo' });
    }
  }

  async actualizarCampo(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const campoId = req.params.id;
      const { nombre, direccion, capacidad, activo } = req.body;

      const resultado = await pool.query(
        `UPDATE campos SET nombre = $1, direccion = $2, capacidad = $3, activo = $4
         WHERE id = $5 AND tenant_id = $6 RETURNING id`,
        [nombre, direccion || null, capacidad || null, activo, campoId, tenantId]
      );

      if (resultado.rows.length === 0) return res.status(404).json({ error: 'Campo no encontrado.' });
      res.json({ mensaje: 'Campo actualizado correctamente.' });
    } catch (err) {
      console.error('Error actualizando campo:', err);
      res.status(500).json({ error: 'Error al actualizar campo' });
    }
  }

  async eliminarCampo(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const campoId = req.params.id;
      const resultado = await pool.query('DELETE FROM campos WHERE id = $1 AND tenant_id = $2 RETURNING id', [campoId, tenantId]);

      if (resultado.rows.length === 0) return res.status(404).json({ error: 'Campo no encontrado.' });
      res.json({ mensaje: 'Campo eliminado correctamente.' });
    } catch (err) {
      console.error('Error eliminando campo:', err);
      res.status(500).json({ error: 'Error al eliminar campo' });
    }
  }

  // ── ESTADÍSTICAS DEL PARTIDO (LINEUP Y EVENTOS) ───────────────────
  async registrarEstadisticasPartido(req, res) {
    // Para simplificar, este endpoint guarda lineup y eventos completos para un partido
    const client = await pool.connect();
    try {
      const tenantId = req.usuario.tenant_id;
      const partidoId = req.params.partidoId;
      const { lineup, eventos } = req.body; // lineups y eventos son arrays

      await client.query('BEGIN');

      // 1. Guardar lineup (jugadores que participaron)
      if (lineup && Array.isArray(lineup)) {
         await client.query('DELETE FROM lineup_partido WHERE partido_id = $1', [partidoId]);
         for (const l of lineup) {
           await client.query(
             `INSERT INTO lineup_partido (partido_id, jugador_id, equipo_id, minutos_jugados)
              VALUES ($1, $2, $3, $4)`,
             [partidoId, l.jugador_id, l.equipo_id, l.minutos_jugados || 90]
           );
         }
      }

      // 2. Guardar eventos (goles, tarjetas, faltas)
      if (eventos && Array.isArray(eventos)) {
         await client.query('DELETE FROM eventos_partido WHERE partido_id = $1 AND tenant_id = $2', [partidoId, tenantId]);
         for (const e of eventos) {
           await client.query(
             `INSERT INTO eventos_partido (tenant_id, partido_id, jugador_id, equipo_id, tipo, minuto)
              VALUES ($1, $2, $3, $4, $5, $6)`,
             [tenantId, partidoId, e.jugador_id || null, e.equipo_id, e.tipo, e.minuto || null]
           );
           
           // Si el evento es gol autogol, actualizamos la vieja tabla "goles" por retrocompatibilidad momentánea, o la omitimos
           // Aquí podríamos también actualizar el conteo en `partidos` (goles_local, goles_visitante)
         }
      }

      await client.query('COMMIT');
      res.json({ mensaje: 'Estadísticas del partido guardadas correctamente.' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error guardando estadisticas de partido:', err);
      res.status(500).json({ error: 'Error al guardar estadísticas' });
    } finally {
      client.release();
    }
  }

  async getEstadisticasPartido(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const partidoId = req.params.partidoId;

      // Lineup
      const rLineup = await pool.query(
        `SELECT l.id, l.jugador_id, l.equipo_id, l.minutos_jugados, j.nombre, j.numero_camiseta, e.nombre AS equipo
         FROM lineup_partido l
         JOIN jugadores j ON l.jugador_id = j.id
         JOIN equipos e ON l.equipo_id = e.id
         WHERE l.partido_id = $1`, [partidoId]
      );

      // Eventos
      const rEventos = await pool.query(
        `SELECT ev.id, ev.jugador_id, ev.equipo_id, ev.tipo, ev.minuto, j.nombre AS jugador_nombre, e.nombre AS equipo_nombre
         FROM eventos_partido ev
         LEFT JOIN jugadores j ON ev.jugador_id = j.id
         JOIN equipos e ON ev.equipo_id = e.id
         WHERE ev.partido_id = $1 AND ev.tenant_id = $2
         ORDER BY ev.minuto ASC NULLS LAST`, [partidoId, tenantId]
      );

      res.json({ lineup: rLineup.rows, eventos: rEventos.rows });
    } catch (err) {
      console.error('Error obteniendo estadisticas de partido:', err);
      res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
  }
  // ── Configuración de liga (tipo + categorías) ──────────────
  async getConfiguracionLiga(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const r = await pool.query(
        `SELECT tipo_liga, categorias_soccer, categorias_fut7 FROM tenants WHERE id = $1`,
        [tenantId]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Liga no encontrada.' });
      const row = r.rows[0];

      // El formato ahora es [{name, price}, ...]
      let catSoccer = [];
      let catFut7 = [];
      try {
        catSoccer = JSON.parse(row.categorias_soccer || '[]');
        catFut7   = JSON.parse(row.categorias_fut7   || '[]');
      } catch (e) {
        // Fallback para datos viejos (arrays de strings)
        const oldSoccer = Array.isArray(JSON.parse(row.categorias_soccer || '[]')) ? JSON.parse(row.categorias_soccer || '[]') : [];
        const oldFut7   = Array.isArray(JSON.parse(row.categorias_fut7   || '[]')) ? JSON.parse(row.categorias_fut7   || '[]') : [];
        catSoccer = oldSoccer.map(c => typeof c === 'string' ? { name: c, price: 0 } : c);
        catFut7   = oldFut7.map(c => typeof c === 'string' ? { name: c, price: 0 } : c);
      }

      res.json({
        tipo_liga:         row.tipo_liga || 'Fútbol Soccer',
        categorias_soccer: catSoccer,
        categorias_fut7:   catFut7
      });
    } catch (err) {
      console.error('Error getConfiguracionLiga:', err);
      res.status(500).json({ error: 'Error al obtener configuración' });
    }
  }

  async updateConfiguracionLiga(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const { tipo_liga, categorias_soccer = [], categorias_fut7 = [] } = req.body;

      const tiposValidos = ['Fútbol Soccer', 'Fútbol 7', 'Ambas'];
      if (!tiposValidos.includes(tipo_liga)) {
        return res.status(400).json({ error: 'Tipo de liga inválido.' });
      }

      // Validar estructura de categorías [{name: string, price: number}]
      const mapCat = (c) => ({
        name: typeof c === 'string' ? c : (c.name || 'Sin nombre'),
        price: parseFloat(c.price) || 0
      });

      const catSoccer = categorias_soccer.map(mapCat);
      const catFut7   = categorias_fut7.map(mapCat);

      await pool.query(
        `UPDATE tenants SET tipo_liga=$1, categorias_soccer=$2, categorias_fut7=$3 WHERE id=$4`,
        [tipo_liga, JSON.stringify(catSoccer), JSON.stringify(catFut7), tenantId]
      );
      res.json({ mensaje: 'Configuración guardada correctamente.' });
    } catch (err) {
      console.error('Error updateConfiguracionLiga:', err);
      res.status(500).json({ error: 'Error al guardar configuración: ' + err.message });
    }
  }

  // ── Jugadores pendientes agrupados por equipo (para que el organizador apruebe) ──
  async getJugadoresPendientesPorEquipo(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const r = await pool.query(
        `SELECT j.id, j.nombre, j.numero_camiseta, j.posicion, j.estatus, j.observaciones,
                j.foto_url, j.ine_pdf_url, j.acta_pdf_url,
                e.id AS equipo_id, e.nombre AS equipo_nombre
         FROM jugadores j
         JOIN equipos e ON j.equipo_id = e.id
         WHERE j.tenant_id = $1
           AND j.estatus IN ('pendiente', 'Baja Solicitada')
         ORDER BY e.nombre, j.nombre`,
        [tenantId]
      );

      // Agrupar por equipo
      const grupos = {};
      for (const row of r.rows) {
        const key = row.equipo_id;
        if (!grupos[key]) {
          grupos[key] = { equipo_id: row.equipo_id, equipo_nombre: row.equipo_nombre, jugadores: [] };
        }
        grupos[key].jugadores.push({
          id: row.id,
          nombre: row.nombre,
          numero_camiseta: row.numero_camiseta,
          posicion: row.posicion,
          estatus: row.estatus,
          observaciones: row.observaciones,
          foto_url: row.foto_url,
          ine_pdf_url: row.ine_pdf_url,
          acta_pdf_url: row.acta_pdf_url
        });
      }

      res.json({ grupos: Object.values(grupos) });
    } catch (err) {
      console.error('Error getJugadoresPendientesPorEquipo:', err);
      res.status(500).json({ error: 'Error al obtener jugadores pendientes' });
    }
  }

  // ── Todos los jugadores agrupados por equipo ──
  async getJugadoresPorEquipo(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const r = await pool.query(
        `SELECT j.id, j.nombre, j.numero_camiseta, j.posicion, j.estatus, j.observaciones,
                j.foto_url, j.ine_pdf_url, j.acta_pdf_url,
                e.id AS equipo_id, e.nombre AS equipo_nombre
         FROM jugadores j
         JOIN equipos e ON j.equipo_id = e.id
         WHERE j.tenant_id = $1
         ORDER BY e.nombre, j.nombre`,
        [tenantId]
      );

      const grupos = {};
      for (const row of r.rows) {
        const key = row.equipo_id;
        if (!grupos[key]) {
          grupos[key] = { equipo_id: row.equipo_id, equipo_nombre: row.equipo_nombre, jugadores: [] };
        }
        grupos[key].jugadores.push({
          id: row.id,
          nombre: row.nombre,
          numero_camiseta: row.numero_camiseta,
          posicion: row.posicion,
          estatus: row.estatus,
          observaciones: row.observaciones,
          foto_url: row.foto_url,
          ine_pdf_url: row.ine_pdf_url,
          acta_pdf_url: row.acta_pdf_url
        });
      }

      res.json({ grupos: Object.values(grupos) });
    } catch (err) {
      console.error('Error getJugadoresPorEquipo:', err);
      res.status(500).json({ error: 'Error al obtener jugadores por equipo' });
    }
  }

  // ── El organizador da de baja definitiva a un jugador ──
  async darDeBajaJugador(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const jugadorId = req.params.id;
      const { observaciones } = req.body;

      const r = await pool.query(
        `UPDATE jugadores SET estatus = 'rechazado', observaciones = $1
         WHERE id = $2 AND tenant_id = $3 RETURNING id`,
        [observaciones || 'Baja definitiva por el organizador', jugadorId, tenantId]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Jugador no encontrado.' });
      res.json({ mensaje: 'Jugador dado de baja correctamente.' });
    } catch (err) {
      console.error('Error darDeBajaJugador:', err);
      res.status(500).json({ error: 'Error al dar de baja al jugador' });
    }
  }

  // ── Finalizar Torneo (Cierra el ciclo y obliga a renovación) ──
  async finalizarTorneo(req, res) {
    try {
      const tenantId = req.usuario.tenant_id;
      const { torneo_id } = req.body;

      if (!torneo_id) return res.status(400).json({ error: 'ID de torneo requerido.' });

      // 1. Marcar torneo como Finalizado
      await pool.query(
        `UPDATE torneos SET estatus = 'Finalizado' WHERE id = $1 AND tenant_id = $2`,
        [torneo_id, tenantId]
      );

      // 2. (Opcional) Podríamos limpiar los equipos del torneo activo para que se inscriban al nuevo,
      // pero usualmente se prefiere mantener el historial. 
      // La lógica de login del capitán ya verifica si el torneo actual coincide con el pagado.

      res.json({ mensaje: 'Torneo finalizado. Los equipos verán su suscripción como vencida para el próximo torneo.' });
    } catch (err) {
      console.error('Error finalizarTorneo:', err);
      res.status(500).json({ error: 'Error al finalizar el torneo' });
    }
  }
}

module.exports = new OrganizadorController();
