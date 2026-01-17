class RecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const inputChannel = input[0];
      
      // Fill internal buffer
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex++] = inputChannel[i];
        
        // When buffer is full, send to main thread
        if (this.bufferIndex >= this.bufferSize) {
          this.port.postMessage(this.buffer.slice());
          this.bufferIndex = 0;
        }
      }
    }
    return true; // Keep processor alive
  }
}

registerProcessor('recorder-worklet', RecorderWorklet);
