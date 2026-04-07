// AudioWorklet processor for capturing microphone audio
// Converts Float32 samples to Int16 PCM for WebSocket transmission

class AudioSendProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 512 samples @ 24kHz ≈ 21ms — within the 20–40ms recommended chunk size.
    // AudioWorklet delivers 128 samples/block, so 512 = exactly 4 blocks.
    this.bufferSize = 512;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const channelData = input[0];

    // Accumulate samples into buffer
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];

      // When buffer is full, convert and send
      if (this.bufferIndex >= this.bufferSize) {
        this.sendBuffer();
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  sendBuffer() {
    // Convert Float32 (-1 to 1) to Int16 (-32768 to 32767)
    const int16 = new Int16Array(this.bufferSize);
    for (let i = 0; i < this.bufferSize; i++) {
      // Clamp to -1 to 1 range
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      // Convert to Int16
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Send to main thread
    this.port.postMessage(int16.buffer, [int16.buffer]);

    // Reset buffer
    this.buffer = new Float32Array(this.bufferSize);
  }
}

registerProcessor('audio-send-processor', AudioSendProcessor);
