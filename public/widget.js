(function (global) {
  'use strict';

  // Track initialised agents to avoid duplicates
  var _initialized = new Set();

  // ─── Core Widget Factory ────────────────────────────────────────────────────
  function initWidget(agentId, apiBase, wsBase, userContext, teamId) {
    var sessionKey = teamId ? 'team_' + teamId : 'agent_' + agentId;
    if (!agentId && !teamId) { console.error('[BotaWidget] Missing agent ID or team ID'); return; }
    if (_initialized.has(sessionKey)) { console.warn('[BotaWidget] Already initialized:', sessionKey); return; }
    _initialized.add(sessionKey);

    apiBase = apiBase || window.location.origin;
    wsBase  = wsBase  || apiBase.replace(/^http/, 'ws');

    // State
    var config = null;
    var isExpanded = false;
    var isListening = false;
    var sessionId = sessionStorage.getItem('bota_session_' + sessionKey) || _generateId();
    var messages = [];
    var ws = null;
    var wsConnected = false;
    var reconnectAttempts = 0;
    var MAX_RECONNECT = 5;
    var currentStreamingMessage = null;

    sessionStorage.setItem('bota_session_' + sessionKey, sessionId);

    function _generateId() {
      return 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }

    // ── Shadow DOM ────────────────────────────────────────────────────────────
    var container = document.createElement('div');
    container.id = 'bota-widget-' + agentId;
    var shadow = container.attachShadow({ mode: 'closed' });
    document.body.appendChild(container);

    var styles = document.createElement('style');
    styles.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

      .widget-root { position: fixed; bottom: 1.5rem; z-index: 999999; }
      .widget-root.bottom-right { right: 1.5rem; }
      .widget-root.bottom-left  { left: 1.5rem; }

      .widget-button {
        width: 3.5rem; height: 3.5rem; border-radius: 50%; border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 10px 25px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.1);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .widget-button:hover { transform: scale(1.07); box-shadow: 0 14px 30px rgba(0,0,0,0.22); }
      .widget-button svg { width: 1.5rem; height: 1.5rem; fill: white; }

      .widget-window {
        width: 28rem; height: 40rem; background: white; border-radius: 1rem;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        overflow: hidden; display: flex; flex-direction: column;
        animation: botaIn 0.25s cubic-bezier(0,1.2,1,1);
      }

      @keyframes botaIn {
        from { opacity: 0; transform: scale(0.92) translateY(8px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }

      .widget-header {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 14px; border-bottom: 1px solid rgba(0,0,0,0.08); flex-shrink: 0;
      }
      .widget-avatar {
        width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
      }
      .widget-avatar-placeholder {
        width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
      }
      .widget-avatar-placeholder svg { width: 20px; height: 20px; fill: white; }
      .widget-header-info { flex: 1; min-width: 0; }
      .widget-header-title { font-size: 14px; font-weight: 600; color: #111827; line-height: 1.2; }
      .widget-header-status { font-size: 12px; color: #6B7280; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
      .widget-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #9CA3AF; }
      .widget-status-dot.online { background: #10B981; }
      .widget-header-actions { display: flex; gap: 2px; }
      .widget-icon-btn {
        width: 28px; height: 28px; border: none; background: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center; border-radius: 6px;
        color: #6B7280; transition: background 0.15s;
      }
      .widget-icon-btn:hover { background: #F3F4F6; }
      .widget-icon-btn svg { width: 14px; height: 14px; fill: currentColor; }

      .widget-messages {
        flex: 1; overflow-y: auto; padding: 16px 14px;
        display: flex; flex-direction: column; gap: 10px;
      }
      .widget-empty {
        flex: 1; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px; padding: 24px 14px;
      }
      .widget-empty-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; }
      .widget-empty-avatar-placeholder {
        width: 64px; height: 64px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
      }
      .widget-empty-avatar-placeholder svg { width: 28px; height: 28px; fill: white; }
      .widget-empty-title { font-size: 15px; font-weight: 600; color: #111827; text-align: center; }
      .widget-empty-greeting { font-size: 13px; color: #6B7280; text-align: center; line-height: 1.5; }

      .widget-message { max-width: 82%; padding: 8px 12px; font-size: 13px; line-height: 1.5; word-wrap: break-word; }
      .widget-message.agent { align-self: flex-start; background: #F3F4F6; color: #111827; border-radius: 4px 12px 12px 12px; }
      .widget-message.user  { align-self: flex-end;   color: white;    border-radius: 12px 4px 12px 12px; }
      .widget-message.typing { display: flex; gap: 4px; padding: 14px 16px; }
      .typing-dot { width: 7px; height: 7px; background: #9CA3AF; border-radius: 50%; animation: typing 1.4s infinite ease-in-out; }
      .typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes typing { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }

      .widget-footer {
        flex-shrink: 0; border-top: 1px solid #E5E7EB; background: #F9FAFB;
      }
      .widget-input-bar {
        display: flex; align-items: center; gap: 8px; padding: 10px 14px;
      }
      .widget-input {
        flex: 1; border: none; background: #EFEFEF; border-radius: 24px;
        padding: 9px 14px; font-size: 13px; outline: none; color: #111827;
      }
      .widget-input::placeholder { color: #9CA3AF; }
      .widget-send-btn {
        width: 36px; height: 36px; border-radius: 50%; border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center; transition: opacity 0.2s;
        flex-shrink: 0;
      }
      .widget-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .widget-send-btn svg { width: 16px; height: 16px; fill: white; }

      .widget-branding {
        display: flex; align-items: center; justify-content: center;
        gap: 5px; padding: 4px 14px 10px;
      }
      .widget-branding-text { font-size: 10px; color: #9CA3AF; letter-spacing: 0.2px; }
      .widget-branding-logo { height: 14px; opacity: 0.45; }

      .hidden { display: none !important; }
    `;
    shadow.appendChild(styles);

    // ── Widget HTML ───────────────────────────────────────────────────────────
    var root = document.createElement('div');
    root.className = 'widget-root bottom-right';
    root.innerHTML = `
      <button class="widget-button" id="bota-toggle" title="Chat with us">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </button>
      <div class="hidden" id="bota-window">
        <div class="widget-header">
          <div class="widget-avatar-placeholder" id="bota-avatar-wrap">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z"/></svg>
          </div>
          <div class="widget-header-info">
            <div class="widget-header-title" id="bota-title">AI Assistant</div>
            <div class="widget-header-status">
              <span class="widget-status-dot online"></span>
              <span>Online</span>
            </div>
          </div>
          <div class="widget-header-actions">
            <button class="widget-icon-btn" id="bota-reset" title="Reset conversation">
              <svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
            <button class="widget-icon-btn" id="bota-close" title="Close">
              <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>

        <div id="bota-messages-wrap">
          <div class="widget-empty" id="bota-empty">
            <div class="widget-empty-avatar-placeholder" id="bota-empty-avatar-wrap">
              <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z"/></svg>
            </div>
            <div class="widget-empty-title" id="bota-empty-name">AI Assistant</div>
            <div class="widget-empty-greeting" id="bota-empty-greeting">Hi! How can I help you today?</div>
          </div>
          <div class="widget-messages hidden" id="bota-messages"></div>
        </div>

        <div class="widget-footer">
          <div class="widget-input-bar">
            <input type="text" class="widget-input" id="bota-input" placeholder="Type your message..." />
            <button class="widget-send-btn" id="bota-send" disabled>
              <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
          <div class="widget-branding">
            <span class="widget-branding-text">Powered by</span>
            <img class="widget-branding-logo" src="${apiBase}/assets/badges/bota-badge.png" alt="Botaplace AI" />
          </div>
        </div>
      </div>
    `;
    shadow.appendChild(root);

    // ── Element references ────────────────────────────────────────────────────
    var toggleBtn    = shadow.getElementById('bota-toggle');
    var windowEl     = shadow.getElementById('bota-window');
    var closeBtn     = shadow.getElementById('bota-close');
    var resetBtn     = shadow.getElementById('bota-reset');
    var titleEl      = shadow.getElementById('bota-title');
    var avatarWrap   = shadow.getElementById('bota-avatar-wrap');
    var emptyEl      = shadow.getElementById('bota-empty');
    var emptyAvatarWrap = shadow.getElementById('bota-empty-avatar-wrap');
    var emptyName    = shadow.getElementById('bota-empty-name');
    var emptyGreeting = shadow.getElementById('bota-empty-greeting');
    var messagesEl   = shadow.getElementById('bota-messages');
    var inputEl      = shadow.getElementById('bota-input');
    var sendBtn      = shadow.getElementById('bota-send');

    // ── Config application ────────────────────────────────────────────────────
    function applyConfig(cfg) {
      var accent = cfg.color || '#6C5CE7';
      titleEl.textContent = cfg.name || 'AI Assistant';
      emptyName.textContent = cfg.name || 'AI Assistant';
      if (cfg.greeting_message) emptyGreeting.textContent = cfg.greeting_message;
      if (cfg.position === 'bottom-left') {
        root.classList.remove('bottom-right');
        root.classList.add('bottom-left');
      }

      toggleBtn.style.background = accent;
      sendBtn.style.background = accent;

      // Avatar
      var avatarUrl = cfg.avatar_url || (apiBase + '/assets/avatars/bota-copilot-avatar.png');
      _setAvatar(avatarWrap, avatarUrl, accent, 38);
      _setAvatar(emptyAvatarWrap, avatarUrl, accent, 64);
    }

    function _setAvatar(wrap, url, accent, size) {
      var img = document.createElement('img');
      img.className = size >= 48 ? 'widget-empty-avatar' : 'widget-avatar';
      img.src = url;
      img.width = size; img.height = size;
      img.style.border = '2px solid ' + accent + '50';
      img.onerror = function() { wrap.style.background = accent; };
      img.onload = function() { wrap.innerHTML = ''; wrap.appendChild(img); };
      wrap.style.background = accent;
    }

    // ── Message rendering ─────────────────────────────────────────────────────
    function showMessages() {
      emptyEl.classList.add('hidden');
      messagesEl.classList.remove('hidden');
    }

    function addMessage(text, role) {
      showMessages();
      var msg = document.createElement('div');
      msg.className = 'widget-message ' + role;
      msg.textContent = text;
      if (role === 'user' && config && config.color) msg.style.background = config.color;
      messagesEl.appendChild(msg);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      messages.push({ role: role, content: text });
    }

    function addTypingIndicator() {
      showMessages();
      var t = document.createElement('div');
      t.className = 'widget-message agent typing'; t.id = 'bota-typing';
      t.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
      messagesEl.appendChild(t);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function removeTypingIndicator() {
      var t = shadow.getElementById('bota-typing');
      if (t) t.remove();
    }

    function resetConversation() {
      messages = [];
      messagesEl.innerHTML = '';
      messagesEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      currentStreamingMessage = null;
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────
    function connectWebSocket() {
      if (ws && ws.readyState === WebSocket.OPEN) return;
      var url = wsBase + '/ws?type=text_chat&sessionId=' + sessionId;
      if (agentId) url += '&agentId=' + encodeURIComponent(agentId);
      if (teamId)  url += '&teamId='  + encodeURIComponent(teamId);
      if (userContext && typeof userContext === 'object') {
        try { url += '&ctx=' + encodeURIComponent(btoa(JSON.stringify(userContext))); } catch(e) { /* ignore encoding errors */ }
      }
      ws = new WebSocket(url);

      ws.onopen = function() { wsConnected = true; reconnectAttempts = 0; };

      ws.onmessage = function(evt) {
        try { handleWsMsg(JSON.parse(evt.data)); } catch(e) {}
      };

      ws.onclose = function() {
        wsConnected = false;
        if (reconnectAttempts < MAX_RECONNECT) {
          reconnectAttempts++;
          setTimeout(connectWebSocket, Math.min(1000 * Math.pow(2, reconnectAttempts), 30000));
        }
      };

      ws.onerror = function(e) { console.error('[BotaWidget] WS error', e); };
    }

    function handleWsMsg(data) {
      switch (data.type) {
        case 'text':
          removeTypingIndicator();
          if (!currentStreamingMessage) {
            currentStreamingMessage = document.createElement('div');
            currentStreamingMessage.className = 'widget-message agent';
            showMessages();
            messagesEl.appendChild(currentStreamingMessage);
          }
          currentStreamingMessage.textContent += data.text;
          messagesEl.scrollTop = messagesEl.scrollHeight;
          break;
        case 'message':
          removeTypingIndicator();
          if (data.content) addMessage(data.content, 'agent');
          break;
        case 'end':
          if (currentStreamingMessage) {
            messages.push({ role: 'assistant', content: currentStreamingMessage.textContent });
            currentStreamingMessage = null;
          }
          break;
        case 'error':
          removeTypingIndicator();
          addMessage('Sorry, something went wrong. Please try again.', 'agent');
          break;
      }
    }

    function sendMessage() {
      var text = inputEl.value.trim();
      if (!text) return;
      inputEl.value = ''; sendBtn.disabled = true;
      if (currentStreamingMessage) {
        messages.push({ role: 'assistant', content: currentStreamingMessage.textContent });
        currentStreamingMessage = null;
      }
      addMessage(text, 'user');
      addTypingIndicator();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message', text: text }));
      } else {
        removeTypingIndicator();
        addMessage('Connection lost. Please refresh and try again.', 'agent');
      }
    }

    // ── Heartbeat ─────────────────────────────────────────────────────────────
    setInterval(function() {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 30000);

    // ── Event listeners ───────────────────────────────────────────────────────
    toggleBtn.addEventListener('click', function() {
      windowEl.classList.remove('hidden');
      toggleBtn.classList.add('hidden');
      inputEl.focus();
      if (!wsConnected) connectWebSocket();
    });

    closeBtn.addEventListener('click', function() {
      windowEl.classList.add('hidden');
      toggleBtn.classList.remove('hidden');
    });

    resetBtn.addEventListener('click', resetConversation);

    inputEl.addEventListener('input', function() { sendBtn.disabled = !inputEl.value.trim(); });

    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey && inputEl.value.trim()) {
        e.preventDefault(); sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    var configUrl = apiBase + '/api/widget/config?' + (agentId ? 'agentId=' + encodeURIComponent(agentId) : 'teamId=' + encodeURIComponent(teamId || ''));
    fetch(configUrl)
      .then(function(r) { if (!r.ok) throw new Error('Config fetch failed'); return r.json(); })
      .then(function(cfg) { config = cfg; applyConfig(cfg); connectWebSocket(); })
      .catch(function(err) {
        console.error('[BotaWidget] Config error:', err);
        connectWebSocket();
      });
  }

  // ── Auto-init from script tag: <script data-agent-id="..."> ─────────────────
  var _cs = document.currentScript;
  if (_cs && _cs.getAttribute('data-agent-id')) {
    initWidget(
      _cs.getAttribute('data-agent-id'),
      _cs.getAttribute('data-api-base') || window.location.origin,
      _cs.getAttribute('data-ws-base')
    );
  }

  // ── Custom element: <bota-widget agent-id="..."> ─────────────────────────────
  if (typeof customElements !== 'undefined' && !customElements.get('bota-widget')) {
    var BotaWidgetElement = /** @class */ (function (_super) {
      // ES5-compatible custom element
      function BotaWidgetElement() { return _super.apply(this, arguments) || this; }
      BotaWidgetElement.prototype = Object.create(HTMLElement.prototype);
      BotaWidgetElement.prototype.constructor = BotaWidgetElement;
      BotaWidgetElement.prototype.connectedCallback = function() {
        var agentId = this.getAttribute('agent-id');
        if (!agentId) return;
        var apiBase = this.getAttribute('api-base') || window.location.origin;
        var wsBase  = this.getAttribute('ws-base')  || apiBase.replace(/^http/, 'ws');
        initWidget(agentId, apiBase, wsBase);
      };
      return BotaWidgetElement;
    }(HTMLElement));

    try {
      customElements.define('bota-widget', BotaWidgetElement);
    } catch(e) { console.warn('[BotaWidget] Custom element registration failed:', e); }
  }

  // ── Programmatic JS API: BotaWidget.init('agentId') ─────────────────────────
  global.BotaWidget = {
    // BotaWidget.init(agentId, options) — agentId or options.teamId required
    // Squad/team mode: BotaWidget.init(null, { teamId: 'xxx' })
    // Agent mode:      BotaWidget.init('agent-uuid', { ... })
    init: function(agentId, options) {
      var opts = options || {};
      initWidget(
        agentId || opts.agentId || '',
        opts.apiBase || window.location.origin,
        opts.wsBase,
        opts.userContext,
        opts.teamId
      );
    },
    version: '1.0.0',
  };

})(window);
