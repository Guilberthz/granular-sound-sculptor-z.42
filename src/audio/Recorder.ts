import type { AudioEngine } from "./AudioEngine";
import { audioBufferToWavBlob } from "./utils";

export interface RecorderCallbacks {
  onStateChange: (recording: boolean) => void;
  onDuration: (seconds: number) => void;
  getName: () => string;
}

/**
 * Wraps MediaRecorder + WebM->WAV conversion and output download. The UI only
 * calls `toggle()`; everything else (graph tap, chunk capture, render, file
 * save) lives here.
 */
export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingDest: MediaStreamAudioDestinationNode | null = null;
  private durationTimer: number | null = null;
  private readonly engine: AudioEngine;
  private readonly callbacks: RecorderCallbacks;

  constructor(engine: AudioEngine, callbacks: RecorderCallbacks) {
    this.engine = engine;
    this.callbacks = callbacks;
  }

  get isRecording(): boolean {
    return this.mediaRecorder !== null;
  }

  toggle(): void {
    if (this.isRecording) this.stop();
    else this.start();
  }

  start(): void {
    const dest = this.engine.createRecordingDest();
    if (!dest) return;
    this.recordingDest = dest;

    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(dest.stream, { mimeType: mime });
    this.recordedChunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };

    recorder.onstop = () => this.handleStop(mime);

    recorder.start();
    this.mediaRecorder = recorder;
    this.startDurationTimer();
    this.callbacks.onStateChange(true);
  }

  stop(): void {
    this.mediaRecorder?.stop();
    if (this.recordingDest) {
      this.engine.disconnectRecording(this.recordingDest);
      this.recordingDest = null;
    }
    this.mediaRecorder = null;
    this.stopDurationTimer();
    this.callbacks.onStateChange(false);
  }

  private handleStop(mime: string): void {
    const blob = new Blob(this.recordedChunks, { type: mime });
    const name = this.callbacks.getName();
    this.decodeAndDownload(blob, name, mime).catch(() => {
      console.error("WAV conversion failed, falling back to original format:", name);
      const fallbackBlob = new Blob(this.recordedChunks, { type: "audio/webm" });
      downloadBlob(fallbackBlob, `${name}_RECORDING.webm`);
    });
  }

  private async decodeAndDownload(blob: Blob, name: string, mime: string): Promise<void> {
    const arrayBuffer = await blob.arrayBuffer();
    const decodeCtx = new OfflineAudioContext(2, 1, 44100);
    const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
    const wavBlob = audioBufferToWavBlob(audioBuffer);
    downloadBlob(wavBlob, `${name}_RECORDING.wav`);
  }

  private startDurationTimer(): void {
    this.stopDurationTimer();
    const start = performance.now();
    this.durationTimer = window.setInterval(() => {
      this.callbacks.onDuration((performance.now() - start) / 1000);
    }, 200);
  }

  private stopDurationTimer(): void {
    if (this.durationTimer !== null) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}