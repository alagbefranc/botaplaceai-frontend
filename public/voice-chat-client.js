// Voice Chat Client Library
// Handles browser-side audio capture and playback for voice chat with Gemini Live API

class VoiceChatClient {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl;
    this.agentId = options.agentId;
    this.sessionId = options.sessionId || this.generateSessionId();
    
    // Callbacks
    this.onConnected = options.onConnected || (() => {});
    this.onDisconnected = options.onDisconnected || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onToolAction = options.onToolAction || (() => {});
    this.onError = options.onError || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});

    // Audio contexts
    this.captureCtx = null;
    this.playbackCtx = null;
    this.workletNode = null;
    this.mediaStream = null;
    this.ws = null;

    // State
    this.isConnected = false;
    this.isMuted = false;
    this.isPlaying = false;

    // Audio queue for smooth playback
    this.audioQueue = [];
    this.nextPlayTime = 0;

    // Track active BufferSourceNodes so we can stop them immediately on interrupt
    this.activeAudioSources = [];

    // Sample rate for Gemini Live API
    this.sampleRate = 24000;
  }

  generateSessionId() {
    return 'voice_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  async connect() {
    try {
      // 1. Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // 2. Set up audio capture context
      this.captureCtx = new AudioContext({ sampleRate: this.sampleRate });
      
      // Load the AudioWorklet processor
      await this.captureCtx.audioWorklet.addModule('/audio-worklet-processor.js');
      
      const source = this.captureCtx.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.captureCtx, 'audio-send-processor');

      // 3. Set up playback context
      this.playbackCtx = new AudioContext({ sampleRate: this.sampleRate });

      // 4. Connect to WebSocket
      const wsUrl = `${this.wsUrl}/ws?type=voice_chat&agentId=${this.agentId}&sessionId=${this.sessionId}`;
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      // 5. Handle WebSocket events
      this.ws.onopen = () => {
        console.log('[VoiceChat] WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Binary data = audio from Gemini
          this.playAudioChunk(event.data);
        } else {
          // JSON = control messages
          try {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch (err) {
            console.error('[VoiceChat] Failed to parse message:', err);
          }
        }
      };

      this.ws.onclose = () => {
        console.log('[VoiceChat] WebSocket disconnected');
        this.isConnected = false;
        this.onDisconnected();
        this.cleanup();
      };

      this.ws.onerror = (error) => {
        console.error('[VoiceChat] WebSocket error:', error);
        this.onError(new Error('WebSocket connection error'));
      };

      // 6. Send mic audio to WebSocket
      this.workletNode.port.onmessage = (e) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.isMuted) {
          this.ws.send(e.data);
        }
      };

      // Connect audio nodes
      source.connect(this.workletNode);
      // Don't connect to destination - we don't want to hear ourselves

      this.onStatusChange('connecting');

    } catch (error) {
      console.error('[VoiceChat] Failed to connect:', error);
      this.onError(error);
      throw error;
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'connected':
        console.log('[VoiceChat] Session connected:', msg.conversationId);
        this.isConnected = true;
        this.onConnected(msg.conversationId);
        this.onStatusChange('connected');
        break;

      case 'transcript':
        this.onTranscript(msg.role, msg.transcript);
        break;

      case 'tool_action':
        this.onToolAction(msg.tool, msg.args, msg.status);
        break;

      case 'status':
        this.onStatusChange(msg.status);
        break;

      case 'error':
        console.error('[VoiceChat] Server error:', msg.error);
        this.onError(new Error(msg.error));
        break;

      case 'interrupted':
        // Per Google best practices: "When the user speaks while the model is replying,
        // you must immediately discard your client-side audio buffer to prevent the
        // agent from continuing to talk over the user."
        this.clearAudioBuffer();
        break;

      case 'pong':
        // Heartbeat response
        break;
    }
  }

  // Immediately stop all queued/playing audio — called when server signals interruption
  clearAudioBuffer() {
    for (const src of this.activeAudioSources) {
      try { src.stop(); } catch (_) { /* already ended */ }
    }
    this.activeAudioSources = [];
    this.nextPlayTime = 0;
  }

  playAudioChunk(pcmData) {
    if (!this.playbackCtx) return;

    // Convert Int16 PCM to Float32
    const int16 = new Int16Array(pcmData);
    const float32 = new Float32Array(int16.length);
    
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 0x8000;
    }

    // Create audio buffer
    const buffer = this.playbackCtx.createBuffer(1, float32.length, this.sampleRate);
    buffer.getChannelData(0).set(float32);

    // Schedule playback
    const source = this.playbackCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playbackCtx.destination);

    // Track so we can stop it immediately on interrupt
    this.activeAudioSources.push(source);
    source.onended = () => {
      const idx = this.activeAudioSources.indexOf(source);
      if (idx !== -1) this.activeAudioSources.splice(idx, 1);
    };

    // Calculate when to play this chunk
    const currentTime = this.playbackCtx.currentTime;
    const startTime = Math.max(currentTime, this.nextPlayTime);

    source.start(startTime);
    this.nextPlayTime = startTime + buffer.duration;

    // Reset next play time if we've fallen behind
    if (this.nextPlayTime < currentTime) {
      this.nextPlayTime = currentTime;
    }
  }

  mute() {
    this.isMuted = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'mute' }));
    }
    this.onStatusChange('muted');
  }

  unmute() {
    this.isMuted = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unmute' }));
    }
    this.onStatusChange('unmuted');
  }

  toggleMute() {
    if (this.isMuted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.isMuted;
  }

  disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stop' }));
      this.ws.close();
    }
    this.cleanup();
  }

  cleanup() {
    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close audio contexts
    if (this.captureCtx && this.captureCtx.state !== 'closed') {
      this.captureCtx.close();
      this.captureCtx = null;
    }

    if (this.playbackCtx && this.playbackCtx.state !== 'closed') {
      this.playbackCtx.close();
      this.playbackCtx = null;
    }

    this.workletNode = null;
    this.ws = null;
    this.isConnected = false;
    this.isMuted = false;
    this.nextPlayTime = 0;
  }

  // Send heartbeat to keep connection alive
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// Export for use in modules or as global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceChatClient;
} else if (typeof window !== 'undefined') {
  window.VoiceChatClient = VoiceChatClient;
}
