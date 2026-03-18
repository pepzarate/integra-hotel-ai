# ARCHITECTURE.md
**Integra Hotel AI — Agente de Chat Sofía**
Versión: 2.0 — 14 de marzo 2026

> Este documento describe la arquitectura del sistema: estructura de archivos, decisiones técnicas tomadas, patrones utilizados y el razonamiento detrás de cada decisión importante. Es una referencia viva — se actualiza cuando la arquitectura evoluciona.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Diagrama de arquitectura](#2-diagrama-de-arquitectura)
3. [Estructura de archivos](#3-estructura-de-archivos)
4. [Capas del sistema](#4-capas-del-sistema)
5. [Decisiones de arquitectura](#5-decisiones-de-arquitectura)
6. [Patrones utilizados](#6-patrones-utilizados)
7. [Flujos principales](#7-flujos-principales)
8. [Variables de entorno](#8-variables-de-entorno)
9. [Deuda técnica conocida](#9-deuda-técnica-conocida)

---

## 1. Visión general

El sistema está compuesto por tres piezas independientes que se comunican entre sí:

- **Backend Node.js** — servidor Express que aloja el agente Sofía, gestiona sesiones y expone los endpoints SSE
- **Widget frontend** — script autocontenido que se instala en el sitio del hotel y se comunica con el backend vía HTTP
- **Servicios externos** — Wubook (disponibilidad), OpenAI (IA), Redis Upstash (caché y sesiones), PostgreSQL Neon (pre-reservaciones), Resend (email)

El backend nunca escribe en los sistemas del hotel (PMS ni channel manager). Toda escritura va a la base de datos propia.

---

## 2. Diagrama de arquitectura

```
┌─────────────────────────────────────────────────────┐
│          Sitio web del hotel (hotelfrontiere.com)    │
│                                                      │
│   <script> window.SofiaConfig = { ... } </script>   │
│   <script src="embed.js"></script>                   │
│                                                      │
│   ┌──────────────────────────────────────────────┐  │
│   │           Widget Sofía (Coastal Light)        │  │
│   │  embed.js (autocontenido — CSS + HTML + JS)   │  │
│   └──────────────────┬───────────────────────────┘  │
└──────────────────────│──────────────────────────────┘
                       │ GET /chat/stream (SSE)
                       │ tokens en tiempo real
┌──────────────────────▼──────────────────────────────┐
│         Backend — Node.js + Express (Railway)        │
│                                                      │
│  index.ts                                            │
│    ├── POST /chat            (legacy síncrono)       │
│    ├── GET  /chat/stream     (SSE — activo)          │
│    ├── GET  /prereservaciones (protegido x-admin)    │
│    ├── GET  /api/status                              │
│    └── GET  /widget/*        (CORP: cross-origin)    │
│                                                      │
│  services/                                           │
│    ├── sofia.ts              Agente + function loop  │
│    ├── functionExecutor.ts   Ejecutor de tools       │
│    ├── functions.ts          Schemas OpenAI tools    │
│    ├── wubook.ts             Conector XML-RPC        │
│    ├── cache.ts              Redis helper            │
│    ├── session.ts            Sesiones Redis          │
│    ├── ownDb.ts              PostgreSQL Neon         │
│    └── email.ts              Notificaciones Resend   │
└──────┬──────────┬──────────────┬─────────────────────┘
       │          │              │
       ▼          ▼              ▼
  ┌─────────┐ ┌───────┐   ┌──────────────┐
  │ OpenAI  │ │Wubook │   │ Redis Upstash│
  │GPT-4o   │ │XML-RPC│   │ caché+sesión │
  │  mini   │ │       │   │              │
  └─────────┘ └───┬───┘   └──────────────┘
                  │              │
            ┌─────▼──────┐ ┌────▼──────┐
            │  PostgreSQL │ │  Resend   │
            │    Neon     │ │  email    │
            │prereserv.   │ │notificac. │
            └────────────┘ └───────────┘
```

---

## 3. Estructura de archivos

```
integra-hotel-ai/
│
├── src/
│   ├── index.ts                  # Entrada principal — Express, rutas, app.listen
│   │
│   ├── middleware/
│   │   ├── errorHandler.ts       # Manejador global de errores
│   │   └── asyncWrapper.ts       # Wrapper para async/await en rutas Express
│   │
│   ├── services/
│   │   ├── sofia.ts              # Agente Sofía — chatWithSofia + streamWithSofia
│   │   ├── functions.ts          # Schemas de tools para OpenAI function calling
│   │   ├── functionExecutor.ts   # Ejecutor de tools — lógica de cada función
│   │   ├── wubook.ts             # Conector Wubook XML-RPC + caché Redis
│   │   ├── cache.ts              # Redis helper — cacheGet, cacheSet, cacheKey
│   │   ├── session.ts            # Sesiones Redis — UUID, historial, TTL
│   │   ├── ownDb.ts              # PostgreSQL Neon — prereservaciones
│   │   ├── email.ts              # Notificaciones email — Resend
│   │   ├── database.ts           # Pool mssql SOFTcalli (legacy, no activo)
│   │   ├── explorer.ts           # Explorador schema SOFTcalli (legacy, no activo)
│   │   └── pms.ts                # Conector PMS SOFTcalli (legacy, no activo)
│   │
│   └── utils/
│       └── dates.ts              # validateDates, formatDateMX, calcularNoches
│
├── widget/
│   ├── embed.js                  # ★ Script autocontenido — instalación 2 líneas
│   ├── sofia.js                  # Lógica del widget — streaming, sesión, markdown
│   ├── sofia.css                 # Estilos Coastal Light
│   ├── dev.html                  # Página de desarrollo — acceder via localhost:3000
│   └── test-embed.html           # Prueba de instalación con embed.js
│
├── .env                          # Variables de entorno — NO en git
├── .env.example                  # Plantilla de variables — SÍ en git
├── .gitignore
├── package.json
├── tsconfig.json
├── DEV_DIARY.md
├── PROJECT_OVERVIEW.md
├── REQUIREMENTS.md
├── ARCHITECTURE.md               # Este archivo
└── README.md
```

---

## 4. Capas del sistema

El sistema está organizado en cuatro capas con responsabilidades claras:

### Capa 1 — Transporte (index.ts)
Recibe requests HTTP, valida parámetros básicos, gestiona el ciclo de vida SSE y delega al agente. No contiene lógica de negocio. También configura headers de seguridad (CORS, CORP) por ruta.

### Capa 2 — Agente (sofia.ts)
Coordina la conversación con OpenAI. Mantiene el loop de function calling y, en la versión streaming, emite tokens via callback. No sabe nada de HTTP ni de bases de datos.

### Capa 3 — Herramientas (functionExecutor.ts + functions.ts)
Traduce las intenciones del agente en acciones concretas: consultar Wubook, guardar en PostgreSQL, enviar email, devolver información del hotel. Es la única capa que conoce los servicios externos.

### Capa 4 — Servicios (wubook.ts, cache.ts, session.ts, ownDb.ts, email.ts)
Conectores a servicios externos. Cada archivo tiene una responsabilidad única y no conoce las capas superiores.

---

## 5. Decisiones de arquitectura

---

### DA-01 — Wubook como fuente de disponibilidad (no SOFTcalli)

**Fecha:** Sesión 4 — 10 de marzo 2026

**Contexto:**
El conector original usaba SQL Server (SOFTcalli PMS) para obtener disponibilidad y precios. Las queries requerían JOINs entre 6 tablas y tardaban entre 1,800ms y 5,000ms en frío.

**Decisión:**
Reemplazar SOFTcalli como fuente de disponibilidad por Wubook, el channel manager que el hotel ya usa para publicar en Booking.com y Expedia.

**Razonamiento:**
- Wubook devuelve disponibilidad + precios en una sola llamada (~800ms)
- Wubook es la fuente de verdad del inventario — es lo que el hotel publica al mundo
- SOFTcalli puede tener datos desincronizados si el hotel actualiza precios directamente en el channel manager
- El costo del pivote fue de ~2 horas — bajo costo, alto impacto en rendimiento

**Consecuencias:**
- Los archivos `pms.ts`, `explorer.ts` y `database.ts` quedaron como código legacy
- Los endpoints `/pms/*` y `/explorer/*` se eliminaron de `index.ts`
- La dependencia a SQL Server (mssql) sigue en `package.json` — candidata a eliminarse en Fase 2

---

### DA-02 — Streaming SSE en lugar de respuesta síncrona

**Fecha:** Sesión 5 — 11 de marzo 2026

**Contexto:**
El endpoint `POST /chat` devolvía la respuesta completa cuando OpenAI terminaba de generarla — el usuario veía una pantalla en blanco durante 2-4 segundos y luego el texto completo de golpe.

**Decisión:**
Agregar `GET /chat/stream` con Server-Sent Events. El endpoint `POST /chat` se mantiene como legacy para compatibilidad.

**Razonamiento:**
- La percepción de velocidad mejora drásticamente — el primer token aparece en ~700ms
- SSE es más simple que WebSockets para comunicación unidireccional
- Compatible con todos los navegadores modernos sin librería adicional
- GET en lugar de POST por compatibilidad con `fetch` + `ReadableStream` en el cliente

**Consecuencias:**
- `streamWithSofia()` requiere acumular tool calls fragmentados — OpenAI envía los argumentos de cada función en múltiples chunks
- El widget necesita lógica de buffer para parsear los eventos SSE línea por línea

---

### DA-03 — PostgreSQL Neon para pre-reservaciones (base de datos propia)

**Fecha:** Sesión 3 — 10 de marzo 2026

**Contexto:**
Las pre-reservaciones deben persistirse en algún lugar. El PMS del hotel (SOFTcalli) es solo lectura por regla de negocio. Wubook no tiene API de escritura habilitada.

**Decisión:**
PostgreSQL serverless en Neon como base de datos propia para pre-reservaciones.

**Razonamiento:**
- Serverless — sin servidor que administrar, escala a cero cuando no hay uso
- Tier gratuito generoso para Fase 1
- PostgreSQL estándar — sin lock-in, migrable a cualquier proveedor
- Latencia aceptable desde Railway (~50-80ms)
- La regla "el backend nunca escribe en sistemas del hotel" se mantiene intacta

**Consecuencias:**
- Dos bases de datos en el sistema — Neon (nuestra) y Wubook (del hotel, solo lectura)
- Las fechas deben insertarse como string `YYYY-MM-DD` para evitar desplazamiento UTC de PostgreSQL

---

### DA-04 — Redis Upstash para caché y sesiones

**Fecha:** Sesión 2 — 9 de marzo 2026

**Contexto:**
Dos necesidades distintas: cachear respuestas de Wubook para no hacer XML-RPC en cada mensaje, y guardar el historial de conversación entre requests HTTP stateless.

**Decisión:**
Upstash Redis REST para ambas necesidades — caché de disponibilidad (TTL 15 min) y sesiones de conversación (TTL 30 min).

**Razonamiento:**
- Un solo servicio para dos necesidades — menor complejidad operativa
- Upstash REST no requiere conexión TCP persistente — compatible con entornos serverless
- TTL nativo de Redis — las sesiones expiran automáticamente sin jobs de limpieza
- Tier gratuito suficiente para Fase 1

**Consecuencias:**
- Las Redis keys incluyen `lcode` del hotel como prefijo para evitar colisiones entre hoteles futuros
- Latencia adicional de ~50-100ms por request — aceptable dado que el bottleneck real es OpenAI

---

### DA-05 — embed.js autocontenido sin dependencias de build

**Fecha:** Sesión 4 — 10 de marzo 2026

**Contexto:**
El widget debe instalarse en cualquier sitio web — WordPress, Wix, Shopify, HTML estático — sin que el hotel necesite un proceso de build o acceso al código fuente.

**Decisión:**
`embed.js` es un IIFE (Immediately Invoked Function Expression) que inyecta dinámicamente CSS, HTML y JS en el documento huésped. Configurable via `window.SofiaConfig`.

**Razonamiento:**
- Instalación con dos líneas de código — cero fricción para el hotel
- Sin dependencias de framework — funciona en cualquier entorno
- Patrón probado por Intercom, Crisp, Drift y otros widgets comerciales
- `window.SofiaConfig` como contrato de configuración — el hotel personaliza sin tocar el script

**Consecuencias:**
- `embed.js` y `sofia.js` duplican lógica — cualquier cambio debe replicarse en ambos archivos
- En Fase 2 se debe implementar un proceso de build que genere `embed.js` desde `sofia.js` automáticamente

---

### DA-06 — CORS + CORP para widgets cross-origin

**Fecha:** Sesión 8 — 14 de marzo 2026

**Contexto:**
Al instalar el widget en `hotelfrontiere.com`, el navegador bloqueaba la carga de `embed.js` con `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` aunque CORS estaba configurado correctamente.

**Decisión:**
Configurar tanto CORS como `Cross-Origin-Resource-Policy: cross-origin` en las rutas `/widget/*`.

**Razonamiento:**
- CORS controla qué dominios pueden hacer `fetch` al servidor
- CORP controla qué dominios pueden cargar el recurso como `<script>`, `<img>`, etc.
- Ambos mecanismos son independientes — un recurso puede pasar CORS y fallar CORP
- Railway inyecta `Cross-Origin-Resource-Policy: same-origin` por defecto en archivos estáticos
- Solo las rutas `/widget/*` necesitan `cross-origin` — el resto del API mantiene la política restrictiva por defecto

**Consecuencias:**
- Middleware dedicado en `/widget/*` que inyecta el header antes de `express.static`
- CORS sigue restringido por `ALLOWED_ORIGINS` — CORP y CORS son configuraciones independientes
- Para cada nuevo hotel hay que agregar su dominio a `ALLOWED_ORIGINS`

---

### DA-07 — Validación de fechas con zona horaria explícita

**Fecha:** Sesión 7 — 12 de marzo 2026

**Contexto:**
`new Date('2026-03-15')` en Node.js se interpreta como medianoche UTC, que en zona horaria de México/Tijuana es el día anterior. Esto causaba que fechas válidas fueran rechazadas como "pasadas".

**Decisión:**
Usar `Intl.DateTimeFormat` con `timeZone: 'America/Tijuana'` para obtener la fecha y hora actuales en la zona del hotel. Comparar fechas como strings `YYYY-MM-DD` sin conversión a `Date`.

**Razonamiento:**
- `America/Tijuana` es la zona correcta para Hotel Frontiere — UTC-8 estándar / UTC-7 verano
- `Intl.DateTimeFormat` está disponible nativamente en Node.js — sin librerías externas
- Comparar strings `YYYY-MM-DD` directamente elimina la ambigüedad de UTC
- La hora límite de reservación (20:00) se evalúa en hora local del hotel — correcto desde la perspectiva del huésped

**Consecuencias:**
- La zona horaria está hardcodeada como `America/Tijuana` en `dates.ts` — en Fase 2 debe ser configurable por hotel
- Se agregó parámetro `_testHora` para poder probar los tres escenarios (antes/después de las 20:00, día pasado) sin esperar la hora real

---

### DA-08 — renderAvatar() como patrón configurable por hotel

**Fecha:** Sesión 8 — 14 de marzo 2026

**Contexto:**
El avatar del widget estaba hardcodeado como el emoji 🌊. Para Hotel Frontiere se quiso usar el favicon del hotel. En el futuro cada hotel tendrá su propio logo o emoji.

**Decisión:**
Función `renderAvatar(el)` que detecta si `CONFIG.avatar` es una URL (`startsWith('http')`) o un emoji/texto, y renderiza un `<img>` o `textContent` apropiadamente.

**Razonamiento:**
- El hotel configura su avatar con una sola línea en `SofiaConfig.avatar`
- Sin tocar el código del widget para cambiar entre URL e emoji
- Escalable para múltiples hoteles con distintos tipos de avatar
- El `<img>` con `border-radius: 50%` y `object-fit: cover` produce un resultado visual consistente con el diseño del widget

**Consecuencias:**
- La URL del favicon debe ser pública y accesible — si el CDN del hotel cambia la URL, el avatar deja de mostrarse
- En Fase 2 se puede agregar un fallback al emoji del `SofiaConfig` si la imagen falla (`img.onerror`)

---

### DA-09 — Notificaciones email con fallo silencioso

**Fecha:** Sesión 7 — 12 de marzo 2026

**Contexto:**
Al crear una pre-reservación, el recepcionista debe ser notificado por email. Si el servicio de email falla, ¿debe fallar también la pre-reservación?

**Decisión:**
El email se dispara después de la inserción exitosa en BD. Si falla, se loguea el error pero la pre-reservación no se revierte — fallo silencioso desde la perspectiva del huésped.

**Razonamiento:**
- La pre-reservación ya está guardada en BD — el hotel puede consultarla en `/prereservaciones`
- Revertir una inserción por un fallo de email degradaría la experiencia del huésped innecesariamente
- El email es una notificación de conveniencia, no un requisito crítico del flujo
- El log de error permite detectar y corregir el problema de email sin pérdida de datos

**Consecuencias:**
- En Fase 2 considerar un sistema de reintentos para emails fallidos
- El recepcionista debe tener el hábito de revisar `/prereservaciones` como respaldo si el email no llega

---

### DA-10 — GPT-4o mini como modelo base

**Fecha:** Sesión 2 — 9 de marzo 2026

**Contexto:**
OpenAI ofrece varios modelos con diferentes relaciones costo/capacidad. El agente necesita manejar function calling, contexto de conversación y responder en español e inglés.

**Decisión:**
GPT-4o mini como modelo principal en todas las llamadas a OpenAI.

**Razonamiento:**
- GPT-4o mini soporta function calling completo — mismo que GPT-4o
- Costo ~10x menor que GPT-4o por token — crítico para el margen en plan Starter ($990 MXN/mes)
- Latencia menor que GPT-4o — mejora la experiencia de streaming
- Calidad suficiente para el caso de uso: reservaciones de hotel, no análisis complejo

**Consecuencias:**
- En conversaciones muy largas o con instrucciones ambiguas, GPT-4o mini puede fallar donde GPT-4o no fallaría
- Migración a GPT-4o disponible como palanca de calidad si hay quejas en producción

---

### DA-11 — `strict: false` en TypeScript durante Fase 1

**Fecha:** Sesión 1 — 6 de marzo 2026

**Contexto:**
TypeScript con `strict: true` requiere tipos explícitos en todo el código y es más restrictivo con `any`. En un proyecto en exploración rápida esto genera fricciones constantes.

**Decisión:**
`strict: false` durante Fase 1. Activar `strict: true` antes del deploy de Fase 2.

**Razonamiento:**
- La Fase 1 es de exploración y construcción rápida — el costo de tipar todo correctamente supera el beneficio en esta etapa
- Los errores que `strict: true` previene son manejables con pruebas manuales en este volumen de código
- Activar `strict: true` cuando el código está estable es más eficiente que pelear con TypeScript durante el diseño

**Consecuencias:**
- Hay varios `any` explícitos en el código que deberán tipificarse antes de Fase 2
- Los callbacks de tool calls en `sofia.ts` usan `any` por diseño (variante no estándar del tipo OpenAI)

---

## 6. Patrones utilizados

### Cache-Aside
**Dónde:** `cache.ts`, `wubook.ts`
Buscar en Redis primero. Si existe (HIT), devolver el valor cacheado. Si no existe (MISS), consultar la fuente de datos real, guardar el resultado en Redis con TTL y devolverlo. Reduce la carga en Wubook y mejora el tiempo de respuesta en consultas repetidas.

---

### Function Calling Loop
**Dónde:** `sofia.ts` — `chatWithSofia()` y `streamWithSofia()`
Llamar a OpenAI con tools disponibles. Si el modelo responde con `finish_reason: 'tool_calls'`, ejecutar las funciones, agregar los resultados al historial y volver a llamar a OpenAI. Repetir hasta `finish_reason: 'stop'`. Permite encadenar múltiples consultas en una sola respuesta.

---

### Middleware Chain
**Dónde:** `index.ts`, `middleware/`
Cada request pasa por una cadena de middlewares (dotenv → helmet → cors → morgan → routes → errorHandler) antes de llegar a la lógica de negocio. El `asyncWrapper` elimina la necesidad de try/catch en cada route handler.

---

### Embedded Widget Pattern
**Dónde:** `widget/embed.js`
IIFE que al cargarse inyecta dinámicamente CSS, HTML y JS en el documento huésped. Configurable via `window.SofiaConfig`. Instalación con dos líneas de código sin dependencias del framework del sitio huésped.

---

### Server-Sent Events (SSE)
**Dónde:** `index.ts` — `GET /chat/stream`, `widget/sofia.js`
El servidor mantiene una conexión HTTP abierta y envía eventos `data: {...}` conforme se generan. Más simple que WebSockets para comunicación unidireccional servidor→cliente.

---

### Silent Failure para servicios no críticos
**Dónde:** `functionExecutor.ts` — `create_prereservation`
Operaciones secundarias (email) se envuelven en try/catch independiente. Si fallan, se loguea el error pero el flujo principal no se interrumpe. La pre-reservación siempre llega a BD aunque el email falle.

---

## 7. Flujos principales

### Flujo 1 — Consulta de disponibilidad con streaming

```
Usuario escribe → Widget deshabilita input →
  GET /chat/stream?message=...&session_id=... →
    Recuperar historial de Redis →
      streamWithSofia(message, history, onToken) →
        OpenAI stream → finish_reason: 'tool_calls' →
          executeTool('check_availability', args) →
            validateDates() — zona America/Tijuana →
              Redis MISS → Wubook XML-RPC →
                Redis SET (TTL 15min) →
                  Agrupar variantes por nombre base →
                    Resultado → OpenAI continúa stream →
                      finish_reason: 'stop' →
                        tokens → data: {"token":"..."} → Widget renderiza →
                          data: {"done":true} →
                            appendToSession(Redis) →
                              Widget habilita input
```

### Flujo 2 — Pre-reservación completa

```
Sofía detecta intención de reservar →
  Sofía solicita datos faltantes (nombre, email, teléfono) →
    Usuario proporciona datos →
      OpenAI → finish_reason: 'tool_calls' →
        executeTool('create_prereservation', args) →
          insertPrereservacion(PostgreSQL Neon) →
            folio PRE-{timestamp} generado →
              sendPrereservacionEmail() — fallo silencioso si falla →
                Sofía confirma al usuario con folio
```

### Flujo 3 — Fallo de servicio externo

```
check_availability →
  Wubook XML-RPC falla (timeout / auth error) →
    catch(err) en functionExecutor →
      return "problema técnico — contactar al hotel: tel + email" →
        Sofía recibe el mensaje de error →
          Sofía comunica al usuario con datos de contacto →
            POST /chat → 200 (no 500)
```

### Flujo 4 — Carga del widget en sitio externo

```
hotelfrontiere.com carga embed.js →
  GET /widget/embed.js →
    Middleware inyecta Cross-Origin-Resource-Policy: cross-origin →
      express.static sirve el archivo →
        Navegador ejecuta IIFE →
          renderAvatar() — detecta URL vs emoji →
            Widget inyectado en el DOM →
              initSuggestions() al primer open →
                Usuario interactúa
```

---

## 8. Variables de entorno

| Variable | Servicio | Descripción |
|----------|----------|-------------|
| `OPENAI_API_KEY` | OpenAI | Clave de API para GPT-4o mini |
| `WUBOOK_TOKEN` | Wubook | Token de autenticación XML-RPC |
| `WUBOOK_LCODE` | Wubook | Código de propiedad del hotel en Wubook |
| `UPSTASH_REDIS_REST_URL` | Redis Upstash | URL del endpoint REST de Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Redis Upstash | Token de autenticación Redis |
| `DATABASE_URL` | PostgreSQL Neon | Connection string completo con `?sslmode=require` |
| `RESEND_API_KEY` | Resend | Clave de API para envío de emails |
| `HOTEL_NOTIFY_EMAIL` | Resend | Email del recepcionista que recibe notificaciones |
| `ADMIN_TOKEN` | Backend | Token para autenticar requests a `/prereservaciones` |
| `PORT` | Express | Puerto del servidor — Railway lo inyecta automáticamente |

**Variables legacy (SOFTcalli — no usar):**
`DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

---

## 9. Deuda técnica conocida

| ID | Descripción | Prioridad | Sesión objetivo |
|----|-------------|-----------|-----------------|
| DT-01 | `embed.js` y `sofia.js` duplican lógica — unificar con proceso de build | Alta | Fase 2 |
| DT-02 | `strict: false` en TypeScript — activar en Fase 2 | Alta | Fase 2 |
| DT-03 | Datos del hotel hardcodeados en `functionExecutor.ts` y `sofia.ts` | Media | Sesión 10 |
| DT-04 | Archivos legacy activos: `pms.ts`, `explorer.ts`, `database.ts` | Baja | Fase 2 |
| DT-05 | Dependencia `mssql` sin uso activo en `package.json` | Baja | Fase 2 |
| DT-06 | Catálogo Wubook sin recarga periódica — reinicio requerido para actualizar | Baja | Fase 2 |
| DT-07 | Sin logs estructurados — solo `console.log` | Baja | Fase 2 |
| DT-08 | Sin tests automatizados | Baja | Fase 2 |
| DT-09 | Regex ocupación solo cubre sufijo `pax` — ampliar para `personas`, `person`, etc. | Media | Sesión 10 |
| DT-10 | Remitente email en sandbox Resend — verificar dominio `hotelfrontiere.com` | Media | Sesión 9 |
| DT-11 | Zona horaria hardcodeada como `America/Tijuana` en `dates.ts` | Media | Sesión 10 |
| DT-12 | Sin fallback de imagen en `renderAvatar()` si la URL del favicon falla | Baja | Fase 2 |

---

*Última actualización: Sesión 8 — 14 de marzo 2026*
