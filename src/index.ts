import express from 'express';
import dotenv from 'dotenv';
import { testConnection } from './services/database';
dotenv.config();

const app = express();
app.use(express.json());

app.get('/api/status', async (_req, res) => {
  const dbOk = await testConnection();
  res.json({ 
    status: dbOk ? 'ok' : 'db_error',
    project: 'Integra Hotel AI — Agente de Voz',
    database: dbOk ? '✓ SOFTcalli conectado' : '✗ Sin conexión',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;

import { 
  getAllTables, 
  getTableColumns, 
  sampleTable,
  searchTables,
  searchColumns 
} from './services/explorer';

// ── EXPLORADOR DE SCHEMA ──────────────────────────────
app.get('/explorer/tables', async (_req, res) => {
  const tables = await getAllTables();
  res.json({ total: (tables as unknown[]).length, tables });
});

app.get('/explorer/tables/:name/columns', async (req, res) => {
  const cols = await getTableColumns(req.params.name);
  res.json({ table: req.params.name, columns: cols });
});

app.get('/explorer/tables/:name/sample', async (req, res) => {
  const rows = await sampleTable(req.params.name);
  res.json({ table: req.params.name, rows });
});

app.get('/explorer/search/tables/:keyword', async (req, res) => {
  const results = await searchTables(req.params.keyword);
  res.json({ keyword: req.params.keyword, results });
});

app.get('/explorer/search/columns/:keyword', async (req, res) => {
  const results = await searchColumns(req.params.keyword);
  res.json({ keyword: req.params.keyword, results });
});

import { 
  getTiposHabitacion, 
  getDisponibilidad,
  getTarifasVigentes,
  getPreciosPorTipo,
  consultarDisponibilidadCompleta 
} from './services/pms';

// ── PMS CONECTOR ──────────────────────────────────────────
app.get('/pms/:idHotel/tipos', async (req, res) => {
  const data = await getTiposHabitacion(Number(req.params.idHotel));
  res.json(data);
});

app.get('/pms/:idHotel/disponibilidad', async (req, res) => {
  const { entrada, salida } = req.query as Record<string, string>;
  if (!entrada || !salida) {
    res.status(400).json({ error: 'Se requieren parámetros: entrada y salida (YYYY-MM-DD)' });
    return;
  }
  const data = await getDisponibilidad(Number(req.params.idHotel), entrada, salida);
  res.json(data);
});

app.get('/pms/:idHotel/tarifas', async (req, res) => {
  const { entrada, salida } = req.query as Record<string, string>;
  if (!entrada || !salida) {
    res.status(400).json({ error: 'Se requieren parámetros: entrada y salida (YYYY-MM-DD)' });
    return;
  }
  const data = await getTarifasVigentes(Number(req.params.idHotel), entrada, salida);
  res.json(data);
});

app.get('/pms/:idHotel/consulta', async (req, res) => {
  const { entrada, salida } = req.query as Record<string, string>;
  if (!entrada || !salida) {
    res.status(400).json({ error: 'Se requieren parámetros: entrada y salida (YYYY-MM-DD)' });
    return;
  }
  const data = await consultarDisponibilidadCompleta(
    Number(req.params.idHotel), entrada, salida
  );
  res.json(data);
});

app.get('/pms/:idHotel/precios', async (req, res) => {
  const { entrada, salida } = req.query as Record<string, string>;
  if (!entrada || !salida) {
    res.status(400).json({ error: 'Se requieren: entrada y salida (YYYY-MM-DD)' });
    return;
  }
  const data = await getPreciosPorTipo(Number(req.params.idHotel), entrada, salida);
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`\n✓ Integra Hotel AI corriendo en http://localhost:${PORT}`);
  console.log(`  Verifica BD: curl http://localhost:${PORT}/api/status\n`);
});