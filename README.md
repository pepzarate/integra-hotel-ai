# Integra Hotel AI — Agente de Voz Sofía

Agente de voz con inteligencia artificial para hoteles 3-4★. Consulta disponibilidad en tiempo real desde el PMS del hotel, atiende huéspedes 24/7 y captura pre-reservaciones automáticamente.

---

## ¿Qué es esto?

**Sofía** es una asistente virtual hotelera que se conecta directamente al sistema de gestión del hotel (PMS) para responder preguntas de disponibilidad y tarifas con datos reales, sin inventar información.

El proyecto se entrega como un **widget embebible** que cualquier hotel puede instalar en su sitio web en minutos.

**Estado actual:** En desarrollo con hotel de prueba.

---

## Arquitectura

```
Widget (HTML/JS)
      ↓
  POST /chat
      ↓
  Agente Sofía (GPT-4o mini + Function Calling)
      ↓
  ┌──────────────────────────────────┐
  │  Function Executor               │
  │  ├── check_availability          │
  │  ├── get_room_rates              │
  │  ├── get_hotel_info              │
  │  ├── get_policies                │
  │  └── create_prereservation       │
  └──────────────────────────────────┘
        ↓                 ↓
   Redis (Upstash)    PMS Hotel (SQL Server)
   TTL: 5 min         Solo lectura ⚠️
```

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js v22 + TypeScript |
| Framework | Express |
| IA | OpenAI GPT-4o mini + Function Calling |
| PMS | SQL Server (mssql) |
| Caché | Redis — Upstash (REST) |
| Seguridad | Helmet + CORS |
| Logs | Morgan |
| Deploy | Railway / Render (próximamente) |

---

## Requisitos previos

- Node.js v18 o superior
- Acceso a una instancia de SQL Server con el PMS del hotel
- Cuenta en [Upstash](https://upstash.com) (tier gratuito funciona)
- API Key de [OpenAI](https://platform.openai.com)

---

## Instalación

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

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# SQL Server — PMS Hotel
DB_SERVER=192.168.x.x         # IP del servidor SQL desde WSL
DB_NAME=nombre_base_de_datos
DB_USER=tu_usuario
DB_PASSWORD=tu_password

# Redis — Upstash
UPSTASH_REDIS_REST_URL=https://tu-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=tu_token

# OpenAI
OPENAI_API_KEY=sk-tu-key

# Servidor
PORT=3000
```

> ⚠️ Nunca subas el archivo `.env` al repositorio. Está incluido en `.gitignore`.

---

## Endpoints disponibles

### API Status
```
GET /api/status
```
Verifica que el servidor y la conexión al PMS están activos.

### Agente Sofía
```
POST /chat
Content-Type: application/json

{
  "message": "¿Tienen habitación doble del 15 al 18 de marzo?",
  "history": []  // opcional — historial de mensajes anteriores
}
```

Respuesta:
```json
{
  "reply": "Sí, tenemos 4 habitaciones dobles disponibles...",
  "timestamp": "2026-03-09T14:00:00.000Z"
}
```

### Conector PMS
```
GET /pms/:idHotel/tipos
GET /pms/:idHotel/disponibilidad?entrada=YYYY-MM-DD&salida=YYYY-MM-DD
GET /pms/:idHotel/tarifas?entrada=YYYY-MM-DD&salida=YYYY-MM-DD
GET /pms/:idHotel/precios?entrada=YYYY-MM-DD&salida=YYYY-MM-DD
GET /pms/:idHotel/consulta?entrada=YYYY-MM-DD&salida=YYYY-MM-DD
```

### Explorador de Schema (desarrollo)
```
GET /explorer/tables
GET /explorer/tables/:name/columns
GET /explorer/tables/:name/sample
GET /explorer/search/tables/:keyword
GET /explorer/search/columns/:keyword
```

---

## Estructura del proyecto

```
integra-hotel-ai/
├── src/
│   ├── index.ts                  # Servidor Express y rutas
│   ├── middleware/
│   │   ├── errorHandler.ts       # Manejo global de errores
│   │   └── asyncWrapper.ts       # Wrapper para rutas async
│   └── services/
│       ├── database.ts           # Pool de conexión SQL Server
│       ├── explorer.ts           # Explorador de schema del PMS
│       ├── pms.ts                # Conector PMS — consultas reales
│       ├── cache.ts              # Caché Redis con Upstash
│       ├── functions.ts          # Schemas de function calling OpenAI
│       ├── functionExecutor.ts   # Ejecutor de herramientas de Sofía
│       └── sofia.ts              # Agente Sofía — lógica principal
├── .env                          # Credenciales (no en repo)
├── .env.example                  # Plantilla de variables
├── .gitignore
├── package.json
├── tsconfig.json
├── SCHEMA.md                     # Documentación del schema del PMS
└── DIARIO.md                     # Bitácora de desarrollo
```

---

## Reglas críticas de desarrollo

**1. El PMS es SOLO LECTURA**
Nunca escribir en la base de datos del PMS del cliente. Las pre-reservaciones se guardan en nuestra propia base de datos. Violar esta regla puede corromper datos reales del hotel.

**2. Caché antes que SQL**
Toda consulta al PMS pasa primero por Redis. TTL de 5 minutos. Si Redis falla, el sistema continúa consultando el PMS directamente sin interrumpirse.

**3. Errores siempre como JSON**
Ningún endpoint devuelve HTML de error. El error handler global garantiza respuestas JSON en todos los casos.

---

## Inventario de referencia — Hotel de prueba

El sistema soporta múltiples tipos de habitación configurables por hotel. Durante el desarrollo se trabaja con un hotel de prueba con tipos de habitación representativos del segmento 3-4★: habitaciones individuales, dobles, suites y categorías premium.

---

## Plan de desarrollo — 50 días

| Fase | Días | Estado |
|------|------|--------|
| 1 — Exploración & Setup | 1–10 | 🟡 En curso |
| 2 — Backend & Conector PMS | 11–20 | ⬜ Pendiente |
| 3 — IA & Voz | 21–30 | ⬜ Pendiente |
| 4 — Widget & Piloto | 31–40 | ⬜ Pendiente |
| 5 — Dashboard & Lanzamiento | 41–50 | ⬜ Pendiente |

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

*Construido con disciplina, un día a la vez.*