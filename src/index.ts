import dotenv from 'dotenv';
dotenv.config();
import express, { type Request, type Response, type NextFunction } from 'express';
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
const ALLOWED_ORIGINS = [
  'https://integra-hotel-ai-production.up.railway.app', // el propio backend (dev.html)
  'http://localhost:3000',                               // desarrollo local
  // Cuando tengas el dominio del hotel piloto, agrégalo aquí:
  'https://hotelfrontiere.com/',
  'https://microcallidf-15.app.exur.com/',
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS bloqueado para origen: ${origin}`));
  },
}));
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

app.get('/chat/stream', async (req, res) => {
  const { message, session_id } = req.query as Record<string, string>;

  if (!message) {
    res.status(400).json({ error: 'El parámetro "message" es requerido' });
    return;
  }

  // Headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sessionId = session_id || generateSessionId();
  const history = await getSession(sessionId);
  const startTime = Date.now();

  console.log(`\n[SOFIA-STREAM] ── Nuevo request ──────────────────────`);
  console.log(`[SOFIA-STREAM] Sesión:   ${sessionId}`);
  console.log(`[SOFIA-STREAM] Historial: ${history.length} mensaje(s)`);
  console.log(`[SOFIA-STREAM] Usuario:  "${message}"`);

  let tokenCount = 0;
  let firstTokenAt: number | null = null;

  try {
    const { streamWithSofia } = await import('./services/sofia');

    const reply = await streamWithSofia(message, history, (token) => {
      if (!firstTokenAt) {
        firstTokenAt = Date.now();
        console.log(`[SOFIA-STREAM] Primer token en ${firstTokenAt - startTime}ms`);
      }
      tokenCount++;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    });

    await appendToSession(sessionId, message, reply);

    res.write(`data: ${JSON.stringify({ done: true, session_id: sessionId })}\n\n`);

    const totalTime = Date.now() - startTime;
    console.log(`[SOFIA-STREAM] Completado — ${reply.length} chars · ${tokenCount} tokens · ${totalTime}ms total`);
    console.log(`[SOFIA-STREAM] ───────────────────────────────────────\n`);

  } catch (err: any) {
    console.error(`[SOFIA-STREAM] ❌ Error (${Date.now() - startTime}ms):`, err.message);
    res.write(`data: ${JSON.stringify({ error: 'No pude procesar tu mensaje' })}\n\n`);
  } finally {
    res.end();
  }
});

// Middleware de autenticación — solo para rutas admin
function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }
  next();
}

// ── PRE-RESERVACIONES ─────────────────────────────────
app.get('/prereservaciones', requireAdminToken, wrap(async (_req, res) => {
  const registros = await getPrereservaciones();
  res.json({
    total: registros.length,
    registros,
  });
}));

app.use('/widget', express.static(path.join(__dirname, '../widget')));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(Number(PORT), '0.0.0.0', async () => {
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