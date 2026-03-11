# DIARIO.md — Bitácora de Desarrollo
**Integra Hotel AI — Agente de Chat Sofía**
Autor: Pepe Zárate

> Este diario documenta el proceso de construcción día a día: decisiones técnicas, problemas encontrados, soluciones aplicadas y aprendizajes. Es tanto una referencia técnica como un registro personal del proyecto.

---

## Día 0 — Antes de empezar

**Fecha:** Febrero 2026

### Contexto

La idea nació de observar un problema real en hoteles 3-4★ de México: el teléfono de reservaciones no siempre está disponible, los correos tardan en responderse y los huéspedes potenciales se pierden fuera del horario de oficina. Los hoteles en este segmento no tienen presupuesto para un equipo de reservaciones 24/7, pero sí necesitan capturar cada oportunidad.

La solución: un agente de voz con IA que se conecta directamente al PMS del hotel y atiende huéspedes en tiempo real, cualquier hora del día.

### Decisiones iniciales

**Nombre del agente:** Sofía. Cálido, reconocible, suena humano en voz alta. Se evaluaron otras opciones (Alma, Vera, Luma) pero Sofía ganó por su connotación de inteligencia y calidez simultáneas.

**Nombre de la empresa:** Integra Hotel AI.

**Stack elegido:** Node.js + TypeScript + Express para el backend. OpenAI GPT-4o mini para la IA — buena relación costo/rendimiento para el volumen esperado. Redis (Upstash) para caché. SQL Server para conectar con el PMS del hotel de prueba.

**Modelo de negocio:**
- Starter: $990 MXN/mes
- Pro: $1,990 MXN/mes
- Enterprise: $3,500 MXN/mes

**Plan original:** 50 días de desarrollo divididos en 5 fases. 5 horas de trabajo diario.

---

## Día 1 — El conector PMS

**Fecha:** Viernes 6 de marzo 2026
**Horas trabajadas:** ~8 horas (me emocioné y pasé del límite)
**Estado al cierre:** ✅ Conector PMS funcional con datos reales

### Lo que construí

Arrancé desde cero. En una sola sesión logré:

- Entorno de desarrollo completo: WSL Ubuntu 22.04, Node.js v22, TypeScript, nodemon
- Estructura de carpetas del proyecto con separación por responsabilidad
- Conexión a SQL Server del hotel de prueba verificada y funcional
- Exploración completa del schema: 156 tablas documentadas
- Conector PMS con 5 endpoints funcionando con datos reales:
  - `/api/status`
  - `/pms/:idHotel/tipos`
  - `/pms/:idHotel/disponibilidad`
  - `/pms/:idHotel/tarifas`
  - `/pms/:idHotel/consulta`

### Problemas encontrados

**Problema 1 — Timeout en query de precios**
La query de `getPreciosPorTipo` con múltiples JOINs excedió el timeout de 30 segundos por defecto de mssql. El servidor devolvía HTML de error en lugar de JSON, lo que rompía `json_pp` en terminal.

*Solución:* Aumentar `requestTimeout` a 60,000ms en la configuración del pool. También optimicé la query para filtrar solo tarifas RACK y máximo 2 adultos, reduciendo el volumen de datos significativamente.

**Problema 2 — `tbSOFTcalli_Reservas` no es lo que parece**
Al explorar el schema encontré una tabla que por nombre parecía ser el registro de reservaciones web. Al samplear su contenido resultó ser configuración de integración FTP — credenciales de servidor, rutas de archivos. Nada útil para el agente.

*Aprendizaje:* En bases de datos heredadas los nombres de tablas no siempre reflejan su contenido. Siempre samplear antes de asumir.

**Problema 3 — `strStatus = 'E'` en `tbPrecioAdultos`**
En toda la base de datos el valor activo es `strStatus = 'A'`. En `tbPrecioAdultos` es `'E'`. Sin este detalle la query de precios devolvía cero resultados.

*Aprendizaje:* Inconsistencias de schema en sistemas PMS legacy son comunes. Documentar cada excepción encontrada en SCHEMA.md.

### Decisión importante

**SOFTcalli es SOLO LECTURA.** Esta regla quedó grabada desde el Día 1. Toda escritura (pre-reservaciones, logs, métricas) irá a nuestra propia base de datos. Jamás tocar el PMS del cliente.

### Reflexión del día

Logré demasiado en un solo día. La emoción de ver datos reales del hotel apareciendo en el terminal fue muy motivante, pero trabajar 8 horas seguidas no es sostenible. Decidí en este momento que el proyecto debe ser una prueba de disciplina, no de velocidad.

---

## Día de descanso — Sábado 7 de marzo 2026

**Actividad:** Reflexión, documentación y aprendizaje. Sin código.

### Lo que hice

- Redacté el SCHEMA.md — documentación completa de las 6 tablas principales del conector
- Estudié los conceptos técnicos del proyecto: TypeScript estricto, patrones de caché, middlewares de Express
- Tomé la evaluación de 30 preguntas del Día 1 — resultado: 74% (Suficiente)
- Identifiqué mis áreas de oportunidad: TypeScript (1/4), SQL Server (4/6)

### Resultado de la evaluación por categoría

| Categoría | Resultado | Nota |
|-----------|-----------|------|
| TypeScript | 1/4 | Área crítica a reforzar |
| Express | 2/3 | Conceptual, no práctico |
| SQL Server | 4/6 | Detalles finos del schema |
| Schema | 4/4 | Lo que hice con las manos |
| Arquitectura | 4/4 | Lo que hice con las manos |
| Metodología | 2/3 | Conceptual |
| Redis | 2/3 | Falta práctica |
| Herramientas | 4/4 | Lo que hice con las manos |

**Patrón identificado:** Todo lo práctico = 100%. Todo lo conceptual = área de oportunidad. Aprendo haciendo.

### Temas estudiados

**Errores comunes de TypeScript:**
- `TS2345` — tipo incompatible en argumentos (el más frecuente en el proyecto)
- `TS2304` — nombre no encontrado, generalmente import faltante
- `TS2352` — cast incorrecto, solución: `as unknown[]`
- `TS2339` — propiedad inexistente en tipo

**strict: true vs strict: false:**
Arrancamos con `false` para velocidad de desarrollo. Activar `strict: true` en staging cuando el código sea estable.

**cors, helmet, morgan:**
- `cors` — controla qué dominios pueden llamar la API. Crítico cuando el widget esté en el dominio del hotel.
- `helmet` — headers de seguridad HTTP automáticos. Sin configuración adicional.
- `morgan` — logs de requests en consola. Esencial para debugging.

**Redis y caché:**
- Patrón cache-aside: buscar en Redis primero, si MISS consultar SQL y guardar resultado
- TTL de 5 minutos: balance entre datos frescos y no sobrecargar el PMS
- Upstash como Redis serverless: sin servidor que mantener, acceso vía REST

### Reflexión

El descanso fue productivo de una manera diferente. Entender el *por qué* de las decisiones técnicas que tomé el Día 1 hace que el código tenga más sentido. No es solo copy-paste — es arquitectura con intención.

---

## Día 2 — Sofía cobra vida

**Fecha:** Lunes 9 de marzo 2026
**Horas trabajadas:** ~5 horas
**Estado al cierre:** ✅ Sofía responde con datos reales de disponibilidad y precios

### Lo que construí

**Morgan integrado:** Logs de requests en consola desde el primer request. Ahora cada llamada al servidor muestra método, ruta, status y tiempo de respuesta. Debugging mucho más visual.

**cors y helmet agregados:** Faltaban en el `index.ts` original. Ahora el servidor tiene headers de seguridad y control de origen desde el arranque.

**Caché Redis con Upstash:**
- `src/services/cache.ts` con funciones `cacheGet`, `cacheSet`, `cacheKey`
- TTL de 300 segundos (5 minutos)
- Integrado en `consultarDisponibilidadCompleta`
- Primera consulta: MISS → va a SQL Server (~1,800ms)
- Segunda consulta: HIT → responde desde Redis (~720ms)

**Function Calling schemas:**
Definí los 5 tools de OpenAI que Sofía puede usar:
1. `check_availability` — consulta disponibilidad real del PMS
2. `get_room_rates` — obtiene precios RACK por tipo y fechas
3. `get_hotel_info` — información general del hotel
4. `get_policies` — políticas de check-in, cancelación, etc.
5. `create_prereservation` — registra intención de reserva

**Agente Sofía:**
- `src/services/sofia.ts` con system prompt, loop de function calling y manejo de historial
- `src/services/functionExecutor.ts` con la lógica de ejecución de cada tool
- Endpoint `POST /chat` en `index.ts`
- Timeout global de 30 segundos en el endpoint `/chat`

### Problemas encontrados

**Problema 1 — TS2339 en sofia.ts**
TypeScript no aceptaba `toolCall.function.arguments` porque el tipo `ChatCompletionMessageToolCall` incluye una variante que no tiene propiedad `.function`.

*Solución:* Agregar `.filter((toolCall: any) => toolCall.type === 'function')` antes del `.map()`, y tipar los callbacks como `any`.

**Problema 2 — Primera consulta siempre timeout**
El primer request siempre fallaba porque el pool de SQL no estaba inicializado y la query de precios era pesada.

*Solución:* El `requestTimeout: 60000ms` ya estaba aplicado. El segundo request funcionó al tener el pool caliente. El caché absorbe las consultas siguientes.

### Pruebas end-to-end realizadas

| Prueba | Input | Comportamiento | Herramienta usada |
|--------|-------|---------------|-------------------|
| 1 | "Hola, buenas tardes" | Saludo natural sin tools | Ninguna |
| 2 | "¿Tienen habitación doble del 15 al 18 de marzo?" | Interpretó fechas, consultó PMS, respondió con disponibilidad real | `check_availability` |
| 3 | "¿Cuánto cuesta una suite?" | Pidió fechas antes de cotizar | Ninguna (correcto) |
| 4 | "¿Y cuánto cuesta la doble para esas fechas?" | Recordó contexto, cotizó $1,760 MXN/noche | `get_room_rates` |
| 5 | "¿A qué hora es el check-in?" | Respondió "15:00 hrs" desde políticas | `get_policies` |

**Resultado más importante:** En la Prueba 4, Sofía respondió con el precio correcto directamente desde el PMS — sin inventarlo. Ese es el diferenciador del producto.

### Decisiones técnicas del día

**¿Por qué no usar Claude Code?**
Evaluado y descartado para esta etapa. El flujo de VSCode + terminal + copy-paste funciona bien con el tamaño actual del proyecto. Revisitar cuando el proyecto tenga 15-20 archivos interconectados.

**`create_prereservation` en memoria por ahora:**
La función genera un folio `PRE-{timestamp}` y registra en logs pero no persiste en BD. Decisión consciente — en el Día 3 se conectará a una base de datos propia.

### Reflexión

El momento más satisfactorio del día: ver en el log `[TOOL] Ejecutando: check_availability` seguido de `[CACHE] HIT` y luego la respuesta de Sofía con el número exacto de habitaciones disponibles. Tres sistemas (OpenAI, Redis, SQL Server) coordinándose para dar una respuesta útil a un huésped.

---

## Día 3 — Memoria, validaciones y pre-reservaciones

**Fecha:** Martes 10 de marzo 2026
**Horas trabajadas:** ~5 horas
**Estado al cierre:** ✅ Sofía recuerda la conversación y guarda pre-reservaciones en PostgreSQL

### Lo que construí

**Validación de fechas (`src/utils/dates.ts`):**
Sofía comenzó a aceptar fechas pasadas y fechas con errores de formato sin quejarse — simplemente las consultaba al PMS y obtenía resultados vacíos o incorrectos. Se implementó un módulo dedicado de validaciones:
- Rechazo de fechas pasadas con mensaje amigable
- Rechazo cuando salida ≤ entrada
- Rechazo de estancias mayores a 30 noches
- Formato inválido con mensaje de ayuda

El bug más sutil: al comparar fechas, `new Date('2026-03-10')` en Node.js se interpreta como medianoche UTC, que en zona horaria de México es el día anterior. Se corrigió comparando solo la parte de fecha en string (`YYYY-MM-DD`) sin convertir a Date.

**Sesiones con Redis (`src/services/session.ts`):**
Cada conversación genera un UUID único. El historial de mensajes se guarda en Redis con TTL de 1,800 segundos (30 minutos). Al superar 20 mensajes, se recortan los más antiguos para no exceder el context window de OpenAI. El `session_id` se devuelve en cada respuesta del `/chat` y el widget lo guarda en `localStorage` para mantener continuidad entre recargas de página.

**Pre-reservaciones en PostgreSQL (`src/services/ownDb.ts`):**
Se eligió Neon como proveedor de PostgreSQL serverless — sin servidor que administrar, tier gratuito generoso, latencia aceptable desde México. La tabla `prereservaciones` guarda: folio único, datos del huésped, tipo de habitación, fechas, personas, notas y status. La regla del Día 1 se mantiene: todo lo que escribimos va a nuestra BD, jamás al PMS del cliente.

### Problemas encontrados

**Problema 1 — Doble pre-reservación en una sola conversación**
Sofía llamaba `create_prereservation` dos veces en algunos flujos — una al confirmar los datos y otra al dar el resumen final.

*Solución:* Se ajustó el system prompt para que `create_prereservation` se llame exactamente una vez, solo cuando el huésped confirma explícitamente que desea reservar.

**Problema 2 — Fechas guardadas con desplazamiento UTC**
PostgreSQL recibía `'2026-03-25'` como string pero al devolverlo lo serializaba como `2026-03-25T06:00:00.000Z` — 6 horas de diferencia por la zona horaria del servidor de Neon.

*Solución:* Se aplicó `.split('T')[0]` al guardar y `TO_CHAR` en la query de lectura. Corregido definitivamente en la sesión de limpieza.

### Reflexión

La sesión de hoy fue más tranquila que las anteriores — menos código nuevo, más robustez en lo que ya existía. Las validaciones son invisibles cuando funcionan, pero son lo que separa un prototipo de un producto. Un huésped que escribe "del 5 al 3 de marzo" no debe recibir un stack trace.

---

## Día 4 — El widget Sofía: Coastal Light

**Fecha:** Martes 10 de marzo 2026 (segunda sesión del día)
**Horas trabajadas:** ~4 horas
**Estado al cierre:** ✅ Widget embebible funcionando en cualquier sitio web con una línea de código

### Lo que construí

**Widget Sofía — Coastal Light:**
El widget es la cara visible del producto — lo que el huésped del hotel ve e interactúa. Se diseñó bajo el concepto "Coastal Light": azules oceánicos, tipografía DM Sans, bordes redondeados generosos. Profesional pero accesible, no corporativo.

Componentes del widget:
- `widget/sofia.css` — todos los estilos encapsulados, sin colisión con el CSS del hotel
- `widget/sofia.js` — lógica completa: apertura/cierre, envío de mensajes, renderizado de respuestas, indicador de escritura, badge de notificación
- `widget/dev.html` — página de prueba con fondo de hotel simulado para desarrollo visual
- `widget/embed.js` — ⭐ script autocontenido que inyecta CSS + HTML + JS en cualquier página con una sola línea

**Instalación en cualquier sitio:**
```html
<script>
  window.SofiaConfig = { backendUrl: 'https://...', hotelName: 'Mi Hotel' };
</script>
<script src="embed.js"></script>
```

Eso es todo. El widget se monta solo, sin dependencias, sin frameworks.

**Markdown parser propio:**
Se implementó un parser minimalista que convierte `**texto**` en `<strong>` y `- item` en elementos de lista, sin importar ninguna librería externa. Peso total del widget: ~8KB.

**Persistencia de sesión:**
El `session_id` se guarda en `localStorage` bajo la clave `sofia_session_id`. Si el huésped recarga la página, Sofía recuerda la conversación. La sesión expira a los 30 minutos de inactividad.

### Decisión técnica importante — Pivote a Wubook

Durante el Día 4 se tomó la decisión más importante del proyecto hasta ahora: **reemplazar SOFTcalli como fuente de disponibilidad por Wubook**.

**¿Por qué?**
- Las consultas a SQL Server tardaban 1,800–5,000ms en frío, inaceptable para conversación fluida
- El schema de SOFTcalli requería JOINs complejos entre 6 tablas para disponibilidad + precios
- Wubook es el channel manager que el hotel ya usa — los datos ahí son la fuente de verdad
- La API de Wubook devuelve disponibilidad + precios en una sola llamada (~800ms)

**Costo del pivote:** Dos horas de trabajo. Se creó `src/services/wubook.ts`, se actualizó `functionExecutor.ts` y se eliminó la dependencia de SQL Server para disponibilidad.

**Conector Wubook (`src/services/wubook.ts`):**
- Protocolo XML-RPC via librería `xmlrpc` npm
- Catálogo de 13 tipos de habitación cargado dinámicamente al arrancar el servidor
- `fetchAvailability(entrada, salida, personas)` — filtra por ocupación, excluye cerradas y precios ficticios (≥9000), calcula disponibilidad mínima del rango
- Caché Redis con TTL de 15 minutos por combinación de fechas

### Problemas encontrados

**Problema 1 — CSP bloqueaba la fuente DM Sans**
Helmet bloqueaba la carga de Google Fonts con Content-Security-Policy.

*Solución:* Deshabilitar CSP selectivamente solo para rutas `/widget/*`.

**Problema 2 — Event listeners en inline handlers**
El primer draft usaba `onclick="..."` directamente en el HTML inyectado, causando conflictos.

*Solución:* Reescribir todos los event listeners usando `addEventListener` después de que el DOM esté montado.

**Problema 3 — Precio `9999` aparecía en habitaciones "disponibles"**
Wubook usa `price: 9999` como valor ficticio para habitaciones cerradas. El filtro solo revisaba `closed: 1` pero no el precio.

*Solución:* Agregar `&& h.price < 9000` al filtro de disponibilidad.

### Reflexión

El pivote a Wubook fue la decisión correcta — no solo por rendimiento, sino porque conectar al channel manager es más honesto con los datos. Ese es el número que el hotel publica al mundo; ese es el número que el huésped debería ver.

El widget funcionando por primera vez en `test-embed.html` — una página en blanco con solo dos líneas de script — fue el momento más cinematográfico del proyecto hasta ahora.

---

## Sesión de limpieza — Antes de la Fase 2

**Fecha:** Miércoles 11 de marzo 2026
**Tipo:** Sesión de calidad y deuda técnica (sin features nuevas)
**Estado al cierre:** ✅ Código limpio, pruebas completas, listo para deploy

### Motivación

Antes de pasar a la Fase 2 (deploy a producción, streaming, notificaciones) se hizo una pausa para verificar integridad, probar casos edge y eliminar deuda técnica acumulada. La regla: no llevar código sucio a producción.

### Pruebas realizadas

| Prueba | Escenario | Resultado |
|--------|-----------|-----------|
| 1 | Pre-reservación completa end-to-end | ✅ Datos guardados correctamente en PostgreSQL |
| 2 | Fecha pasada (5-7 marzo) | ✅ Sofía rechaza con mensaje amigable |
| 3 | Sin disponibilidad (1-3 abril) | ✅ Sofía informa y sugiere otras fechas |
| 4 | Fallo de Wubook (token inválido) | ✅ Sofía da teléfono y email del hotel |

### Fixes aplicados

**Fix 1 — Import obsoleto en `functionExecutor.ts`**
El import de `consultarDisponibilidadCompleta` desde `pms.ts` quedó huérfano tras el pivote a Wubook. Eliminado.

**Fix 2 — Fallback cuando Wubook falla**
Se envolvió la llamada a Wubook en try/catch. Los errores ahora devuelven un mensaje útil al huésped con datos de contacto del hotel en lugar de propagar el error.

**Fix 3 — Fechas limpias en `/prereservaciones`**
`TO_CHAR(fecha, 'YYYY-MM-DD')` en la query de lectura. Las fechas ahora se ven `"2026-03-25"` sin sufijo UTC.

**Fix 4 — Campo `fecha_prereservacion`**
Nueva columna `TIMESTAMP WITH TIME ZONE DEFAULT NOW()` en `prereservaciones`. Se expone como `TO_CHAR(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI:SS')`. Útil para reportes futuros.

**Fix 5 — `dotenv` al inicio absoluto de `index.ts`**
`dotenv.config()` movido a la primera línea, antes de cualquier import. Evita que módulos se inicialicen sin variables de entorno disponibles.

**Fix 6 — Limpieza de `index.ts`**
Eliminados todos los imports y endpoints de SOFTcalli (`/pms/*`, `/explorer/*`). El archivo quedó enfocado en lo que el MVP necesita.

**Fix 7 — Timeout `/chat` aumentado a 60 segundos**
El timeout original de 30 segundos era insuficiente con function calling encadenado.

### Incidente de seguridad

Durante la sesión se expuso accidentalmente una API Key de OpenAI en el chat. La key fue revocada inmediatamente y reemplazada antes de continuar. El `.env` nunca estuvo en GitHub — el incidente quedó contenido.

**Lección reforzada:** Nunca pegar valores de `.env` en ningún chat, terminal compartida o documento. Las API Keys son credenciales, no datos de depuración.

### Estado del proyecto al cierre

| Componente | Estado |
|------------|--------|
| Conector Wubook | ✅ Funcional con caché y fallback |
| Agente Sofía | ✅ Function calling + memoria de sesión |
| Pre-reservaciones | ✅ PostgreSQL con fechas limpias |
| Widget Coastal Light | ✅ Embebible con una línea |
| Casos edge | ✅ Fechas pasadas, sin disponibilidad, fallo de Wubook |
| Código legacy SOFTcalli | ✅ Eliminado de index.ts y functionExecutor.ts |

---

## Roadmap — Plan v2.0

El plan original de 50 días se reformuló. El MVP es un widget de chat (no voz), con un horizonte de 10 sesiones de trabajo.

| Sesión | Estado | Enfoque |
|--------|--------|---------|
| 1–4 + limpieza | ✅ Completadas | Base técnica: setup, Sofía, memoria, widget, Wubook |
| **5** | 🔵 Siguiente | **Streaming** — SSE, tokens en tiempo real, primera palabra < 1s |
| 6 | ⬜ Pendiente | Deploy producción — Railway/Render, HTTPS, URL pública |
| 7 | ⬜ Pendiente | Notificaciones — email al recepcionista (SendGrid/Resend) |
| 8 | ⬜ Pendiente | Instalación en hotel piloto — script en sitio real |
| 9 | ⬜ Pendiente | Ajustes post-piloto — system prompt v2, bugs reales |
| 10 | ⬜ Pendiente | Segundo hotel + primer cobro — primer MRR |

**Fuera del alcance Fase 1:** voz (Whisper+TTS), dashboard analytics, JWT/API Keys, multi-idioma, panel de inventario propio, WhatsApp.

---

## Registro de commits

| Sesión | Commit | Descripción |
|--------|--------|-------------|
| 1 | `dia-1: conector PMS SOFTcalli funcional` | Conector completo con disponibilidad y tarifas reales |
| 2 | `dia-2: sofia con function calling, cache redis y datos reales` | Agente Sofía funcional end-to-end |
| 2 | `docs: README y .env.example` | Documentación inicial del repositorio |
| 2 | `docs: README sin referencias a cliente piloto` | README sanitizado |
| 3 | `dia-3: validacion fechas, sesiones redis, prereservaciones en postgresql` | Robustez y persistencia |
| 4 | `dia-4: widget coastal light, embed.js autocontenido, markdown parser` | Widget embebible completo |
| 4 | `feature/wubook-connector` | Conector Wubook XML-RPC, catálogo dinámico, caché Redis 15min |
| Limpieza | `fix: eliminar dependencia pms obsoleta, fallback wubook, fechas limpias en prereservaciones` | Deuda técnica y casos edge |

---

Sesión 5 — Streaming en tiempo real
Fecha: Miércoles 11 de marzo 2026
Horas trabajadas: ~3 horas
Estado al cierre: ✅ Sofía responde con streaming SSE — primera palabra visible en menos de 1 segundo
Lo que construí
streamWithSofia() en sofia.ts:
Nueva función paralela a chatWithSofia que usa stream: true en la llamada a OpenAI. Los tokens llegan fragmentados via for await y se envían al cliente inmediatamente a través de un callback onToken. El loop maneja correctamente el caso donde Sofía necesita ejecutar function calls antes de generar texto — acumula los tool calls fragmentados, los ejecuta, agrega los resultados al historial y continúa el stream para la respuesta final.
Endpoint GET /chat/stream:
Nuevo endpoint SSE en index.ts. Usa GET en lugar de POST para compatibilidad con EventSource y fetch con streams. Configura los headers Content-Type: text/event-stream, Cache-Control: no-cache y Connection: keep-alive. Cada token se envía como data: {"token":"..."} y al terminar envía data: {"done":true, "session_id":"..."} para que el widget actualice la sesión.
Widget — indicador de escritura + transición suave:
El flujo de UX quedó así:

Usuario envía mensaje → aparecen los 3 puntos animados inmediatamente
Llega el primer token de OpenAI → los 3 puntos desaparecen, aparece la burbuja de Sofía
Los tokens van apareciendo en tiempo real con el cursor parpadeante ▋
Al recibir done: true → el cursor desaparece y la burbuja queda estática

Problemas encontrados
Problema 1 — Doble showTyping() y burbuja duplicada
sendMessage llamaba showTyping() directamente y appendStreamBubble también lo llamaba, creando dos typing-row en el DOM. Además appendStreamBubble creaba la burbuja con el id antes de tiempo, y updateStreamBubble intentaba crear otra con el mismo id — getElementById devolvía la primera (vacía) y el texto nunca aparecía.
Solución: Centralizar la responsabilidad. sendMessage llama showTyping() y guarda window._pendingBubbleId. appendStreamBubble queda vacía — solo existe para mantener compatibilidad. updateStreamBubble detecta la primera llamada por _pendingBubbleId, ejecuta hideTyping() y crea la burbuja real en ese momento.
Problema 2 — Variables con nombres diferentes a los asumidos
El código del widget usaba isTyping, sessionId, showTyping() y hideTyping() — nombres distintos a los que se usaron en el primer borrador del streaming. Causó varios ReferenceError en consola.
Aprendizaje: Antes de agregar código nuevo a un archivo existente, revisar las variables globales declaradas al inicio. Hubiera evitado dos iteraciones de debug.
Decisión de UX
Se evaluó poner un setTimeout fijo de 2 segundos antes de mostrar los tokens para que la experiencia se sintiera más "humana". Se descartó — el delay artificial ralentiza la experiencia en conversaciones largas y se siente falso. La solución adoptada usa el delay natural del primer token de OpenAI (0.5–1.5 segundos), que es honesto y suficiente para crear la sensación de que alguien está pensando al otro lado.
Pendiente

embed.js — sincronizar con los cambios de streaming antes de la Sesión 6

Reflexión
El streaming es la diferencia entre un chatbot y una conversación. Ver las palabras aparecer una por una — aunque sea rápido — activa en el usuario la sensación de que hay algo vivo al otro lado. Es el cambio de experiencia más grande desde que el widget apareció por primera vez en pantalla.

*Última actualización: Sesión de limpieza — 11 de marzo 2026*