const BACKEND_URL = 'http://localhost:3000';
const HOTEL_NAME = 'Hotel Demo';
const WELCOME_MSG = `¡Hola! Soy Sofía 👋 Estoy aquí para ayudarte con disponibilidad, precios y reservaciones del ${HOTEL_NAME}. ¿En qué puedo ayudarte?`;

let sessionId = localStorage.getItem('sofia_session_id') || null;
let isOpen = false;
let isTyping = false;
let initialized = false;

// ── Abrir / cerrar ──────────────────────────────────────
function toggleWidget() {
    isOpen = !isOpen;
    const win = document.getElementById('sofia-window');
    const toggle = document.getElementById('sofia-toggle');
    const badge = document.getElementById('sofia-badge');

    win.classList.toggle('open', isOpen);
    toggle.classList.toggle('open', isOpen);
    badge.classList.remove('visible');

    if (isOpen && !initialized) {
        initialized = true;
        appendMessage('sofia', WELCOME_MSG);
        document.getElementById('sofia-input').focus();
    }

    if (isOpen) {
        setTimeout(() => scrollToBottom(), 100);
    }
}

// ── Enviar mensaje ──────────────────────────────────────

function appendStreamBubble(id) {
    window._pendingBubbleId = id;
    // Solo muestra el indicador — la burbuja se crea al llegar el primer token
}

function updateStreamBubble(id, text) {
    // Primera vez — ocultar indicador y crear burbuja
    if (window._pendingBubbleId === id) {
        hideTyping();
        window._pendingBubbleId = null;

        const messages = document.getElementById('sofia-messages');
        const row = document.createElement('div');
        row.className = 'msg-row sofia';
        row.id = id;
        row.innerHTML = `
            <div class="msg-avatar">🌊</div>
            <div class="msg-bubble sofia"></div>
        `;
        messages.appendChild(row);
    }

    const row = document.getElementById(id);
    if (!row) return;
    const bubble = row.querySelector('.msg-bubble');
    if (!bubble) return;
    bubble.innerHTML = parseMarkdown(text) + '<span class="sofia-cursor">▋</span>';

    document.getElementById('sofia-messages').scrollTop = 99999;
}

async function sendMessage() {
    const input = document.getElementById('sofia-input');
    const message = input.value.trim();
    if (!message || isTyping) return;

    input.value = '';
    isTyping = true;
    input.disabled = true;

    appendMessage('user', message);
    showTyping(); // Mostrar indicador inmediatamente

    const bubbleId = 'sofia-msg-' + Date.now();
    window._pendingBubbleId = bubbleId;

    let fullReply = '';

    try {
        const params = new URLSearchParams({ message });
        if (sessionId) params.append('session_id', sessionId);

        const response = await fetch(`${BACKEND_URL}/chat/stream?${params}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const data = JSON.parse(line.slice(6));

                    if (data.token) {
                        fullReply += data.token;
                        updateStreamBubble(bubbleId, fullReply);
                    }

                    if (data.done) {
                        sessionId = data.session_id;
                        localStorage.setItem('sofia_session_id', sessionId);
                    }

                    if (data.error) {
                        if (window._pendingBubbleId) {
                            hideTyping();
                            window._pendingBubbleId = null;
                        }
                        updateStreamBubble(bubbleId, 'Lo siento, ocurrió un error. Por favor intenta de nuevo.');
                    }
                } catch (_) { }
            }
        }
    } catch (err) {
        if (window._pendingBubbleId) {
            hideTyping();
            window._pendingBubbleId = null;
        }
        updateStreamBubble(bubbleId, 'No se pudo conectar con el servidor.');
    } finally {
        // Quitar cursor al terminar
        const finalRow = document.getElementById(bubbleId);
        if (finalRow) {
            const cursor = finalRow.querySelector('.sofia-cursor');
            if (cursor) cursor.remove();
        }
        isTyping = false;
        input.disabled = false;
        input.focus();
    }
}

// ── Convertir markdown básico a HTML ───────────────────
function parseMarkdown(text) {
    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('- ') || line.startsWith('• ')) {
            const content = line.replace(/^[-•]\s+/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            if (!inList) {
                html += '<ul style="padding-left:16px;margin:6px 0;list-style:disc;">';
                inList = true;
            }
            html += `<li style="margin:2px 0;line-height:1.5;">${content}</li>`;
        } else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            if (line === '') {
                html += '<br>';
            } else {
                html += '<p style="margin:3px 0;">' + line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') + '</p>';
            }
        }
    }

    if (inList) html += '</ul>';
    return html;
}

// ── Renderizar mensajes ─────────────────────────────────
function appendMessage(from, text) {
    const container = document.getElementById('sofia-messages');

    const row = document.createElement('div');
    row.className = `msg-row ${from}`;

    if (from === 'sofia') {
        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.textContent = '🌊';
        row.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${from}`;
    bubble.innerHTML = parseMarkdown(text);
    row.appendChild(bubble);

    container.appendChild(row);
    scrollToBottom();

    // Badge si el widget está cerrado
    if (!isOpen && from === 'sofia') {
        document.getElementById('sofia-badge').classList.add('visible');
    }
}

// ── Indicador de escritura ──────────────────────────────
function showTyping() {
    isTyping = true;
    document.getElementById('sofia-input').disabled = true;
    document.getElementById('sofia-send').disabled = true;

    const container = document.getElementById('sofia-messages');
    const row = document.createElement('div');
    row.className = 'msg-row';
    row.id = 'typing-row';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = '🌊';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      `;

    row.appendChild(avatar);
    row.appendChild(indicator);
    container.appendChild(row);
    scrollToBottom();
}

function hideTyping() {
    isTyping = false;
    document.getElementById('sofia-input').disabled = false;
    document.getElementById('sofia-send').disabled = false;
    document.getElementById('sofia-input').focus();

    const typingRow = document.getElementById('typing-row');
    if (typingRow) typingRow.remove();
}

// ── Utilidades ──────────────────────────────────────────
function scrollToBottom() {
    const messages = document.getElementById('sofia-messages');
    messages.scrollTop = messages.scrollHeight;
}

function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

document.getElementById('sofia-toggle').addEventListener('click', toggleWidget);
document.getElementById('sofia-close').addEventListener('click', toggleWidget);
document.getElementById('sofia-send').addEventListener('click', sendMessage);
document.getElementById('sofia-input').addEventListener('keydown', handleKey);