(function (global) {
  'use strict';

  var _initialized = new Set();

  function initWidget(agentId, apiBase, wsBase, userContext, teamId) {
    var sessionKey = teamId ? 'team_' + teamId : 'agent_' + agentId;
    if (!agentId && !teamId) { console.error('[BotaWidget] Missing agent ID or team ID'); return; }
    if (_initialized.has(sessionKey)) return;
    _initialized.add(sessionKey);

    apiBase = apiBase || window.location.origin;
    wsBase  = wsBase  || apiBase.replace(/^http/, 'ws');

    var config = null;
    var sessionId = sessionStorage.getItem('bota_session_' + sessionKey) || ('sess_' + Math.random().toString(36).substr(2) + Date.now().toString(36));
    var messages = [];
    var ws = null;
    var wsConnected = false;
    var reconnectAttempts = 0;
    var currentStreamingMessage = null;
    var callActive = false;
    var widgetOpen = false;
    sessionStorage.setItem('bota_session_' + sessionKey, sessionId);

    // ── Shadow DOM ──
    var container = document.createElement('div');
    container.id = 'bota-widget-' + agentId;
    var shadow = container.attachShadow({ mode: 'closed' });
    document.body.appendChild(container);

    var accent = '#7C3AED';
    var avatarUrl = apiBase + '/assets/avatars/bota-copilot-avatar.png';

    var styles = document.createElement('style');
    styles.textContent = WIDGET_CSS(accent);
    shadow.appendChild(styles);

    function WIDGET_CSS(c) {
      return '\
      *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}\
      .wr{position:fixed;bottom:1.5rem;z-index:999999;display:flex;flex-direction:column-reverse;align-items:flex-end;gap:12px}\
      .wr.br{right:1.5rem}.wr.bl{left:1.5rem;align-items:flex-start}\
      .fab{border:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:0 1rem 0 .75rem;height:3rem;\
        border-radius:1.5rem;background:#1F2937;color:#fff;\
        box-shadow:0 10px 25px rgba(0,0,0,.18),0 4px 8px rgba(0,0,0,.1);\
        transition:transform .2s,box-shadow .2s}\
      .fab:hover{transform:scale(1.04);box-shadow:0 14px 30px rgba(0,0,0,.22)}\
      .fab-bars{display:flex;align-items:center;gap:2px;height:28px}\
      .fab-bar{width:3px;border-radius:2px;background:'+c+';transition:height .15s}\
      .fab-text{display:flex;flex-direction:column;line-height:1.2}\
      .fab-title{font-size:13px;font-weight:500}.fab-sub{font-size:11px;opacity:.7}\
      .win{width:24rem;height:min(42rem,calc(100vh - 6rem));background:#fff;border-radius:1rem;\
        box-shadow:0 25px 50px -12px rgba(0,0,0,.25);overflow:hidden;display:flex;flex-direction:column;\
        animation:slideIn .25s cubic-bezier(0,1.2,1,1)}\
      @keyframes slideIn{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}\
      .hdr{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #E5E7EB;flex-shrink:0}\
      .hdr-avatar{position:relative;flex-shrink:0}\
      .hdr-avatar img{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid '+c+'40}\
      .hdr-dot{position:absolute;bottom:1px;right:1px;width:9px;height:9px;border-radius:50%;background:#10B981;border:2px solid #fff}\
      .hdr-info{flex:1;min-width:0}\
      .hdr-name{font-size:14px;font-weight:600;color:#111827;line-height:1.2}\
      .hdr-status{font-size:12px;color:#6B7280;display:flex;align-items:center;gap:4px;margin-top:2px}\
      .hdr-status-dot{width:6px;height:6px;border-radius:50%;background:#10B981;display:inline-block}\
      .hdr-actions{display:flex;gap:2px}\
      .ibtn{width:28px;height:28px;border:none;background:none;cursor:pointer;display:flex;align-items:center;\
        justify-content:center;border-radius:6px;color:#6B7280;transition:background .15s}\
      .ibtn:hover{background:#F3F4F6}.ibtn svg{width:14px;height:14px;fill:currentColor}\
      .body{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column}\
      .empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px 14px}\
      .empty-av{position:relative}\
      .empty-av img{width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid '+c+'40}\
      .empty-dot{position:absolute;bottom:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#10B981;border:2px solid #fff}\
      .empty-name{font-size:15px;font-weight:600;color:#111827;text-align:center}\
      .empty-greet{font-size:13px;color:#6B7280;text-align:center;line-height:1.5}\
      .msgs{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:10px}\
      .msg{max-width:82%;padding:8px 12px;font-size:13px;line-height:1.5;word-wrap:break-word}\
      .msg.a{align-self:flex-start;background:#F3F4F6;color:#111827;border-radius:4px 12px 12px 12px}\
      .msg.u{align-self:flex-end;color:#fff;background:'+c+';border-radius:12px 4px 12px 12px}\
      .msg.typing{display:flex;gap:4px;padding:14px 16px}\
      .tdot{width:7px;height:7px;background:#9CA3AF;border-radius:50%;animation:tp 1.4s infinite ease-in-out}\
      .tdot:nth-child(2){animation-delay:.2s}.tdot:nth-child(3){animation-delay:.4s}\
      @keyframes tp{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}\
      .ftr{flex-shrink:0;border-top:1px solid #E5E7EB;background:#F9FAFB}\
      .ibar{display:flex;align-items:center;gap:8px;padding:10px 14px}\
      .inp{flex:1;border:none;background:#F3F4F6;border-radius:24px;padding:10px 16px;font-size:13px;outline:none;color:#111827;\
        border:1px solid #E5E7EB}\
      .inp::placeholder{color:#9CA3AF}\
      .sbtn{width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;\
        justify-content:center;flex-shrink:0;transition:background .2s}\
      .sbtn:disabled{opacity:.35;cursor:default}\
      .sbtn svg{width:15px;height:15px;fill:#fff}\
      .abtn{width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;\
        justify-content:center;flex-shrink:0;background:none;color:#9CA3AF;transition:color .15s}\
      .abtn:hover{color:#6B7280}\
      .abtn svg{width:16px;height:16px;fill:currentColor}\
      .attach-preview{display:flex;align-items:center;gap:6px;padding:4px 14px;font-size:11px;color:#6B7280;background:#F9FAFB;border-bottom:1px solid #E5E7EB}\
      .attach-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
      .attach-rm{border:none;background:none;cursor:pointer;color:#9CA3AF;font-size:14px;padding:0 4px}\
      .cbtn{width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;\
        justify-content:center;flex-shrink:0;box-shadow:0 4px 12px '+c+'50}\
      .cbtn svg{width:16px;height:16px;fill:#fff}\
      .cbtn.end{background:#EF4444;box-shadow:0 4px 12px rgba(239,68,68,.3)}\
      .brand{display:flex;align-items:center;justify-content:center;gap:5px;padding:6px 14px 10px}\
      .brand-t{font-size:10px;color:#9CA3AF;letter-spacing:.2px}\
      .brand-logo{height:14px;opacity:.45}\
      .hidden{display:none!important}\
      ';
    }

    // ── Build HTML ──
    var root = document.createElement('div');
    root.className = 'wr br';

    // FAB
    var fab = document.createElement('button');
    fab.className = 'fab';
    fab.title = 'Chat with us';
    fab.innerHTML = '<div class="fab-bars" id="bars"></div><div class="fab-text"><span class="fab-title">Need help?</span><span class="fab-sub">Chat with our AI</span></div>';
    root.appendChild(fab);

    // Animated bars
    var barsEl = fab.querySelector('#bars');
    var barHeights = [0.5, 0.75, 1, 0.75, 0.5];
    for (var i = 0; i < 5; i++) {
      var bar = document.createElement('div');
      bar.className = 'fab-bar';
      bar.style.height = (barHeights[i] * 16) + 'px';
      barsEl.appendChild(bar);
    }

    // Window
    var win = document.createElement('div');
    win.className = 'win hidden';
    win.innerHTML = '\
      <div class="hdr">\
        <div class="hdr-avatar"><img id="hdr-img" src="'+avatarUrl+'" alt="Agent"><div class="hdr-dot"></div></div>\
        <div class="hdr-info"><div class="hdr-name" id="h-name">AI Assistant</div>\
          <div class="hdr-status"><span class="hdr-status-dot"></span><span>Online</span></div></div>\
        <div class="hdr-actions">\
          <button class="ibtn" id="b-reset" title="Reset"><svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.96 7.96 0 0012 4C7.58 4 4.01 7.58 4.01 12S7.58 20 12 20c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg></button>\
          <button class="ibtn" id="b-close" title="Close"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>\
        </div>\
      </div>\
      <div class="body">\
        <div class="empty" id="b-empty">\
          <div class="empty-av"><img id="e-img" src="'+avatarUrl+'" alt="Agent"><div class="empty-dot"></div></div>\
          <div class="empty-name" id="e-name">AI Assistant</div>\
          <div class="empty-greet" id="e-greet">Hi! How can I help you today?</div>\
        </div>\
        <div class="msgs hidden" id="b-msgs"></div>\
      </div>\
      <div class="ftr">\
        <div class="attach-preview hidden" id="b-attach-bar"><span class="attach-name" id="b-attach-name"></span><button class="attach-rm" id="b-attach-rm" title="Remove">&times;</button></div>\
        <div class="ibar">\
          <button class="abtn" id="b-attach" title="Attach file"><svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 015 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6h-1.5v9.5a2.5 2.5 0 005 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6H16.5z"/></svg></button>\
          <input type="text" class="inp" id="b-inp" placeholder="Type your message..." />\
          <button class="sbtn" id="b-send" disabled style="background:#D1D5DB"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>\
          <button class="cbtn" id="b-call" style="background:'+accent+'"><svg viewBox="0 0 24 24"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.58.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.58 1 1 0 01-.25 1.02l-2.2 2.19z"/></svg></button>\
        </div>\
        <div class="brand">\
          <span class="brand-t">Powered by</span>\
          <img class="brand-logo" src="'+apiBase+'/assets/badges/bota-badge.png" alt="Botaplace AI" />\
        </div>\
      </div>';
    root.appendChild(win);
    shadow.appendChild(root);

    // ── Refs ──
    var hName = shadow.getElementById('h-name');
    var hImg = shadow.getElementById('hdr-img');
    var eName = shadow.getElementById('e-name');
    var eGreet = shadow.getElementById('e-greet');
    var eImg = shadow.getElementById('e-img');
    var emptyEl = shadow.getElementById('b-empty');
    var msgsEl = shadow.getElementById('b-msgs');
    var inputEl = shadow.getElementById('b-inp');
    var sendBtn = shadow.getElementById('b-send');
    var callBtn = shadow.getElementById('b-call');
    var closeBtn = shadow.getElementById('b-close');
    var resetBtn = shadow.getElementById('b-reset');
    var attachBtn = shadow.getElementById('b-attach');
    var attachBar = shadow.getElementById('b-attach-bar');
    var attachName = shadow.getElementById('b-attach-name');
    var attachRm = shadow.getElementById('b-attach-rm');
    var pendingFile = null;

    // Hidden file input
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,.pdf,.doc,.docx,.txt,.csv';
    fileInput.style.display = 'none';
    shadow.appendChild(fileInput);

    // ── Config ──
    function applyConfig(cfg) {
      accent = cfg.color || '#7C3AED';
      styles.textContent = WIDGET_CSS(accent);
      hName.textContent = cfg.name || 'AI Assistant';
      eName.textContent = cfg.name || 'AI Assistant';
      if (cfg.greeting) eGreet.textContent = cfg.greeting;
      var av = cfg.avatar_url || avatarUrl;
      hImg.src = av; eImg.src = av;
      sendBtn.style.background = '#D1D5DB';
      callBtn.style.background = accent;
      if (cfg.position === 'bottom-left') { root.classList.remove('br'); root.classList.add('bl'); }
      // Use backend WS URL if provided
      if (cfg.ws_url) wsBase = cfg.ws_url;
    }

    // ── Messages ──
    function showMsgs() { emptyEl.classList.add('hidden'); msgsEl.classList.remove('hidden'); }

    function addMsg(text, role) {
      showMsgs();
      var m = document.createElement('div');
      m.className = 'msg ' + (role === 'user' ? 'u' : 'a');
      m.textContent = text;
      msgsEl.appendChild(m);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      messages.push({ role: role, content: text });
    }

    function addTyping() {
      showMsgs();
      var t = document.createElement('div');
      t.className = 'msg a typing'; t.id = 'b-typing';
      t.innerHTML = '<span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>';
      msgsEl.appendChild(t); msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    function rmTyping() { var t = shadow.getElementById('b-typing'); if (t) t.remove(); }

    function reset() {
      messages = []; msgsEl.innerHTML = ''; msgsEl.classList.add('hidden'); emptyEl.classList.remove('hidden');
      currentStreamingMessage = null;
    }

    // ── WebSocket ──
    function connectWS() {
      if (ws && ws.readyState === WebSocket.OPEN) return;
      var url = wsBase + '/ws?type=text_chat&sessionId=' + sessionId;
      if (agentId) url += '&agentId=' + encodeURIComponent(agentId);
      if (teamId) url += '&teamId=' + encodeURIComponent(teamId);
      if (userContext) { try { url += '&ctx=' + encodeURIComponent(btoa(JSON.stringify(userContext))); } catch(e){} }
      ws = new WebSocket(url);
      ws.onopen = function() { wsConnected = true; reconnectAttempts = 0; };
      ws.onmessage = function(e) { try { handleMsg(JSON.parse(e.data)); } catch(x){} };
      ws.onclose = function() {
        wsConnected = false;
        if (reconnectAttempts < 5) { reconnectAttempts++; setTimeout(connectWS, Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)); }
      };
      ws.onerror = function(e) { console.error('[BotaWidget] WS error', e); };
    }

    function handleMsg(d) {
      switch (d.type) {
        case 'text':
          rmTyping();
          if (!currentStreamingMessage) { currentStreamingMessage = document.createElement('div'); currentStreamingMessage.className = 'msg a'; showMsgs(); msgsEl.appendChild(currentStreamingMessage); }
          currentStreamingMessage.textContent += d.text;
          msgsEl.scrollTop = msgsEl.scrollHeight;
          break;
        case 'message': rmTyping(); if (d.content) addMsg(d.content, 'agent'); break;
        case 'end':
          if (currentStreamingMessage) { messages.push({ role: 'assistant', content: currentStreamingMessage.textContent }); currentStreamingMessage = null; }
          break;
        case 'error': rmTyping(); addMsg('Sorry, something went wrong.', 'agent'); break;
      }
    }

    function sendMessage() {
      var text = inputEl.value.trim();
      if (!text && !pendingFile) return;
      inputEl.value = ''; updateSendBtn();
      if (currentStreamingMessage) { messages.push({ role: 'assistant', content: currentStreamingMessage.textContent }); currentStreamingMessage = null; }
      var displayText = pendingFile ? (text ? '\uD83D\uDCCE ' + pendingFile.name + '\n' + text : '\uD83D\uDCCE ' + pendingFile.name) : text;
      addMsg(displayText, 'user');
      addTyping();
      if (ws && ws.readyState === WebSocket.OPEN) {
        var payload = { type: 'message', text: text || '' };
        if (pendingFile) { payload.image = { mimeType: pendingFile.mimeType, data: pendingFile.data, name: pendingFile.name }; }
        ws.send(JSON.stringify(payload));
      }
      else { rmTyping(); addMsg('Connection lost. Please try again.', 'agent'); }
      clearAttachment();
    }

    function updateSendBtn() {
      var hasContent = inputEl.value.trim().length > 0 || !!pendingFile;
      sendBtn.disabled = !hasContent;
      sendBtn.style.background = hasContent ? accent : '#D1D5DB';
    }

    function clearAttachment() {
      pendingFile = null;
      attachBar.classList.add('hidden');
      attachName.textContent = '';
      fileInput.value = '';
      updateSendBtn();
    }

    // ── Heartbeat ──
    setInterval(function() { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 30000);

    // ── Events ──
    fab.addEventListener('click', function() {
      win.classList.remove('hidden'); fab.classList.add('hidden');
      widgetOpen = true; inputEl.focus();
      if (!wsConnected) connectWS();
    });
    closeBtn.addEventListener('click', function() { win.classList.add('hidden'); fab.classList.remove('hidden'); widgetOpen = false; });
    resetBtn.addEventListener('click', reset);

    // Attachment events
    attachBtn.addEventListener('click', function() { fileInput.click(); });
    fileInput.addEventListener('change', function() {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var dataUrl = ev.target.result;
        var base64 = dataUrl.split(',')[1];
        pendingFile = { mimeType: file.type, data: base64, name: file.name };
        attachName.textContent = '\uD83D\uDCCE ' + file.name;
        attachBar.classList.remove('hidden');
        updateSendBtn();
      };
      reader.readAsDataURL(file);
    });
    attachRm.addEventListener('click', clearAttachment);
    inputEl.addEventListener('input', updateSendBtn);
    inputEl.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey && inputEl.value.trim()) { e.preventDefault(); sendMessage(); } });
    sendBtn.addEventListener('click', sendMessage);
    callBtn.addEventListener('click', function() {
      // Voice call placeholder — connect to voice_chat WS
      callActive = !callActive;
      if (callActive) {
        callBtn.className = 'cbtn end';
        callBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.58.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.58 1 1 0 01-.25 1.02l-2.2 2.19z"/></svg>';
        callBtn.querySelector('svg').style.transform = 'rotate(135deg)';
      } else {
        callBtn.className = 'cbtn';
        callBtn.style.background = accent;
        callBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.58.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.58 1 1 0 01-.25 1.02l-2.2 2.19z"/></svg>';
      }
    });

    // ── Animated bars idle animation ──
    var barEls = barsEl.querySelectorAll('.fab-bar');
    function animateBars() {
      var t = Date.now() / 1000;
      var freqs = [1.2, 1.8, 2.5, 2.0, 1.5];
      for (var i = 0; i < barEls.length; i++) {
        var h = 6 + 10 * (0.5 + 0.5 * Math.sin(t * freqs[i]));
        barEls[i].style.height = h + 'px';
      }
      requestAnimationFrame(animateBars);
    }
    animateBars();

    // ── Bootstrap ──
    var cfgUrl = apiBase + '/api/widget/config?' + (agentId ? 'agentId=' + encodeURIComponent(agentId) : 'teamId=' + encodeURIComponent(teamId || ''));
    fetch(cfgUrl)
      .then(function(r) { if (!r.ok) throw new Error('Config fail'); return r.json(); })
      .then(function(cfg) { config = cfg; applyConfig(cfg); connectWS(); })
      .catch(function(err) { console.error('[BotaWidget] Config error:', err); connectWS(); });
  }

  // ── Auto-init from script tag ──
  var _cs = document.currentScript;
  if (_cs && _cs.getAttribute('data-agent-id')) {
    initWidget(_cs.getAttribute('data-agent-id'), _cs.getAttribute('data-api-base') || window.location.origin, _cs.getAttribute('data-ws-base'));
  }

  // ── Custom element ──
  if (typeof customElements !== 'undefined' && !customElements.get('bota-widget')) {
    var BWE = function() { return HTMLElement.apply(this, arguments) || this; };
    BWE.prototype = Object.create(HTMLElement.prototype);
    BWE.prototype.constructor = BWE;
    BWE.prototype.connectedCallback = function() {
      var aid = this.getAttribute('agent-id'); if (!aid) return;
      initWidget(aid, this.getAttribute('api-base') || window.location.origin, this.getAttribute('ws-base'));
    };
    try { customElements.define('bota-widget', BWE); } catch(e) {}
  }

  // ── JS API ──
  global.BotaWidget = {
    init: function(agentId, opts) {
      opts = opts || {};
      initWidget(agentId || opts.agentId || '', opts.apiBase || window.location.origin, opts.wsBase, opts.userContext, opts.teamId);
    },
    version: '2.0.0',
  };

})(window);
