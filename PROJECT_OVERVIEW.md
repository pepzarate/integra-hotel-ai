# PROJECT_OVERVIEW.md
**Integra Hotel AI**

---

## Nombre del proyecto

**Integra Hotel AI — Agente de Chat Sofía**

---

## Descripción general

Integra Hotel AI es un widget de chat con inteligencia artificial diseñado para hoteles 3-4★ en México. El widget se instala en el sitio web del hotel con dos líneas de código y despliega a Sofía, una asistente virtual que atiende huéspedes las 24 horas del día.

Sofía consulta disponibilidad y precios en tiempo real directamente desde el channel manager del hotel (Wubook), responde preguntas sobre servicios, políticas y distancias, captura pre-reservaciones en la base de datos propia del sistema, y notifica automáticamente al recepcionista por email.

---

## Objetivo principal

Que un hotel 3-4★ pueda capturar reservaciones fuera del horario de oficina sin contratar personal adicional, instalando el widget en su sitio web existente en menos de 5 minutos.

**Estado actual:** Widget en producción en el hotel piloto — `hotelfrontiere.com`.

**Meta de negocio:** Primer cobro recurrente (MRR) al cerrar la Sesión 10.

---

## Stack tecnológico

### Backend
| Tecnología | Uso |
|------------|-----|
| Node.js v22 + TypeScript | Servidor principal |
| Express | Framework HTTP, rutas y middlewares |
| OpenAI GPT-4o mini | Motor del agente Sofía — function calling + streaming |
| Upstash Redis | Caché de disponibilidad (TTL 15 min) y sesiones (TTL 30 min) |
| PostgreSQL — Neon | Base de datos propia para pre-reservaciones |
| Wubook XML-RPC | Fuente de disponibilidad y precios en tiempo real |
| Resend | Notificaciones email al recepcionista |

### Frontend (Widget)
| Tecnología | Uso |
|------------|-----|
| Vanilla JS | Lógica del widget sin dependencias |
| CSS custom | Diseño Coastal Light — colores configurables por hotel, DM Sans |
| Server-Sent Events | Streaming de tokens en tiempo real |
| embed.js | Script autocontenido — instala el widget con dos líneas |

### Infraestructura
| Tecnología | Uso |
|------------|-----|
| Railway | Deploy en producción con HTTPS automático |
| GitHub (privado) | Control de versiones — deploy automático desde `main` |
| WSL Ubuntu 22.04 | Entorno de desarrollo en Windows |

---

## Arquitectura general

```
Sitio web del hotel (hotelfrontiere.com)
  └── embed.js (2 líneas de instalación)
        └── Widget Sofía — colores y avatar del hotel
              └── GET /chat/stream (SSE)
                    └── Agente Sofía (GPT-4o mini)
                          ├── check_availability  → Wubook XML-RPC → Redis caché
                          ├── get_hotel_info      → datos del hotel configurados
                          ├── get_policies        → políticas del hotel
                          └── create_prereservation → PostgreSQL Neon → Email Resend
```

---

## Hotel piloto

| Campo | Valor |
|-------|-------|
| Nombre | Hotel Frontiere |
| Ubicación | Tijuana, Baja California |
| Sitio web | hotelfrontiere.com |
| Teléfono | (+52) 664 380 2830 |
| Colores widget | `#b8312f` / `#3e3e3e` |
| Estado | ✅ En producción |

---

## Modelo de negocio

| Plan | Precio | Incluye |
|------|--------|---------|
| Starter | $990 MXN/mes | 300 conversaciones, 1 idioma |
| Pro | $1,990 MXN/mes | 1,000 conversaciones, ES+EN, analytics |
| Enterprise | $3,500 MXN/mes | Ilimitado, WhatsApp, ElevenLabs |

---

## Estado actual de desarrollo

**Sesiones completadas: 8 de 10**

| Sesión | Descripción | Estado |
|--------|-------------|--------|
| 1 | Setup, entorno, conector PMS SOFTcalli | ✅ Completada |
| 2 | Agente Sofía, function calling, caché Redis | ✅ Completada |
| 3 | Validación de fechas, sesiones Redis, pre-reservaciones PostgreSQL | ✅ Completada |
| 4 | Widget Coastal Light, embed.js, pivote a Wubook | ✅ Completada |
| Limpieza | Pruebas edge, fallback Wubook, fechas limpias, deuda técnica | ✅ Completada |
| 5 | Streaming SSE, indicador de escritura, transición suave | ✅ Completada |
| 6 | Deploy Railway, HTTPS, CORS, auth prereservaciones | ✅ Completada |
| 7 | Email Resend, fix fechas mismo día, fix ocupación, datos Frontiere, system prompt v2, sugerencias | ✅ Completada |
| 8 | Colores, avatar favicon, CORP fix, instalación hotelfrontiere.com | ✅ Completada |
| 9 | Ajustes post-piloto — conversaciones reales, system prompt v3 | ⬜ Pendiente |
| 10 | Segundo hotel + primer MRR | ⬜ Pendiente |

---

## Funcionalidades activas

- ✅ Consulta de disponibilidad en tiempo real (Wubook) con caché Redis
- ✅ Filtrado por número de personas y agrupación de variantes de ocupación
- ✅ Precios por tipo de habitación en MXN
- ✅ Información general del hotel, servicios, distancias y políticas
- ✅ Validación de fechas con zona horaria del hotel (America/Tijuana)
- ✅ Reservación el mismo día permitida antes de las 20:00 hora local
- ✅ Captura de pre-reservaciones en PostgreSQL con folio único
- ✅ Notificación email al recepcionista via Resend
- ✅ Memoria de conversación por sesión (Redis, 30 min)
- ✅ Streaming de respuestas con SSE — primera palabra < 1s
- ✅ Widget embebible con dos líneas de código
- ✅ Avatar configurable — URL de imagen o emoji
- ✅ Colores corporativos configurables por hotel
- ✅ Sugerencias de preguntas rápidas al abrir el chat
- ✅ Fallback con datos de contacto si Wubook falla
- ✅ Autenticación en endpoint de pre-reservaciones

---

## Fuera del alcance — Fase 1

- Voz (Whisper + TTS / ElevenLabs)
- Dashboard de analytics
- Autenticación JWT / API Keys por hotel
- WhatsApp
- Configuración de hotel desde BD (datos hardcodeados en Fase 1)
- Reintentos automáticos de email fallido

---

## URLs del proyecto

| Recurso | URL |
|---------|-----|
| Backend producción | `https://integra-hotel-ai-production.up.railway.app` |
| Hotel piloto | `https://hotelfrontiere.com` |
| Repositorio | `https://github.com/pepzarate/integra-hotel-ai` (privado) |
| Rama producción | `main` |

---

*Última actualización: 14 de marzo 2026 — Sesión 8*
