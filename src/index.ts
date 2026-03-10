import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { chatWithSofia } from './services/sofia';
import { errorHandler } from './middleware/errorHandler';
import { wrap } from './middleware/asyncWrapper';
import { testConnection } from './services/database';
import { generateSessionId, getSession, appendToSession } from './services/session';
import { initDb, getPrereservaciones } from './services/ownDb';

dotenv.config();

const app = express();
app.use((req, res, next) => {
  if (req.path.startsWith('/widget')) {
    helmet({ contentSecurityPolicy: false })(req, res, next);
  } else {
    helmet()(req, res, next);
  }
});
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/api/status', wrap(async (_req, res) => {
  const dbOk = await testConnection();
  res.json({
    status: dbOk ? 'ok' : 'db_error',
    project: 'Integra Hotel AI — Agente de Voz',
    database: dbOk ? '✓ SOFTcalli conectado' : '✗ Sin conexión',
    timestamp: new Date().toISOString()
  });
}));

import {
  getAllTables,
  getTableColumns,
  sampleTable,
  searchTables,
  searchColumns
} from './services/explorer';

// ── EXPLORADOR DE SCHEMA ──────────────────────────────
app.get('/explorer/tables', wrap(async (_req, res) => {
  const tables = await getAllTables();
  res.json({ total: (tables as unknown[]).length, tables });
}));

app.get('/explorer/tables/:name/columns', wrap(async (req, res) => {
  const cols = await getTableColumns(String(req.params.name));
  res.json({ table: req.params.name, columns: cols });
}));

app.get('/explorer/tables/:name/sample', wrap(async (req, res) => {
  const rows = await sampleTable(String(req.params.name));
  res.json({ table: req.params.name, rows });
}));

app.get('/explorer/search/tables/:keyword', wrap(async (req, res) => {
  const results = await searchTables(String(req.params.keyword));
  res.json({ keyword: req.params.keyword, results });
}));

app.get('/explorer/search/columns/:keyword', wrap(async (req, res) => {
  const results = await searchColumns(String(req.params.keyword));
  res.json({ keyword: req.params.keyword, results });
}));

import {
  getTiposHabitacion,
  getDisponibilidad,
  getTarifasVigentes,
  getPreciosPorTipo,
  consultarDisponibilidadCompleta
} from './services/pms';
import { error, timeStamp } from 'node:console';

// ── PMS CONECTOR ──────────────────────────────────────────
app.get('/pms/:idHotel/tipos', wrap(async (req, res) => {
  const data = await getTiposHabitacion(Number(req.params.idHotel));
  res.json(data);
}));

app.get('/pms/:idHotel/disponibilidad', wrap(async (req, res) => {
  const { entrada, salida } = req.query as Record<string, string>;
  if (!entrada || !salida) {
    res.status(400).json({ error: 'Se requieren parámetros: entrada y salida (YYYY-MM-DD)' });
    return;
  }
  const data = await getDisponibilidad(Number(req.params.idHotel), entrada, salida);
  res.json(data);
}));

app.get('/pms/:idHotel/tarifas', wrap(async (req, res) => {
  const { entrada, salida } = req.query as Record<string, string>;
  if (!entrada || !salida) {
    res.status(400).json({ error: 'Se requieren parámetros: entrada y salida (YYYY-MM-DD)' });
    return;
  }
  const data = await getTarifasVigentes(Number(req.params.idHotel), entrada, salida);
  res.json(data);
}));

app.get('/pms/:idHotel/consulta', wrap(async (req, res) => {
  const { entrada, salida } = req.query as Record<string, string>;
  if (!entrada || !salida) {
    res.status(400).json({ error: 'Se requieren parámetros: entrada y salida (YYYY-MM-DD)' });
    return;
  }
  const data = await consultarDisponibilidadCompleta(
    Number(req.params.idHotel), entrada, salida
  );
  res.json(data);
}));

app.get('/pms/:idHotel/precios', wrap(async (req, res) => {
  const { entrada, salida } = req.query as Record<string, string>;
  if (!entrada || !salida) {
    res.status(400).json({ error: 'Se requieren: entrada y salida (YYYY-MM-DD)' });
    return;
  }
  const data = await getPreciosPorTipo(Number(req.params.idHotel), entrada, salida);
  res.json(data);
}));

app.post('/chat', wrap(async (req, res) => {
  const { message, session_id } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'El campo "message" es requerido' });
    return;
  }

  // Recuperar o crear sesión
  const sessionId = session_id || generateSessionId();
  const history = await getSession(sessionId);

  console.log(`[SOFIA] Sesión: ${sessionId} | Mensajes en historial: ${history.length}`);
  console.log(`[SOFIA] Usuario: ${message}`);

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Sofía tardó demasiado en responder')), 30000)
  );

  const reply = await Promise.race([
    chatWithSofia(message, history),
    timeout,
  ]);

  // Guardar en Redis para la próxima vuelta
  await appendToSession(sessionId, message, reply as string);

  console.log(`[SOFIA] Sofía: ${reply}`);

  res.json({
    reply,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
  });
}));

// ── PRE-RESERVACIONES ─────────────────────────────────
app.get('/prereservaciones', wrap(async (_req, res) => {
  const registros = await getPrereservaciones();
  res.json({
    total: registros.length,
    registros,
  });
}));

app.use('/widget', express.static(path.join(__dirname, '../widget')));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`\n✓ Integra Hotel AI corriendo en http://localhost:${PORT}`);
  console.log(`  Verifica BD: curl http://localhost:${PORT}/api/status\n`);

  // Pre-calentar el pool de SQL Server
  try {
    const { consultarDisponibilidadCompleta } = await import('./services/pms');

    // Pre-calentar los próximos 14 días en paralelo
    const fechas: { entrada: string; salida: string }[] = [];
    for (let i = 0; i < 14; i++) {
      const entrada = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
      const salida = new Date(Date.now() + (i + 1) * 86400000).toISOString().split('T')[0];
      fechas.push({ entrada, salida });
    }

    // También agregar fin de semanas completos (2 y 3 noches)
    for (let i = 0; i < 12; i++) {
      const entrada = new Date(Date.now() + i * 86400000).toISOString().split('T')[0];
      const salida2 = new Date(Date.now() + (i + 2) * 86400000).toISOString().split('T')[0];
      const salida3 = new Date(Date.now() + (i + 3) * 86400000).toISOString().split('T')[0];
      fechas.push({ entrada, salida: salida2 });
      fechas.push({ entrada, salida: salida3 });
    }

    // Ejecutar en lotes de 5 para no saturar SQL
    for (let i = 0; i < fechas.length; i += 5) {
      const lote = fechas.slice(i, i + 5);
      await Promise.all(lote.map(f =>
        consultarDisponibilidadCompleta(1, f.entrada, f.salida).catch(() => null)
      ));
    }

    console.log(`  ✓ Pool SQL pre-calentado — ${fechas.length} combinaciones en caché`);
  } catch (err) {
    console.warn(`  ⚠ Pre-calentado falló, primer request será más lento`);
  }
  await initDb();
});