"use client";

/**
 * RNNoise audio processor using @shiguredo/rnnoise-wasm
 * 
 * Processes microphone audio through Mozilla's RNNoise deep learning model
 * for superior background noise removal. Uses Web Audio API to pipe audio
 * through the WASM-based RNNoise denoiser in real-time.
 */

let rnnoiseInstance: any = null;

async function getRnnoise() {
  if (rnnoiseInstance) return rnnoiseInstance;
  const { Rnnoise } = await import("@shiguredo/rnnoise-wasm");
  rnnoiseInstance = await Rnnoise.load();
  return rnnoiseInstance;
}

export class RNNoiseProcessor {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private denoiseState: any = null;
  private inputBuffer: Float32Array = new Float32Array(0);
  private frameSize = 480; // RNNoise frame size (480 samples at 48kHz = 10ms)
  private active = false;

  /**
   * Start processing a mic MediaStreamTrack through RNNoise.
   * Returns a new MediaStreamTrack with noise removed.
   */
  async start(micTrack: MediaStreamTrack): Promise<MediaStreamTrack> {
    // Load RNNoise WASM
    const rnnoise = await getRnnoise();
    this.denoiseState = rnnoise.createDenoiseState();
    this.frameSize = rnnoise.frameSize; // typically 480

    // Create AudioContext at 48kHz (RNNoise's expected sample rate)
    this.audioContext = new AudioContext({ sampleRate: 48000 });

    // Source: mic track → AudioContext
    const micStream = new MediaStream([micTrack]);
    this.sourceNode = this.audioContext.createMediaStreamSource(micStream);

    // ScriptProcessor for real-time processing
    // Buffer size 4096 gives ~85ms latency at 48kHz — good balance
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.inputBuffer = new Float32Array(0);

    this.processorNode.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const output = event.outputBuffer.getChannelData(0);

      // Concatenate new input to buffer
      const newBuffer = new Float32Array(this.inputBuffer.length + input.length);
      newBuffer.set(this.inputBuffer);
      newBuffer.set(input, this.inputBuffer.length);
      this.inputBuffer = newBuffer;

      // Process complete frames through RNNoise
      let outputOffset = 0;
      const processed = new Float32Array(input.length);

      while (this.inputBuffer.length >= this.frameSize) {
        // Extract one frame
        const frame = new Float32Array(this.frameSize);
        frame.set(this.inputBuffer.subarray(0, this.frameSize));

        // Scale to 16-bit PCM range (RNNoise expects this)
        for (let i = 0; i < frame.length; i++) {
          frame[i] = frame[i] * 32768;
        }

        // Process through RNNoise
        this.denoiseState.processFrame(frame);

        // Scale back to float range
        for (let i = 0; i < frame.length; i++) {
          frame[i] = frame[i] / 32768;
        }

        // Copy processed samples to output
        const samplesToWrite = Math.min(frame.length, processed.length - outputOffset);
        if (samplesToWrite > 0) {
          processed.set(frame.subarray(0, samplesToWrite), outputOffset);
          outputOffset += samplesToWrite;
        }

        // Remove processed samples from buffer
        this.inputBuffer = this.inputBuffer.subarray(this.frameSize);
      }

      // Write to output
      output.set(processed);
    };

    // Destination: processed audio → new MediaStream
    this.destinationNode = this.audioContext.createMediaStreamDestination();

    // Connect the pipeline: mic → processor → destination
    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.destinationNode);

    this.active = true;

    // Return the processed audio track
    return this.destinationNode.stream.getAudioTracks()[0];
  }

  /**
   * Stop processing and clean up all resources
   */
  stop() {
    this.active = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.destinationNode) {
      this.destinationNode.disconnect();
      this.destinationNode = null;
    }
    if (this.denoiseState) {
      this.denoiseState.destroy();
      this.denoiseState = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.inputBuffer = new Float32Array(0);
  }

  get isActive() {
    return this.active;
  }
}
