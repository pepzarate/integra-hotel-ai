import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { chatWithSofia } from './services/sofia';
import { errorHandler } from './middleware/errorHandler';
import { wrap } from './middleware/asyncWrapper';
import { generateSessionId, getSession, appendToSession } from './services/session';
import { initDb, getPrereservaciones } from './services/ownDb';

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
  res.json({
    status: 'ok',
    project: 'Integra Hotel AI — Widget Sofía',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
}));

/*
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
*/

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
    setTimeout(() => reject(new Error('Sofía tardó demasiado en responder')), 60000)
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

  // Cargar catálogo Wubook
  try {
    const { loadRoomCatalog } = await import('./services/wubook');
    await loadRoomCatalog();
  } catch (err) {
    console.warn(`  ⚠ Wubook: no se pudo cargar el catálogo — ${err}`);
  }

  // Inicializar BD propia
  await initDb();

  console.log(`  ✓ Listo\n`);
});