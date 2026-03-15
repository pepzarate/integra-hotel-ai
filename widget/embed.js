(function () {
  // ── Configuración por defecto ─────────────────────────
  const CONFIG = Object.assign({
    backendUrl: 'https://integra-hotel-ai-production.up.railway.app',
    hotelName: 'Hotel Frontiere',
    primaryColor: '#b8312f',
    darkColor: '#3e3e3e',
    avatar: 'https://content.app-sources.com/s/33999217963244997/uploads/svg/FAVICON-9287264.ico',
    welcomeMsg: null,
  }, window.SofiaConfig || {});

  CONFIG.welcomeMsg = CONFIG.welcomeMsg ||
    `¡Hola! Soy Sofía 👋 Estoy aquí para ayudarte con disponibilidad, precios y reservaciones del ${CONFIG.hotelName}. ¿En qué puedo ayudarte?`;

  // ── Inyectar fuente ───────────────────────────────────
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap';
  document.head.appendChild(fontLink);

  // ── Inyectar estilos ──────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #sofia-widget*{box-sizing:border-box;margin:0;padding:0;font-family:'DM Sans',sans-serif;}
    #sofia-widget{position:fixed;bottom:28px;right:28px;z-index:9999;}
    #sofia-toggle{width:60px;height:60px;border-radius:20px;background:linear-gradient(135deg,${CONFIG.primaryColor},${CONFIG.darkColor});border:none;cursor:pointer;box-shadow:0 8px 32px rgba(46,125,175,0.5);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;position:relative;}
    #sofia-toggle:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(46,125,175,0.6);}
    #sofia-toggle svg{transition:transform .3s,opacity .3s;}
    #sofia-toggle.open .icon-chat{transform:scale(0) rotate(90deg);opacity:0;position:absolute;}
    #sofia-toggle:not(.open) .icon-close{transform:scale(0) rotate(-90deg);opacity:0;position:absolute;}
    #sofia-badge{position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:#FF5C5C;border-radius:50%;border:2px solid white;display:none;}
    #sofia-badge.visible{display:block;}
    #sofia-window{position:absolute;bottom:76px;right:0;width:360px;height:520px;background:#fff;border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,0.2);display:flex;flex-direction:column;overflow:hidden;transform:scale(0.95) translateY(16px);opacity:0;pointer-events:none;transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .25s ease;transform-origin:bottom right;}
    #sofia-window.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}
    #sofia-header{background:linear-gradient(135deg,${CONFIG.primaryColor},${CONFIG.darkColor});padding:16px 20px;display:flex;align-items:center;gap:12px;flex-shrink:0;}
    .sofia-avatar{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,0.2);border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
    .sofia-header-info{flex:1;}
    .sofia-header-name{font-size:15px;font-weight:600;color:#fff;letter-spacing:.3px;}
    .sofia-header-status{font-size:12px;color:rgba(255,255,255,.75);display:flex;align-items:center;gap:5px;margin-top:1px;}
    .status-dot{width:7px;height:7px;background:#5EE89A;border-radius:50%;animation:sofia-pulse 2s infinite;}
    @keyframes sofia-pulse{0%,100%{opacity:1}50%{opacity:.5}}
    #sofia-close{background:rgba(255,255,255,.15);border:none;color:white;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0;}
    #sofia-close:hover{background:rgba(255,255,255,.25);}
    #sofia-messages{flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:12px;background:#F0F6FC;scroll-behavior:smooth;}
    #sofia-messages::-webkit-scrollbar{width:4px;}
    #sofia-messages::-webkit-scrollbar-thumb{background:rgba(46,125,175,.2);border-radius:2px;}
    .sofia-msg-row{display:flex;align-items:flex-end;gap:8px;animation:sofia-in .3s cubic-bezier(.34,1.2,.64,1);}
    @keyframes sofia-in{from{opacity:0;transform:translateY(10px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
    .sofia-msg-row.user{justify-content:flex-end;}
    .sofia-msg-avatar{width:30px;height:30px;border-radius:50%;background:#ffffff;border:1.5px solid #e8e8e8;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
    .sofia-msg-bubble{max-width:76%;padding:11px 15px;font-size:14px;line-height:1.55;border-radius:18px;}
    .sofia-msg-bubble.sofia{background:#fff;color:#1a2f45;border-radius:18px 18px 18px 4px;box-shadow:0 2px 8px rgba(0,0,0,.07);}
    .sofia-msg-bubble.user{background:linear-gradient(135deg,${CONFIG.primaryColor},${CONFIG.darkColor});color:#fff;border-radius:18px 18px 4px 18px;}
    .sofia-typing{display:flex;gap:4px;padding:14px 16px;background:#fff;border-radius:18px 18px 18px 4px;box-shadow:0 2px 8px rgba(0,0,0,.07);width:fit-content;}
    .sofia-dot{width:7px;height:7px;background:#93b8d4;border-radius:50%;animation:sofia-typing 1.2s infinite;}
    .sofia-dot:nth-child(2){animation-delay:.2s;}
    .sofia-dot:nth-child(3){animation-delay:.4s;}
    @keyframes sofia-typing{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-6px);opacity:1}}
    #sofia-suggestions{padding:12px 16px 12px;display:flex;flex-wrap:wrap;gap:8px;background:#fff;border-top:1px solid #E8F0F8;}
    #sofia-suggestions.hidden{display:none;}
    .sofia-suggestion-btn{background:#F0F6FC;border:1.5px solid #D0E4F0;border-radius:20px;padding:7px 14px;font-size:13px;font-family:'DM Sans',sans-serif;color:${CONFIG.primaryColor};cursor:pointer;transition:background .2s,border-color .2s;white-space:nowrap;}
    .sofia-suggestion-btn:hover{background:#daeeff;border-color:${CONFIG.primaryColor};}
    #sofia-input-area{padding:14px 16px;background:#fff;border-top:1px solid #E8F0F8;display:flex;gap:10px;align-items:center;flex-shrink:0;}
    #sofia-input{flex:1;background:#F0F6FC;border:1.5px solid #D0E4F0;border-radius:22px;padding:10px 18px;font-size:14px;font-family:'DM Sans',sans-serif;color:#1a2f45;outline:none;transition:border-color .2s;}
    #sofia-input:focus{border-color:${CONFIG.primaryColor};}
    #sofia-input::placeholder{color:#a0b8cc;}
    #sofia-input:disabled{opacity:.6;cursor:not-allowed;}
    #sofia-send{width:42px;height:42px;background:linear-gradient(135deg,${CONFIG.primaryColor},${CONFIG.darkColor});border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;flex-shrink:0;}
    #sofia-send:hover{transform:scale(1.08);box-shadow:0 4px 16px rgba(46,125,175,.4);}
    #sofia-send:disabled{opacity:.5;cursor:not-allowed;transform:none;}
    #sofia-branding{text-align:center;padding:8px;font-size:10px;color:#b0c4d4;letter-spacing:1px;background:#fff;}
    @media(max-width:420px){#sofia-widget{bottom:16px;right:16px;}#sofia-window{width:calc(100vw - 32px);right:0;}}
  `;
  document.head.appendChild(style);

  // ── Helper: renderizar avatar (URL o emoji) ───────────
  function renderAvatar(el) {
    if (CONFIG.avatar.startsWith('http')) {
      const img = document.createElement('img');
      img.src = CONFIG.avatar;
      img.style.cssText = 'width:24px;height:24px;border-radius:50%;object-fit:cover;';
      el.appendChild(img);
    } else {
      el.textContent = CONFIG.avatar;
    }
  }

  // ── Inyectar HTML ─────────────────────────────────────
  const widget = document.createElement('div');
  widget.id = 'sofia-widget';
  widget.innerHTML = `
    <button id="sofia-toggle">
      <span id="sofia-badge"></span>
      <svg class="icon-chat" width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M21 15C21 16.1 20.1 17 19 17H7L3 21V5C3 3.9 3.9 3 5 3H19C20.1 3 21 3.9 21 5V15Z" fill="white"/>
      </svg>
      <svg class="icon-close" width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </button>
    <div id="sofia-window">
      <div id="sofia-header">
        <div class="sofia-avatar" id="sofia-header-avatar"></div>
        <div class="sofia-header-info">
          <div class="sofia-header-name">Sofía</div>
          <div class="sofia-header-status">
            <div class="status-dot"></div>
            En línea ahora
          </div>
        </div>
        <button id="sofia-close">×</button>
      </div>
      <div id="sofia-messages"></div>
      <div id="sofia-suggestions">
        <button class="sofia-suggestion-btn">📅 Quiero reservar una habitación</button>
        <button class="sofia-suggestion-btn">🕐 ¿A qué hora es el check-in?</button>
        <button class="sofia-suggestion-btn">🛎️ ¿Qué servicios incluye el hotel?</button>
      </div>
      <div id="sofia-input-area">
        <input type="text" id="sofia-input" placeholder="Escribe tu mensaje..." />
        <button id="sofia-send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div id="sofia-branding">✦ Powered by Integra Hotel AI</div>
    </div>
  `;
  document.body.appendChild(widget);

  // Renderizar avatar del header después de inyectar el HTML
  renderAvatar(document.getElementById('sofia-header-avatar'));

  // ── Lógica ────────────────────────────────────────────
  let sessionId = localStorage.getItem('sofia_session_id') || null;
  let isOpen = false;
  let isTyping = false;
  let initialized = false;

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
      appendMessage('sofia', CONFIG.welcomeMsg);
      document.getElementById('sofia-input').focus();
      initSuggestions();
    }

    if (isOpen) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }

  // ── Streaming SSE ─────────────────────────────────────

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
      row.className = 'sofia-msg-row sofia';
      row.id = id;

      const avatarEl = document.createElement('div');
      avatarEl.className = 'sofia-msg-avatar';
      renderAvatar(avatarEl);

      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'sofia-msg-bubble sofia';

      row.appendChild(avatarEl);
      row.appendChild(bubbleEl);
      messages.appendChild(row);
    }

    const row = document.getElementById(id);
    if (!row) return;
    const bubble = row.querySelector('.sofia-msg-bubble');
    if (!bubble) return;
    bubble.innerHTML = parseMarkdown(text) + '<span class="sofia-cursor">▋</span>';

    document.getElementById('sofia-messages').scrollTop = 99999;
  }

  // ── Enviar mensaje ────────────────────────────────────

  async function sendMessage() {
    const input = document.getElementById('sofia-input');
    const message = input.value.trim();
    if (!message || isTyping) return;

    hideSuggestions();
    input.value = '';
    isTyping = true;
    input.disabled = true;

    appendMessage('user', message);
    showTyping();

    const bubbleId = 'sofia-msg-' + Date.now();
    window._pendingBubbleId = bubbleId;

    let fullReply = '';

    try {
      const params = new URLSearchParams({ message });
      if (sessionId) params.append('session_id', sessionId);

      const response = await fetch(`${CONFIG.backendUrl}/chat/stream?${params}`);
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
      // Quitar cursor parpadeante al terminar
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

  // ── Markdown básico → HTML ────────────────────────────
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

  // ── Renderizar mensajes ───────────────────────────────
  function appendMessage(from, text) {
    const container = document.getElementById('sofia-messages');

    const row = document.createElement('div');
    row.className = `sofia-msg-row ${from}`;

    if (from === 'sofia') {
      const avatar = document.createElement('div');
      avatar.className = 'sofia-msg-avatar';
      renderAvatar(avatar);
      row.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = `sofia-msg-bubble ${from}`;
    bubble.innerHTML = parseMarkdown(text);
    row.appendChild(bubble);

    container.appendChild(row);
    scrollToBottom();

    // Badge si el widget está cerrado
    if (!isOpen && from === 'sofia') {
      document.getElementById('sofia-badge').classList.add('visible');
    }
  }

  // ── Indicador de escritura ────────────────────────────
  function showTyping() {
    isTyping = true;
    document.getElementById('sofia-input').disabled = true;
    document.getElementById('sofia-send').disabled = true;

    const container = document.getElementById('sofia-messages');
    const row = document.createElement('div');
    row.className = 'sofia-msg-row';
    row.id = 'typing-row';

    const avatar = document.createElement('div');
    avatar.className = 'sofia-msg-avatar';
    renderAvatar(avatar);

    const indicator = document.createElement('div');
    indicator.className = 'sofia-typing';
    indicator.innerHTML = `
      <div class="sofia-dot"></div>
      <div class="sofia-dot"></div>
      <div class="sofia-dot"></div>
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

  // ── Sugerencias rápidas ───────────────────────────────
  function initSuggestions() {
    const container = document.getElementById('sofia-suggestions');
    if (!container) return;

    container.querySelectorAll('.sofia-suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('sofia-input');
        input.value = btn.textContent.replace(/^[^\w¿]+/, '').trim();
        hideSuggestions();
        sendMessage();
      });
    });
  }

  function hideSuggestions() {
    const container = document.getElementById('sofia-suggestions');
    if (container) container.classList.add('hidden');
  }

  // ── Utilidades ────────────────────────────────────────
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

})();