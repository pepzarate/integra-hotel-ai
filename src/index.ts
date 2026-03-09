import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { chatWithSofia } from './services/sofia';
import { errorHandler } from './middleware/errorHandler';
import { wrap } from './middleware/asyncWrapper';
import { testConnection } from './services/database';
dotenv.config();

const app = express();
app.use(helmet());
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
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'El campo "message" es requerido' });
    return;
  }

  console.log(`[SOFIA] Usuario: ${message}`);

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Sofía tardó demasiado en responder')), 30000)
  );

  const reply = await Promise.race([
    chatWithSofia(message, history),
    timeout,
  ]);

  console.log(`[SOFIA] Sofía: ${reply}`);

  res.json({
    reply,
    timestamp: new Date().toISOString(),
  });
}));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n✓ Integra Hotel AI corriendo en http://localhost:${PORT}`);
  console.log(`  Verifica BD: curl http://localhost:${PORT}/api/status\n`);
});