# REQUIREMENTS.md
**Integra Hotel AI — Agente de Chat Sofía**
Versión: 2.0 — 14 de marzo 2026

> Este documento consolida todos los requisitos funcionales y no funcionales definidos durante el desarrollo. Se actualiza al cierre de cada fase.

---

## Índice

1. [Agente Sofía](#1-agente-sofía)
2. [Disponibilidad y Precios](#2-disponibilidad-y-precios)
3. [Pre-reservaciones](#3-pre-reservaciones)
4. [Notificaciones Email](#4-notificaciones-email)
5. [Sesiones y Memoria](#5-sesiones-y-memoria)
6. [Widget](#6-widget)
7. [API y Servidor](#7-api-y-servidor)
8. [Seguridad](#8-seguridad)
9. [Rendimiento](#9-rendimiento)
10. [Operación y Mantenimiento](#10-operación-y-mantenimiento)
11. [Negocio y Modelo Comercial](#11-negocio-y-modelo-comercial)
12. [Fuera del Alcance — Fase 1](#12-fuera-del-alcance--fase-1)

---

## 1. Agente Sofía

### Funcionales

**RF-01** Sofía responde en el idioma del huésped — español o inglés — sin configuración adicional.

**RF-02** Sofía nunca inventa precios ni disponibilidad. Toda información de inventario debe provenir de una fuente de datos real en tiempo real.

**RF-03** Sofía puede ejecutar múltiples function calls en secuencia dentro de una misma respuesta cuando el contexto lo requiera.

**RF-04** Sofía solicita al huésped las fechas antes de cotizar precios — nunca cotiza sin fechas confirmadas.

**RF-05** Sofía solicita al huésped el número de personas para filtrar correctamente las opciones de habitación.

**RF-06** Sofía llama `create_prereservation` exactamente una vez por flujo de reservación — solo cuando el huésped confirma explícitamente su intención de reservar.

**RF-07** Sofía responde preguntas sobre información general del hotel: nombre, dirección, teléfono, email, sitio web, servicios y distancias a puntos de interés.

**RF-08** Sofía responde preguntas sobre políticas: horario de check-in/check-out, cancelaciones, mascotas, fumadores y formas de pago.

**RF-09** Cuando Wubook no está disponible, Sofía informa al huésped y proporciona los datos de contacto directo del hotel en lugar de mostrar un error técnico.

**RF-10** El timeout máximo de una respuesta completa es de 60 segundos. Si se excede, el huésped recibe un mensaje de error amigable.

**RF-11** Sofía hace máximo una pregunta por mensaje — nunca lanza dos o más preguntas en el mismo turno.

**RF-12** Las respuestas de Sofía son concisas — máximo 3 líneas salvo que el huésped solicite más detalle.

### No Funcionales

**RNF-01** El modelo base es GPT-4o mini — balance entre calidad de respuesta y costo por conversación.

**RNF-02** El system prompt incluye la fecha actual en zona horaria del hotel (`America/Tijuana`) en cada sesión.

**RNF-03** `strict: false` en TypeScript durante Fase 1. Activar `strict: true` antes del deploy de Fase 2.

---

## 2. Disponibilidad y Precios

### Funcionales

**RF-13** La fuente de disponibilidad y precios es Wubook (channel manager) — no el PMS interno del hotel.

**RF-14** `check_availability` devuelve en una sola llamada: nombre de habitación, ocupación máxima, precio por noche en MXN y número de habitaciones disponibles.

**RF-15** Las habitaciones con `closed: 1` en Wubook se excluyen del resultado aunque tengan `avail > 0`.

**RF-16** Los precios iguales o mayores a $9,000 MXN se consideran ficticios (convención de Wubook) y se excluyen del resultado.

**RF-17** La disponibilidad real de un rango de fechas es el mínimo de `avail` entre todos los días del período.

**RF-18** Los resultados se filtran por número de personas — solo se muestran habitaciones cuya ocupación máxima sea mayor o igual al número de huéspedes.

**RF-19** Cuando existen múltiples variantes del mismo tipo de habitación con distinta ocupación (ej. "Doble 3 pax" y "Doble 4 pax"), se muestra únicamente la variante de menor ocupación que satisfaga la búsqueda. El agrupamiento se realiza por nombre base eliminando el sufijo de ocupación.

**RF-20** El catálogo de tipos de habitación se carga dinámicamente desde Wubook al arrancar el servidor — no está hardcodeado.

**RF-21** Wubook recibe las fechas en formato europeo `DD/MM/YYYY` — la conversión desde `YYYY-MM-DD` es responsabilidad del conector.

**RF-22** Los precios se muestran siempre en pesos mexicanos con el símbolo `$` y formato de miles con coma.

### No Funcionales

**RNF-04** Los resultados de disponibilidad se cachean en Redis con TTL de 15 minutos por combinación de `lcode + fecha_entrada + fecha_salida`.

**RNF-05** El conector Wubook es SOLO LECTURA. No se realizan escrituras en el channel manager bajo ninguna circunstancia.

**RNF-06** Tiempo de respuesta objetivo con caché HIT: < 500ms. Sin caché (MISS): < 2,000ms.

---

## 3. Pre-reservaciones

### Funcionales

**RF-23** Las pre-reservaciones se guardan en una base de datos propia (PostgreSQL Neon) — nunca en el PMS ni en el channel manager del hotel.

**RF-24** Cada pre-reservación genera un folio único con formato `PRE-{timestamp}`.

**RF-25** Los campos obligatorios de una pre-reservación son: folio, nombre completo, email, teléfono, tipo de habitación, fecha de entrada, fecha de salida y número de personas.

**RF-26** El campo `notas` es opcional — captura cualquier solicitud especial del huésped.

**RF-27** Toda pre-reservación se crea con `status: 'pendiente'` — el hotel confirma o rechaza manualmente.

**RF-28** El endpoint `GET /prereservaciones` devuelve los últimos 50 registros ordenados por fecha de creación descendente.

**RF-29** Las fechas en la respuesta del endpoint se devuelven en formato `YYYY-MM-DD` sin sufijo de zona horaria.

**RF-30** El campo `fecha_prereservacion` registra la fecha y hora exacta de creación en zona horaria `America/Mexico_City` con formato `YYYY-MM-DD HH24:MI:SS`.

### No Funcionales

**RNF-07** La base de datos propia es PostgreSQL serverless en Neon — sin servidor que administrar.

**RNF-08** Las fechas se almacenan como tipo `DATE` en PostgreSQL. Al insertar se aplica `split('T')[0]` para evitar desplazamiento UTC.

**RNF-09** La columna `fecha_prereservacion` es `TIMESTAMP WITH TIME ZONE DEFAULT NOW()` — se registra automáticamente sin intervención del agente.

---

## 4. Notificaciones Email

### Funcionales

**RF-31** Al crear una pre-reservación exitosa, el sistema envía automáticamente un email de notificación al recepcionista del hotel.

**RF-32** El email incluye: folio, nombre completo del huésped, email, teléfono, tipo de habitación, fecha de entrada, fecha de salida, número de noches, número de personas y notas (si existen).

**RF-33** El email incluye un footer que identifica al sistema como "Sofía — Integra Hotel AI" y una nota aclarando que es una pre-reservación pendiente de confirmación.

**RF-34** Si el envío del email falla, la pre-reservación no se revierte — el error se loguea y el flujo continúa normalmente (fallo silencioso).

**RF-35** El destinatario del email es configurable via variable de entorno `HOTEL_NOTIFY_EMAIL`.

### No Funcionales

**RNF-10** El proveedor de email es Resend — SDK oficial para Node.js.

**RNF-11** El remitente actual es `onboarding@resend.dev` (sandbox). En Sesión 9 se verifica el dominio del hotel para usar un remitente personalizado.

**RNF-12** El email se envía después de la inserción exitosa en BD — no antes. El email nunca bloquea la respuesta al huésped.

---

## 5. Sesiones y Memoria

### Funcionales

**RF-36** Cada conversación tiene un `session_id` único generado como UUID v4.

**RF-37** El historial de mensajes se mantiene durante toda la conversación para que Sofía recuerde el contexto previo.

**RF-38** El `session_id` se devuelve en cada respuesta del endpoint `/chat/stream` para que el cliente lo persista.

**RF-39** El widget guarda el `session_id` en `localStorage` bajo la clave `sofia_session_id` — sobrevive recargas de página.

**RF-40** Si el cliente no envía `session_id`, el servidor genera uno nuevo automáticamente.

### No Funcionales

**RNF-13** El historial de sesión se guarda en Redis (Upstash) con TTL de 1,800 segundos (30 minutos).

**RNF-14** El historial se limita a los últimos 20 mensajes para no exceder el context window de OpenAI. Los mensajes más antiguos se descartan primero.

**RNF-15** Las sesiones expiran automáticamente — no requieren limpieza manual.

---

## 6. Widget

### Funcionales

**RF-41** El widget se instala en cualquier sitio web con dos líneas de código: un bloque de configuración `window.SofiaConfig` y un tag `<script src="embed.js">`.

**RF-42** `window.SofiaConfig` acepta los parámetros: `backendUrl`, `hotelName`, `primaryColor`, `darkColor`, `avatar` y `welcomeMsg`.

**RF-43** El parámetro `avatar` acepta tanto una URL de imagen (`https://...`) como un emoji — el widget detecta el tipo y renderiza apropiadamente.

**RF-44** El widget es completamente autocontenido — inyecta su propio CSS, HTML y JS sin depender de librerías externas del sitio huésped.

**RF-45** El widget muestra un indicador de 3 puntos animados mientras espera el primer token de respuesta.

**RF-46** Al recibir el primer token, el indicador de 3 puntos se reemplaza por la burbuja de respuesta y los tokens aparecen en tiempo real.

**RF-47** Al terminar la respuesta completa, el cursor parpadeante `▋` desaparece automáticamente.

**RF-48** El input del huésped se deshabilita mientras Sofía está respondiendo — se reactiva al recibir `done: true`.

**RF-49** El widget muestra un badge rojo de notificación cuando hay un mensaje nuevo de Sofía y el widget está cerrado.

**RF-50** El widget parsea markdown básico en las respuestas: negritas con `**texto**` y listas con `- item`.

**RF-51** El widget hace scroll automático al mensaje más reciente en cada actualización.

**RF-52** La sesión persiste entre recargas de página gracias a `localStorage`.

**RF-53** Al abrir el widget por primera vez, se muestran 3 botones de sugerencia de preguntas rápidas. Los botones desaparecen al enviar cualquier mensaje.

**RF-54** Las sugerencias rápidas configuradas para Hotel Frontiere son: "📅 Quiero reservar una habitación", "🕐 ¿A qué hora es el check-in?", "🛎️ ¿Qué servicios incluye el hotel?".

### No Funcionales

**RNF-16** Los colores del widget son configurables por hotel via `SofiaConfig.primaryColor` y `SofiaConfig.darkColor`.

**RNF-17** El widget para Hotel Frontiere usa los colores corporativos: `#b8312f` (rojo) y `#3e3e3e` (gris oscuro).

**RNF-18** El avatar de los mensajes de Sofía tiene fondo blanco (`#ffffff`) con borde gris (`#e8e8e8`) para dar protagonismo al logo del hotel.

**RNF-19** Los estilos del widget están encapsulados con prefijo `sofia-` para evitar colisiones con el CSS del sitio del hotel.

**RNF-20** La fuente DM Sans se inyecta vía `<link>` al `<head>` del documento huésped.

**RNF-21** El botón flotante tiene 60px de tamaño, esquina inferior derecha, border-radius de 20px.

**RNF-22** La ventana del chat es de 360×520px con border-radius de 24px.

**RNF-23** Content Security Policy (CSP) desactivado selectivamente solo para rutas `/widget/*` en el servidor.

---

## 7. API y Servidor

### Funcionales

**RF-55** `GET /api/status` — devuelve estado del servidor y timestamp. No expone información de servicios internos.

**RF-56** `POST /chat` — endpoint legacy síncrono. Mantiene compatibilidad pero no se usa en el widget activo.

**RF-57** `GET /chat/stream` — endpoint SSE principal. Recibe `message` y `session_id` como query params y devuelve tokens en tiempo real.

**RF-58** `GET /prereservaciones` — devuelve los últimos 50 registros con fechas limpias, protegido con header `x-admin-token`.

**RF-59** `GET /widget/*` — sirve archivos estáticos del widget con header `Cross-Origin-Resource-Policy: cross-origin`.

### No Funcionales

**RNF-24** El servidor usa helmet para headers de seguridad HTTP en todas las rutas.

**RNF-25** CORS restringido por lista `ALLOWED_ORIGINS` — los dominios no incluidos reciben error. Por dominio nuevo de hotel se agrega a la lista antes del deploy.

**RNF-26** Las rutas `/widget/*` incluyen el header `Cross-Origin-Resource-Policy: cross-origin` — requerido para que `embed.js` se cargue desde dominios externos.

**RNF-27** Morgan registra todos los requests en consola en formato `dev`.

**RNF-28** El catálogo de habitaciones de Wubook se carga al arrancar el servidor — si falla, el servidor continúa con una advertencia, no con un crash.

**RNF-29** La tabla `prereservaciones` se inicializa automáticamente al arrancar si no existe (`CREATE TABLE IF NOT EXISTS`).

**RNF-30** `dotenv.config()` es la primera instrucción de `index.ts` — antes de cualquier import.

**RNF-31** El servidor escucha en `0.0.0.0` (no `localhost`) para ser alcanzable desde Railway.

---

## 8. Seguridad

### Funcionales

**RF-60** Las credenciales del hotel piloto nunca se incluyen en el repositorio — solo en `.env` local y en variables de Railway.

**RF-61** El repositorio incluye `.env` en `.gitignore`.

**RF-62** El endpoint `GET /prereservaciones` requiere el header `x-admin-token` con el valor configurado en `ADMIN_TOKEN`. Sin token válido devuelve 401.

### No Funcionales

**RNF-32** Wubook es SOLO LECTURA. Prohibido realizar escrituras via API bajo ninguna circunstancia.

**RNF-33** Las API Keys se revocan y regeneran inmediatamente si se exponen accidentalmente en cualquier canal.

**RNF-34** Las variables de entorno en Railway se configuran sin comillas — las comillas se tratan como parte del valor y rompen la conexión a servicios externos.

**RNF-35** Autenticación JWT por hotel — fuera del alcance Fase 1, requerida antes de escalar a múltiples hoteles.

---

## 9. Validación de Fechas

### Funcionales

**RF-63** Se rechazan fechas de entrada anteriores a la fecha actual con mensaje amigable.

**RF-64** Se permite reservar para el mismo día si la hora actual en zona del hotel es anterior a las 20:00. Después de las 20:00 se rechaza con mensaje de hora límite y teléfono del hotel.

**RF-65** Se rechazan fechas de salida iguales o anteriores a la fecha de entrada.

**RF-66** Se rechazan estancias mayores a 30 noches.

**RF-67** Se rechazan fechas con formato inválido con mensaje de ayuda.

### No Funcionales

**RNF-36** La zona horaria para validación de fechas es `America/Tijuana` — configurable por hotel en Fase 2.

**RNF-37** La fecha actual se obtiene via `Intl.DateTimeFormat` con la zona horaria del hotel — nunca via `new Date()` directo para evitar ambigüedad UTC.

**RNF-38** Las fechas se comparan como strings `YYYY-MM-DD` sin conversión a objetos `Date` para evitar desplazamiento de zona horaria.

---

## 10. Rendimiento

### No Funcionales

**RNF-39** Primera palabra visible en el widget: < 1,000ms desde que el huésped envía el mensaje (objetivo streaming).

**RNF-40** Tiempo de respuesta con caché HIT en Wubook: < 500ms.

**RNF-41** Tiempo de respuesta con caché MISS en Wubook: < 2,000ms.

**RNF-42** Timeout máximo del endpoint `/chat/stream`: 60 segundos.

**RNF-43** TTL de caché Wubook: 15 minutos.

**RNF-44** TTL de sesiones Redis: 30 minutos de inactividad.

---

## 11. Operación y Mantenimiento

### No Funcionales

**RNF-45** El proyecto incluye `DEV_DIARY.md` — bitácora de desarrollo actualizada al cierre de cada sesión.

**RNF-46** El proyecto incluye `ARCHITECTURE.md` — decisiones técnicas documentadas con razonamiento.

**RNF-47** El proyecto incluye `README.md` — instalación, variables de entorno, endpoints y guía de instalación del widget.

**RNF-48** El proyecto incluye `PROJECT_OVERVIEW.md` — resumen ejecutivo del estado actual.

**RNF-49** El proyecto incluye `REQUIREMENTS.md` — este documento.

**RNF-50** Cada sesión de desarrollo cierra con un commit descriptivo siguiendo la convención `tipo: descripción` (feat, fix, docs, refactor).

**RNF-51** La rama principal de producción es `main` — Railway despliega automáticamente desde `main` en cada push.

---

## 12. Negocio y Modelo Comercial

### Funcionales

**RF-68** El sistema soporta múltiples hoteles desde la arquitectura — cada hotel con su propio `lcode` de Wubook y configuración de widget.

**RF-69** El widget es configurable por hotel sin modificar el código fuente — solo `window.SofiaConfig`.

**RF-70** Para instalar en un nuevo hotel se requiere: agregar su dominio a `ALLOWED_ORIGINS`, configurar `HOTEL_NOTIFY_EMAIL` y actualizar los datos del hotel en `functionExecutor.ts` y `sofia.ts` (temporal hasta Sesión 10).

### No Funcionales

**RNF-52** El objetivo de la Sesión 9 es revisar conversaciones reales del piloto y ajustar el system prompt.

**RNF-53** El objetivo de la Sesión 10 es el primer cobro recurrente (MRR) con al menos un segundo hotel.

**RNF-54** El costo operativo por hotel en plan Starter debe mantenerse por debajo del 30% del precio mensual cobrado.

---

## 13. Fuera del Alcance — Fase 1

Los siguientes requisitos están identificados pero explícitamente excluidos del desarrollo hasta la Fase 2:

| Funcionalidad | Justificación |
|---------------|---------------|
| Voz (Whisper + TTS / ElevenLabs) | Requiere infraestructura de audio — post-piloto |
| Dashboard de analytics | Necesita volumen de datos real para ser útil |
| Autenticación JWT / API Keys por hotel | Necesario antes de escalar a múltiples hoteles |
| WhatsApp | Canal adicional con integraciones propias |
| Panel de gestión de inventario | El hotel gestiona su inventario en Wubook |
| Configuración de hotel desde BD o SofiaConfig | Datos hardcodeados en Fase 1 — generalizar en Sesión 10 |
| Reintentos automáticos de email fallido | Fallo silencioso aceptable en Fase 1 |
| Recarga periódica del catálogo Wubook | Reinicio manual aceptable en Fase 1 |
| TypeScript strict mode | Activar en Fase 2 |

---

*Última actualización: Sesión 8 — 14 de marzo 2026*
