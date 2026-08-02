import { EffectsChain } from "./EffectsChain";
import type { AudioEngine } from "./AudioEngine";

export interface ExportParams {
  volume: number;
  isBypassed: boolean;
  distortion: number;
  enableDistortion: boolean;
  filterType: BiquadFilterType;
  filterCutoff: number;
  filterResonance: number;
  enableFilter: boolean;
  eqLowGain: number;
  eqMidGain: number;
  eqHighGain: number;
  enableEq: boolean;
  delayMix: number;
  delayTime: number;
  feedback: number;
  enableDelay: boolean;
  reverbMix: number;
  enableReverb: boolean;
  enableCompressor: boolean;
  compThreshold: number;
  compRatio: number;
  compAttack: number;
  compRelease: number;
}

/**
 * Renders the current buffer through an offline copy of the EffectsChain and
 * encodes it as a 16-bit PCM WAV. Reuses the same chain builder used live,
 * removing the duplicated offline-graph logic from the old component.
 */
export async function exportBufferToWav(
  engine: AudioEngine,
  params: ExportParams,
  name: string
): Promise<void> {
  const sourceBuffer = engine.currentBuffer;
  if (!sourceBuffer) return;

  const sampleRate = sourceBuffer.sampleRate;
  const duration = sourceBuffer.duration;

  const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const lengthFrames = Math.max(1, Math.round(sampleRate * Math.max(0.001, duration)));
  const offlineCtx = new OfflineCtx(sourceBuffer.numberOfChannels, lengthFrames, sampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = sourceBuffer;

  if (params.isBypassed) {
    source.connect(offlineCtx.destination);
  } else {
    const chain = new EffectsChain(offlineCtx, {
      volume: params.volume,
      bypassRoute: false,
      distortion: params.distortion,
      enableDistortion: params.enableDistortion,
      filterType: params.filterType,
      filterCutoff: params.filterCutoff,
      filterResonance: params.filterResonance,
      enableFilter: params.enableFilter,
      eqLowGain: params.enableEq ? params.eqLowGain : 0,
      eqMidGain: params.enableEq ? params.eqMidGain : 0,
      eqHighGain: params.enableEq ? params.eqHighGain : 0,
      delayTime: params.delayTime,
      delayMix: params.enableDelay ? params.delayMix : 0,
      feedback: params.feedback,
      reverbMix: params.enableReverb ? params.reverbMix : 0,
      enableCompressor: params.enableCompressor,
      compThreshold: params.compThreshold,
      compRatio: params.compRatio,
      compAttack: params.compAttack,
      compRelease: params.compRelease,
    });
    source.connect(chain.input);
  }

  source.start(0);
  const renderedBuffer = await offlineCtx.startRendering();
  const wavBuffer = encodeWavPCM(renderedBuffer);

  if (window.electronAPI) {
    await window.electronAPI.saveWav(wavBuffer);
  } else {
    downloadWav(wavBuffer, name);
  }
}

function encodeWavPCM(renderedBuffer: AudioBuffer): ArrayBuffer {
  const numOfChan = renderedBuffer.numberOfChannels;
  const sampleRate = renderedBuffer.sampleRate;
  const length = renderedBuffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));

  let pos = 0;
  const setUint16 = (data: number) => {
    out.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data: number) => {
    out.setUint32(pos, data, true);
    pos += 4;
  };

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  const channels: Float32Array[] = [];
  for (let i = 0; i < renderedBuffer.numberOfChannels; i++) {
    channels.push(renderedBuffer.getChannelData(i));
  }

  let offset = 0;
  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return out.buffer.slice(0);
}

function downloadWav(buffer: ArrayBuffer, name: string): void {
  const blob = new Blob([buffer], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}_FX_SCULPTED.wav`;
  a.click();
  URL.revokeObjectURL(url);
}