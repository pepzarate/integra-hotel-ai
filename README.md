# Integra Hotel AI — Agente de Chat Sofía

Widget de chat con inteligencia artificial para hoteles 3-4★ en México. Se instala en el sitio web del hotel con dos líneas de código y despliega a Sofía, una asistente virtual que consulta disponibilidad en tiempo real, responde preguntas sobre servicios y políticas, y captura pre-reservaciones automáticamente.

**Estado actual:** En producción — hotel piloto en instalación.

---

## ¿Qué hace Sofía?

- Consulta disponibilidad y precios en tiempo real desde Wubook (channel manager)
- Responde preguntas sobre servicios, políticas y datos de contacto del hotel
- Captura pre-reservaciones con folio único y las guarda en base de datos propia
- Responde en el idioma del huésped — español e inglés
- Streaming de respuestas token por token (primera palabra visible en < 1.5s)
- Memoria de conversación por sesión (30 minutos)

---

## Arquitectura

```
Sitio web del hotel
  └── embed.js (2 líneas de instalación)
        └── Widget Sofía (Coastal Light)
              └── GET /chat/stream (SSE)
                    └── Agente Sofía (GPT-4o mini)
                          ├── check_availability → Wubook XML-RPC → Redis caché
                          ├── get_hotel_info     → datos configurables
                          ├── get_policies       → datos configurables
                          └── create_prereservation → PostgreSQL Neon
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
```

---

## Variables de entorno

```env
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Wubook
WUBOOK_TOKEN=wr_...
WUBOOK_LCODE=1234567890

# Redis — Upstash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# PostgreSQL — Neon
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Admin
ADMIN_TOKEN=tu-token-seguro

# Servidor (no requerido en Railway — se inyecta automáticamente)
PORT=3000
```

> ⚠️ Nunca subas el archivo `.env` al repositorio. Está incluido en `.gitignore`.

---

## Endpoints

### Status
```
GET /api/status
```

### Agente Sofía — Streaming SSE
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
Header: x-admin-token: tu-token
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

  window.SofiaConfig = {
    backendUrl:   'https://tu-backend.up.railway.app',
    hotelName:    'Hotel Mi Nombre',
    primaryColor: '#2E7DAF',   // opcional
    darkColor:    '#1a5f8a',   // opcional
    avatar:       '🌊',        // opcional
  };


```

---

## Estructura del proyecto

```
integra-hotel-ai/
├── src/
│   ├── index.ts                  # Servidor Express, rutas, SSE
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   └── asyncWrapper.ts
│   ├── services/
│   │   ├── sofia.ts              # Agente — chatWithSofia + streamWithSofia
│   │   ├── functions.ts          # Schemas de tools OpenAI
│   │   ├── functionExecutor.ts   # Ejecutor de herramientas
│   │   ├── wubook.ts             # Conector Wubook XML-RPC
│   │   ├── cache.ts              # Redis helper
│   │   ├── session.ts            # Sesiones Redis
│   │   └── ownDb.ts              # PostgreSQL Neon
│   └── utils/
│       └── dates.ts              # Validación y formateo de fechas
├── widget/
│   ├── embed.js                  # Script autocontenido — instalación 2 líneas
│   ├── sofia.js                  # Lógica del widget
│   ├── sofia.css                 # Estilos Coastal Light
│   └── dev.html                  # Página de desarrollo local
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Reglas críticas

**1. Wubook es SOLO LECTURA**
El conector nunca escribe en el channel manager. Toda escritura va a PostgreSQL Neon (base de datos propia).

**2. Caché antes que Wubook**
Toda consulta de disponibilidad pasa primero por Redis (TTL 15 min). Si Wubook falla, Sofía responde con datos de contacto del hotel — nunca un error técnico al huésped.

**3. Errores siempre como JSON**
El error handler global garantiza respuestas JSON en todos los casos, incluso en endpoints SSE.

---

## Plan de desarrollo

| Sesión | Descripción | Estado |
|--------|-------------|--------|
| 1–4 + limpieza | Setup, agente Sofía, widget, Wubook | ✅ |
| 5 | Streaming SSE | ✅ |
| 6 | Deploy producción Railway, CORS, auth | ✅ |
| 7 | Notificaciones email — Resend | ⬜ |
| 8 | Instalación en hotel piloto | ⬜ |
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












