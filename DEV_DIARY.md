# DEV_DIARY.md
**Integra Hotel AI — Agente de Chat Sofía**
Última actualización: 14 de marzo 2026 — Sesión 8

> Este documento es el tablero de estado del desarrollador. Responde una sola pregunta: ¿dónde está el proyecto ahora mismo? Se actualiza al cierre de cada sesión de trabajo.

---

## Estado general

```
Sesión actual:  8 de 10 completada
Fase:           1 — MVP Chat
Próxima sesión: 9 — Ajustes post-piloto
Bloqueadores:   Ninguno
URL producción: https://integra-hotel-ai-production.up.railway.app
Hotel piloto:   Hotel Frontiere — https://hotelfrontiere.com
```

---

## ✅ Implementado y funcionando

### Backend

- [x] Servidor Express con helmet, cors y morgan
- [x] `dotenv.config()` como primera instrucción — variables disponibles en todos los módulos
- [x] Endpoint `POST /chat` — respuesta síncrona (legacy, funcional)
- [x] Endpoint `GET /chat/stream` — streaming SSE con tokens en tiempo real
- [x] Endpoint `GET /prereservaciones` — últimos 50 registros con fechas limpias, protegido con `x-admin-token`
- [x] Endpoint `GET /api/status` — estado del servidor
- [x] Archivos estáticos del widget servidos desde `/widget/*`
- [x] Manejador global de errores (`errorHandler.ts`)
- [x] Wrapper async para rutas Express (`asyncWrapper.ts`)
- [x] CORS restringido por lista de dominios permitidos
- [x] `Cross-Origin-Resource-Policy: cross-origin` en rutas `/widget/*` — permite carga desde sitios externos
- [x] Autenticación básica en `/prereservaciones` via `x-admin-token`
- [x] Servidor escuchando en `0.0.0.0` para compatibilidad con Railway

### Agente Sofía

- [x] System prompt v2 — conciso, una pregunta a la vez, datos reales Hotel Frontiere
- [x] Fecha actual en zona `America/Tijuana` en el system prompt
- [x] `chatWithSofia()` — respuesta completa con function calling loop
- [x] `streamWithSofia()` — stream SSE con function calling loop y acumulación de tool calls fragmentados
- [x] 4 tools activos: `check_availability`, `get_hotel_info`, `get_policies`, `create_prereservation`
- [x] Timeout de 60 segundos en `/chat`

### Disponibilidad y precios (Wubook)

- [x] Conector XML-RPC via librería `xmlrpc`
- [x] `loadRoomCatalog()` — carga 13 tipos de habitación al arrancar el servidor
- [x] `fetchAvailability(entrada, salida, personas)` — filtra por ocupación, excluye cerradas y precios ficticios (≥9000)
- [x] Agrupación por nombre base — muestra solo la variante de ocupación mínima que satisface la búsqueda
- [x] Regex `/\s+\d+\s*pax$/i` para normalizar nombres con sufijos de ocupación
- [x] Caché Redis TTL 15 minutos por combinación de fechas
- [x] Fallback con datos de contacto del hotel cuando Wubook falla
- [x] Fechas convertidas a formato europeo `DD/MM/YYYY` para Wubook

### Validación de fechas

- [x] Rechazo de fechas pasadas con mensaje amigable
- [x] Reservación el mismo día permitida antes de las 20:00 hora Tijuana (`America/Tijuana`)
- [x] Mensaje de hora límite con teléfono del hotel cuando se intenta reservar después de las 20:00
- [x] Parámetro `_testHora` para pruebas sin esperar hora real
- [x] Rechazo cuando fecha de salida ≤ fecha de entrada
- [x] Rechazo de estancias mayores a 30 noches
- [x] Rechazo de formato inválido
- [x] Fix timezone UTC — comparación por string `YYYY-MM-DD` sin conversión a Date

### Sesiones y memoria

- [x] UUID v4 por conversación
- [x] Historial guardado en Redis TTL 30 minutos
- [x] Límite de 20 mensajes por sesión — los más antiguos se descartan
- [x] `session_id` devuelto en cada respuesta

### Pre-reservaciones

- [x] Tabla `prereservaciones` en PostgreSQL Neon
- [x] `initDb()` — crea la tabla si no existe al arrancar
- [x] Inserción con folio único `PRE-{timestamp}`
- [x] `status: 'pendiente'` por defecto
- [x] Fechas limpias `YYYY-MM-DD` sin desplazamiento UTC
- [x] Campo `fecha_prereservacion` en zona `America/Mexico_City`
- [x] Endpoint de lectura con `TO_CHAR` para formato limpio

### Notificaciones email (Resend)

- [x] `src/services/email.ts` — `sendPrereservacionEmail()`
- [x] Template HTML con datos del huésped, fechas, folio y footer de Integra Hotel AI
- [x] Remitente: `onboarding@resend.dev` (sandbox — pendiente verificación de dominio)
- [x] Disparado automáticamente después de inserción exitosa en BD
- [x] Fallo silencioso — si el email falla la pre-reservación no se revierte
- [x] Variables de entorno: `RESEND_API_KEY`, `HOTEL_NOTIFY_EMAIL`

### Widget — Hotel Frontiere

- [x] Botón flotante con colores del hotel (`#b8312f` / `#3e3e3e`)
- [x] Ventana 360×520px con tipografía DM Sans
- [x] Avatar con favicon del hotel via URL pública — configurable por hotel sin tocar código
- [x] `renderAvatar()` — detecta si `CONFIG.avatar` es URL o emoji y renderiza apropiadamente
- [x] Avatar de mensajes y typing con fondo blanco y borde gris (`#ffffff` / `#e8e8e8`)
- [x] Sugerencias rápidas al abrir el chat: "📅 Quiero reservar", "🕐 Check-in", "🛎️ Servicios"
- [x] Sugerencias desaparecen al enviar cualquier mensaje
- [x] Indicador de 3 puntos animados al enviar mensaje
- [x] Cursor parpadeante `▋` durante el stream — desaparece al terminar
- [x] Markdown parser: negritas y listas
- [x] Badge de notificación cuando widget está cerrado
- [x] Input deshabilitado mientras Sofía responde
- [x] Scroll automático al mensaje más reciente
- [x] Persistencia de `session_id` en `localStorage`

### Widget — embed.js

- [x] Script autocontenido que inyecta CSS + HTML + JS
- [x] Configurable via `window.SofiaConfig`
- [x] Instalación con dos líneas de código en cualquier sitio
- [x] Instalado en `hotelfrontiere.com` via Exur (constructor web)

### Infraestructura

- [x] Deploy en Railway con plan Hobby
- [x] HTTPS automático via Railway
- [x] Variables de entorno configuradas en Railway
- [x] Servidor escuchando en `0.0.0.0:PORT` — compatible con Railway
- [x] Puerto configurado en Railway Settings → 8080
- [x] Wubook respondiendo correctamente desde IP de Railway
- [x] `hotelfrontiere.com` y `www.hotelfrontiere.com` en lista `ALLOWED_ORIGINS`

### Datos del hotel configurados

- [x] Nombre: Hotel Frontiere
- [x] Dirección: Blvd. Gustavo Díaz Ordaz 13228, El Prado, 22105 Tijuana, B.C.
- [x] Teléfono: (+52) 664 380 2830
- [x] Email: hotelfrontieretijuana@gmail.com
- [x] Sitio web: hotelfrontiere.com
- [x] Servicios, distancias clave y políticas configuradas en `functionExecutor.ts`

---

## 🔵 En progreso

Ninguno — la Sesión 8 cerró limpia.

---

## ⬜ Pendiente — Sesión 9

### Ajustes post-piloto
- [ ] Revisar conversaciones reales — identificar errores o malentendidos de Sofía
- [ ] Ajustar system prompt con casos reales encontrados
- [ ] Revisar pre-reservaciones capturadas — calidad de datos
- [ ] Optimizar respuestas para preguntas frecuentes reales del hotel
- [ ] Verificar dominio de Resend para enviar desde `sofia@hotelfrontiere.com`
- [ ] Evaluar cambio de avatar — opciones discutidas: 🛎️, ✨ o favicon mejorado

---

## ⬜ Pendiente — Sesión 10

### Segundo hotel y primer MRR
- [ ] Generalizar configuración del hotel — mover datos hardcodeados a `SofiaConfig` o BD
- [ ] Ampliar regex de ocupación: cubrir `personas`, `person`, `huéspedes` además de `pax`
- [ ] Documentar proceso de onboarding para nuevo hotel
- [ ] Instalar en segundo hotel
- [ ] Emitir primera factura

---

## 🐛 Problemas conocidos

### BUG-01 — embed.js desactualizado ✅ RESUELTO — Sesión 6
**Fix aplicado:** Sincronización completa con `sofia.js`. 4 bugs corregidos: `BACKEND_URL` y `WELCOME_MSG` no definidas, clases CSS sin prefijo `sofia-`, `querySelector` con clase incorrecta.

---

### BUG-02 — Información del hotel hardcodeada
**Severidad:** Media
**Descripción:** Datos del hotel en `functionExecutor.ts` y `sofia.ts`. Para un segundo hotel hay que modificar código fuente.
**Estado:** Pendiente — Sesión 10
**Fix:** Mover a `SofiaConfig` o tabla de configuración en PostgreSQL

---

### BUG-03 — CORS abierto globalmente ✅ RESUELTO — Sesión 6
**Fix aplicado:** Lista `ALLOWED_ORIGINS` en `index.ts`.

---

### BUG-04 — Sin autenticación en endpoints sensibles ✅ RESUELTO — Sesión 6
**Fix aplicado:** Middleware `requireAdminToken` en `/prereservaciones`.

---

### BUG-05 — Catálogo Wubook requiere reinicio para actualizarse
**Severidad:** Baja
**Estado:** Aceptable para Fase 1
**Fix:** Recarga periódica del catálogo (cada 24h) — Fase 2

---

### BUG-06 — Código legacy SOFTcalli en package.json
**Severidad:** Baja
**Estado:** Aceptable para Fase 1
**Fix:** Eliminar junto con `pms.ts`, `explorer.ts` y `database.ts` — Fase 2

---

### BUG-07 — embed.js bloqueado por CORP en sitios externos ✅ RESUELTO — Sesión 8
**Descripción:** Al instalar el widget en `hotelfrontiere.com`, el navegador bloqueaba la carga de `embed.js` con `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`. Railway enviaba `Cross-Origin-Resource-Policy: same-origin` por defecto.
**Fix aplicado:** Middleware en `/widget/*` que inyecta `Cross-Origin-Resource-Policy: cross-origin` antes de `express.static`.
**Lección:** Para widgets embebibles cross-origin hay que configurar CORS **y** CORP — son mecanismos distintos.

---

### BUG-08 — Variantes de ocupación duplicadas en resultados ✅ RESUELTO — Sesión 7
**Descripción:** Para 3 personas, Sofía mostraba "Doble 3 pax" y "Doble 4 pax" porque ambas cumplen `occupancy >= 3`.
**Fix aplicado:** Agrupación por nombre base con regex `/\s+\d+\s*pax$/i`. Se conserva solo la variante de menor ocupación que satisfaga la búsqueda.
**Deuda pendiente:** El regex solo cubre sufijo `pax` — ampliar en Sesión 10.

---

## 📋 Deuda técnica

| ID | Descripción | Impacto | Sesión objetivo |
|----|-------------|---------|-----------------|
| DT-01 | `embed.js` y `sofia.js` duplican lógica — unificar con proceso de build | Alto | Fase 2 |
| DT-02 | `strict: false` en TypeScript | Alto | Fase 2 |
| DT-03 | Datos del hotel hardcodeados en `functionExecutor.ts` y `sofia.ts` | Medio | Sesión 10 |
| DT-04 | Archivos legacy activos: `pms.ts`, `explorer.ts`, `database.ts` | Bajo | Fase 2 |
| DT-05 | Dependencia `mssql` sin uso activo en `package.json` | Bajo | Fase 2 |
| DT-06 | Catálogo Wubook sin recarga periódica | Bajo | Fase 2 |
| DT-07 | Sin logs estructurados — solo `console.log` | Bajo | Fase 2 |
| DT-08 | Sin tests automatizados | Bajo | Fase 2 |
| DT-09 | Regex ocupación solo cubre `pax` — ampliar para otros sufijos | Medio | Sesión 10 |
| DT-10 | Remitente email en sandbox Resend — verificar dominio `hotelfrontiere.com` | Medio | Sesión 9 |

---

## 📊 Progreso por sesión

| Sesión | Fecha | Foco | Estado |
|--------|-------|------|--------|
| 1 | 06 mar | Setup + conector PMS SOFTcalli | ✅ |
| 2 | 09 mar | Agente Sofía + function calling + Redis | ✅ |
| 3 | 10 mar | Validaciones + sesiones + prereservaciones | ✅ |
| 4 | 10 mar | Widget Coastal Light + Wubook | ✅ |
| Limpieza | 11 mar | Deuda técnica + pruebas edge | ✅ |
| 5 | 11 mar | Streaming SSE + indicador escritura | ✅ |
| 6 | 12 mar | Deploy Railway + CORS + auth prereservaciones | ✅ |
| 7 | 12 mar | Email Resend + fix fechas + fix ocupación + datos Frontiere + system prompt v2 + sugerencias | ✅ |
| 8 | 14 mar | Colores + avatar + CORP fix + instalación hotelfrontiere.com | ✅ |
| 9 | — | Ajustes post-piloto | ⬜ |
| 10 | — | Segundo hotel + primer MRR | ⬜ |

---

## Sesión 7 — Notificaciones, validaciones y datos del hotel

**Fecha:** 12 de marzo 2026
**Horas trabajadas:** ~4 horas
**Estado al cierre:** ✅ Email al recepcionista funcionando, agente con datos reales del hotel piloto

### Lo que se construyó

**Notificaciones email con Resend:**
Se creó `src/services/email.ts` con `sendPrereservacionEmail()`. El template HTML incluye folio, datos del huésped, fechas, noches calculadas y notas. Se integró en `functionExecutor.ts` dentro del `case 'create_prereservation'` — el email se dispara después de la inserción exitosa en BD con fallo silencioso para no afectar la respuesta al huésped.

**Fix reservaciones el mismo día:**
La validación rechazaba el día de hoy porque comparaba contra UTC. Se reimplementó `validateDates` usando `Intl.DateTimeFormat` con `timeZone: 'America/Tijuana'`. Lógica nueva: si la fecha es hoy y son antes de las 20:00 → permitir. A las 20:01 → mensaje de hora límite con teléfono del hotel. Se agregó parámetro `_testHora` para pruebas.

**Fix variantes de ocupación duplicadas:**
Wubook devuelve variantes del mismo tipo con nombres como `"Doble Twin Superior 3 pax"` y `"Doble Twin Superior 4 pax"`. Fix: agrupar por nombre base extrayendo el sufijo con regex `/\s+\d+\s*pax$/i` y conservar solo la variante de menor ocupación que satisfaga la búsqueda.

**Datos reales Hotel Frontiere:**
`functionExecutor.ts` actualizado con dirección, teléfono, email, servicios, distancias clave y políticas reales. `sofia.ts` actualizado con system prompt v2 — conciso, una pregunta a la vez, fecha en zona `America/Tijuana`.

**Sugerencias rápidas en el widget:**
Tres botones al abrir el chat. Desaparecen al enviar cualquier mensaje. Implementados en CSS, HTML y JS en `sofia.js` y `embed.js`.

### Problemas encontrados

**Problema 1 — dev.html abriéndose como file://**
`Origin: null` llegaba al servidor y CORS lo bloqueaba.
*Solución:* Siempre acceder via `http://localhost:3000/widget/dev.html`.

**Problema 2 — Log aparentaba doble create_prereservation**
Artefacto del orden de impresión de logs concurrentes — el folio era el mismo en ambas líneas, confirmando una sola llamada.

### Registro de commits

```
fix: permitir reservación el mismo día antes de las 20:00 CDMX
fix: mostrar solo variante de ocupación mínima por tipo de habitación
feat: notificación email al recepcionista con Resend al crear pre-reservación
feat: datos Hotel Frontiere, system prompt v2, sugerencias rápidas, fix ocupación mínima
```

---

## Sesión 8 — Widget en producción en hotelfrontiere.com

**Fecha:** 14 de marzo 2026
**Horas trabajadas:** ~2 horas
**Estado al cierre:** ✅ Sofía atendiendo huéspedes en el sitio real del hotel piloto

### Lo que se construyó

**Personalización visual para Hotel Frontiere:**
Colores corporativos `#b8312f` y `#3e3e3e`. Avatar con favicon via URL pública. `renderAvatar()` en `embed.js` detecta si `CONFIG.avatar` es URL o emoji — escalable para cualquier hotel sin tocar código. Avatar de mensajes con fondo blanco para dar protagonismo al logo.

**Instalación en hotelfrontiere.com (Exur):**
Sitio construido con Exur. Widget instalado pegando las dos líneas de código en el campo de scripts personalizados del constructor.

**Fix CORP — Cross-Origin-Resource-Policy:**
`ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` al cargar `embed.js` desde `hotelfrontiere.com`. Railway enviaba `Cross-Origin-Resource-Policy: same-origin` por defecto.
*Fix:* Middleware en `index.ts` para rutas `/widget/*` que inyecta `Cross-Origin-Resource-Policy: cross-origin`.
*Lección:* Para widgets embebibles cross-origin hay que configurar CORS **y** CORP — son mecanismos distintos.

### Prueba end-to-end desde hotelfrontiere.com

```
Reservación completa: check_availability → create_prereservation → EMAIL enviado
Folio: PRE-1773539841551
Tiempo de respuesta promedio: 1.5–3.2 segundos desde el sitio real
```

### Registro de commits

```
feat: widget Hotel Frontiere — colores, favicon, sugerencias rápidas, system prompt v2
fix: agregar CORP cross-origin para permitir carga de embed.js desde sitios externos
```

---

*Próxima actualización: Sesión 9*
