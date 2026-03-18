# Integra Hotel AI — Agente de Chat Sofía

Widget de chat con inteligencia artificial para hoteles 3-4★ en México. Se instala en el sitio web del hotel con dos líneas de código y despliega a Sofía, una asistente virtual que consulta disponibilidad en tiempo real, responde preguntas sobre servicios y políticas, y captura pre-reservaciones automáticamente.

**Estado actual:** En producción — Hotel Frontiere, Tijuana B.C.

---

## ¿Qué hace Sofía?

- Consulta disponibilidad y precios en tiempo real desde Wubook (channel manager)
- Responde preguntas sobre servicios, distancias, políticas y datos de contacto del hotel
- Captura pre-reservaciones con folio único y las guarda en base de datos propia
- Notifica al recepcionista por email al capturar cada pre-reservación
- Responde en el idioma del huésped — español e inglés
- Streaming de respuestas token por token (primera palabra visible en < 1s)
- Memoria de conversación por sesión (30 minutos)
- Sugerencias de preguntas rápidas al abrir el chat

---

## Arquitectura

```
Sitio web del hotel (hotelfrontiere.com)
  └── embed.js (2 líneas de instalación)
        └── Widget Sofía — colores y avatar configurables por hotel
              └── GET /chat/stream (SSE)
                    └── Agente Sofía (GPT-4o mini)
                          ├── check_availability  → Wubook XML-RPC → Redis caché
                          ├── get_hotel_info      → datos configurables
                          ├── get_policies        → datos configurables
                          └── create_prereservation → PostgreSQL Neon → Email Resend
```

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js v22 + TypeScript |
| Framework | Express |
| IA | OpenAI GPT-4o mini — function calling + streaming SSE |
| Channel Manager | Wubook XML-RPC (solo lectura) |
| Caché | Upstash Redis — TTL 15 min disponibilidad, 30 min sesión |
| Base de datos propia | PostgreSQL serverless — Neon |
| Email | Resend — notificaciones al recepcionista |
| Widget | Vanilla JS + CSS custom (Coastal Light) |
| Deploy | Railway (producción) |

---

## Instalación en desarrollo

```bash
# 1. Clonar el repositorio
git clone https://github.com/pepzarate/integra-hotel-ai.git
cd integra-hotel-ai

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 4. Arrancar en desarrollo
npm run dev

# 5. Abrir el widget de prueba (importante: via URL, no como archivo)
# http://localhost:3000/widget/dev.html
```

> ⚠️ Siempre acceder a `dev.html` via `http://localhost:3000/widget/dev.html` — abrirlo como archivo (`file://`) causa `Origin: null` y CORS lo bloquea.

---

## Variables de entorno

```env
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Wubook
WUBOOK_TOKEN=wr_...
WUBOOK_LCODE=1234567890

# Redis — Upstash (sin comillas en el valor)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# PostgreSQL — Neon
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Email — Resend
RESEND_API_KEY=re_...
HOTEL_NOTIFY_EMAIL=recepcion@hotel.com

# Admin
ADMIN_TOKEN=tu-token-seguro-aqui

# Servidor (no agregar en Railway — se inyecta automáticamente)
PORT=3000
```

> ⚠️ Nunca subas el archivo `.env` al repositorio. Está incluido en `.gitignore`.
> ⚠️ En Railway, pegar los valores **sin comillas** — las comillas se tratan como parte del valor.

---

## Endpoints

### Status
```
GET /api/status
```

### Agente Sofía — Streaming SSE (principal)
```
GET /chat/stream?message=...&session_id=...
```
Responde con eventos SSE:
```
data: {"token":"¡"}
data: {"token":"Hola"}
...
data: {"done":true,"session_id":"uuid"}
```

### Agente Sofía — Síncrono (legacy)
```
POST /chat
Content-Type: application/json
{ "message": "...", "session_id": "..." }
```

### Pre-reservaciones (protegido)
```
GET /prereservaciones
Header: x-admin-token: tu-admin-token
```

### Widget (archivos estáticos)
```
GET /widget/embed.js
GET /widget/sofia.js
GET /widget/sofia.css
```

---

## Instalación del widget en el sitio del hotel

```html
<script>
  window.SofiaConfig = {
    backendUrl:   'https://integra-hotel-ai-production.up.railway.app',
    hotelName:    'Hotel Frontiere',
    primaryColor: '#b8312f',
    darkColor:    '#3e3e3e',
    avatar:       'https://url-del-favicon-del-hotel.ico',
  };
</script>
<script src="https://integra-hotel-ai-production.up.railway.app/widget/embed.js"></script>
```

**Parámetros de `SofiaConfig`:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `backendUrl` | string | URL del backend en Railway |
| `hotelName` | string | Nombre del hotel (aparece en el mensaje de bienvenida) |
| `primaryColor` | string | Color principal del widget en hex |
| `darkColor` | string | Color secundario del widget en hex |
| `avatar` | string | URL de imagen (https://...) o emoji para el avatar de Sofía |
| `welcomeMsg` | string | Mensaje de bienvenida personalizado (opcional) |

**Nota para cada nuevo hotel:**
Agregar el dominio del hotel a `ALLOWED_ORIGINS` en `src/index.ts` antes del deploy.

---

## Estructura del proyecto

```
integra-hotel-ai/
├── src/
│   ├── index.ts                  # Servidor Express, rutas, SSE, CORS, CORP
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   └── asyncWrapper.ts
│   ├── services/
│   │   ├── sofia.ts              # Agente — chatWithSofia + streamWithSofia
│   │   ├── functions.ts          # Schemas de tools OpenAI
│   │   ├── functionExecutor.ts   # Ejecutor de herramientas + datos del hotel
│   │   ├── wubook.ts             # Conector Wubook XML-RPC + agrupación variantes
│   │   ├── cache.ts              # Redis helper
│   │   ├── session.ts            # Sesiones Redis
│   │   ├── ownDb.ts              # PostgreSQL Neon
│   │   └── email.ts              # Notificaciones Resend
│   └── utils/
│       └── dates.ts              # Validación de fechas con zona America/Tijuana
├── widget/
│   ├── embed.js                  # Script autocontenido — instalación 2 líneas
│   ├── sofia.js                  # Lógica del widget (desarrollo)
│   ├── sofia.css                 # Estilos Coastal Light
│   └── dev.html                  # Página de desarrollo local
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Reglas críticas

**1. Wubook es SOLO LECTURA**
El conector nunca escribe en el channel manager. Toda escritura va a PostgreSQL Neon.

**2. Caché antes que Wubook**
Toda consulta de disponibilidad pasa primero por Redis (TTL 15 min). Si Wubook falla, Sofía responde con datos de contacto del hotel — nunca un error técnico al huésped.

**3. Errores siempre como JSON**
El error handler global garantiza respuestas JSON en todos los casos.

**4. dev.html siempre via localhost**
`http://localhost:3000/widget/dev.html` — nunca abrir como `file://`.

**5. Variables de entorno sin comillas en Railway**
`UPSTASH_REDIS_REST_URL=https://...` — las comillas se tratan como parte del valor y rompen la conexión.

---

## Deploy en Railway

1. Conectar repositorio GitHub en Railway → **New Project → Deploy from GitHub**
2. Agregar variables de entorno en la pestaña **Variables** (sin comillas en los valores)
3. En **Settings → Networking** configurar el puerto que Railway asignó (ver logs de arranque)
4. El build se ejecuta automáticamente con `npm run build` → `npm run start`

El servidor arranca correctamente cuando el log muestra:
```
✓ Wubook: 13 tipos de habitación cargados
✓ Tabla prereservaciones lista
✓ Listo
```

---

## Plan de desarrollo

| Sesión | Descripción | Estado |
|--------|-------------|--------|
| 1–4 + limpieza | Setup, agente Sofía, widget, Wubook | ✅ |
| 5 | Streaming SSE | ✅ |
| 6 | Deploy producción Railway, CORS, auth | ✅ |
| 7 | Email Resend, fix fechas, fix ocupación, datos hotel, system prompt v2, sugerencias | ✅ |
| 8 | Colores, avatar, CORP fix, instalación hotelfrontiere.com | ✅ |
| 9 | Ajustes post-piloto | ⬜ |
| 10 | Segundo hotel + primer MRR | ⬜ |

---

## Modelo de negocio

| Plan | Precio | Incluye |
|------|--------|---------|
| Starter | $990 MXN/mes | 300 conversaciones, 1 idioma |
| Pro | $1,990 MXN/mes | 1,000 conversaciones, ES+EN, analytics |
| Enterprise | $3,500 MXN/mes | Ilimitado, WhatsApp, ElevenLabs |

---

## Licencia

Proyecto privado — todos los derechos reservados.
© 2026 Integra Hotel AI

---

*Construido con disciplina, una sesión a la vez.*
