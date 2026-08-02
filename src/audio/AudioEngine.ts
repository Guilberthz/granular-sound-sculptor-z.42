import { EffectsChain } from "./EffectsChain";
import type { SampleType } from "../types";

export type SampleWaveType = SampleType;

export interface EngineCallbacks {
  onPlayhead?: (pos: number) => void;
  onStopped?: () => void;
}

/**
 * Encapsulates all Web Audio graph, transport, granular scheduling and
 * playback-source management. The React layer only drives this via methods and
 * reads the exposed analyser plus callbacks; it never touches AudioContext
 * nodes directly.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private chain: EffectsChain | null = null;

  private buffer: AudioBuffer | null = null;
  private customSource = false;

  private cursor = 0;
  private isPlaying = false;
  private granularEnabled = true;
  private bypass = false;
  private looping = true;
  private loopStart: number | null = null;
  private loopEnd: number | null = null;

  // Granular modulation values (mirrored here so the scheduler isn't dependent
  // on React render timing; the hook syncs them through the setters).
  private grainDensity = 30;
  private grainSize = 0.2;
  private pitchShift = 1.0;
  private spray = 0.08;
  private textureMix = 0.8;
  private harmonicMode: "none" | "octaves" | "fifths" | "minor_pentatonic" | "major" | "whole_tone" = "none";

  private nextGrainTime = 0;
  private lastTick = 0;
  private scheduledSources = new Set<AudioBufferSourceNode>();
  private grainSchedulerToken: number | null = null;

  /**
   * Lookahead scheduling constants. The scheduler wakes every
   * {@link TIMER_INTERVAL}ms and emits every grain whose start time falls
   * within {@link LOOKAHEAD_SECONDS} of the audio clock (`ctx.currentTime`).
   * Because grain start times are derived from this.context.currentTime (not
   * the wall clock), grains land on the device clock regardless of how late the
   * scheduler timer actually fires. A shorter TIMER_INTERVAL reduces the gap
   * between the lookahead horizon moving and new grains being scheduled,
   * which tightens grain-boundary timing and cuts audible jitter.
   */
  private static readonly TIMER_INTERVAL_MS = 25;
  private static readonly LOOKAHEAD_SECONDS = 0.25;
  /** Hard cap on grains emitted per scheduler tick, to avoid a burst of
   *  dead grains after a tab-throttling stall. */
  private static readonly MAX_GRAINS_PER_TICK = 96;

  // Positioned (non-granular) playback sources.
  private bypassSource: AudioBufferSourceNode | null = null;
  private cleanSource: AudioBufferSourceNode | null = null;

  private readonly callbacks: EngineCallbacks;

  constructor(callbacks: EngineCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /** Lazily create the context + chain. Returns the context or null. */
  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;

    const ctx = new Ctor();
    const chain = new EffectsChain(ctx, {
      delayTime: 0.4,
      delayMix: 0,
      feedback: 0.3,
      reverbMix: 0,
      distortion: 0,
      enableDistortion: true,
      filterType: "lowpass",
      filterCutoff: 2000,
      filterResonance: 1,
      enableFilter: false,
      eqLowGain: 0,
      eqMidGain: 0,
      eqHighGain: 0,
      enableCompressor: false,
      compThreshold: -24,
      compRatio: 3,
      compAttack: 0.003,
      compRelease: 0.25,
      bypassRoute: true,
      volume: 0.75,
    });

    this.ctx = ctx;
    this.chain = chain;
    return ctx;
  }

  get analyser(): AnalyserNode | null {
    return this.chain?.analyser ?? null;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get currentBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  get duration(): number {
    return this.buffer?.duration ?? 0;
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get isCustom(): boolean {
    return this.customSource;
  }

  // ---- Buffer / sample ------------------------------------------------

  setBuffer(buffer: AudioBuffer, custom: boolean): void {
    this.buffer = buffer;
    this.customSource = custom;
    this.cursor = 0;
    this.onCursorChanged();
    this.syncPositionedSource();
  }

  /** Generate a procedural preset buffer at a given frequency/duration. */
  generatePresetBuffer(waveType: SampleWaveType, freq: number, duration = 4.0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const sr = ctx.sampleRate;
    const buffer = ctx.createBuffer(2, sr * duration, sr);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sr;
      let val = 0;
      if (waveType === "synth") {
        val =
          0.6 * Math.sin(2 * Math.PI * freq * t) +
          0.2 * Math.sin(2 * Math.PI * freq * 2.01 * t) +
          0.15 * Math.sin(2 * Math.PI * freq * 0.5 * t);
      } else if (waveType === "texture") {
        const noise = Math.random() * 2 - 1;
        const hum = Math.sin(2 * Math.PI * freq * t);
        val = noise * 0.25 + hum * 0.75;
      } else {
        val = (Math.random() * 2 - 1) * 0.4;
      }
      left[i] = val;
      right[i] = val + (Math.random() * 0.04 - 0.02);
    }

    this.buffer = buffer;
    this.cursor = 0;
    this.onCursorChanged();
    this.syncPositionedSource();
  }

  // -------------------------------------------------------------------------
  // Transport
  // -------------------------------------------------------------------------

  resumeIfNeeded(): void {
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
  }

  private snapCursorToRegion(): void {
    const dur = this.buffer?.duration;
    if (!dur || this.loopStart === null || this.loopEnd === null) return;
    const a = this.loopStart * dur;
    const b = this.loopEnd * dur;
    if (b - a <= 0.005) return;
    if (this.cursor < a || this.cursor > b) {
      this.cursor = a;
      this.onCursorChanged();
    }
  }

  play(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this.buffer) return;
    this.resumeIfNeeded();
    this.snapCursorToRegion();
    this.isPlaying = true;
    this.nextGrainTime = ctx.currentTime + 0.05;
    this.lastTick = performance.now();
    this.startScheduler();
    this.syncPositionedSource();
  }

  pause(): void {
    this.isPlaying = false;
    this.stopGrainScheduler();
    this.stopScheduledGrains();
    this.stopPositionedSources();
  }

  togglePlayback(): void {
    if (this.isPlaying) this.pause();
    else this.play();
  }

replay(): void {
    this.cursor = 0;
    this.snapCursorToRegion();
    this.onCursorChanged();
    this.play();
  }

  seek(pos: number): void {
    const dur = this.buffer?.duration;
    if (!dur) return;
    const clamped = Math.max(0, Math.min(1, pos));
    if (Math.abs(clamped - this.cursor / dur) < 0.0005) return;
    this.cursor = clamped * dur;
    this.onCursorChanged();
    if (this.ctx) this.nextGrainTime = this.ctx.currentTime + 0.05;
    if (this.isPlaying) this.syncPositionedSource();
  }

  // -------------------------------------------------------------------------
  // Looping / regions
  // -------------------------------------------------------------------------

  applyLoopRegion(a: number, b: number): void {
    const start = Math.max(0, Math.min(1, Math.min(a, b)));
    const end = Math.max(0, Math.min(1, Math.max(a, b)));
    this.loopStart = start;
    this.loopEnd = end;
    this.looping = true;
    if (this.isPlaying) this.syncPositionedSource();
  }

  clearLoopRegion(): void {
    this.loopStart = null;
    this.loopEnd = null;
    if (this.isPlaying) this.syncPositionedSource();
  }

  toggleLoop(): void {
    this.looping = !this.looping;
    if (this.isPlaying) this.syncPositionedSource();
  }

  setLoopEnabled(enabled: boolean): void {
    this.looping = enabled;
  }

  getLoopRegion(): { start: number | null; end: number | null } {
    return { start: this.loopStart, end: this.loopEnd };
  }

  // -------------------------------------------------------------------------
  // Parameter setters (React pushes values here; scheduler + chain read them)
  // -------------------------------------------------------------------------

  setVolume(v: number): void {
    this.chain?.setVolume(v);
  }

  setFeedback(v: number): void {
    this.chain?.setFeedback(v);
  }

  setDelay(time: number, mix: number): void {
    this.chain?.setDelay(time, mix);
  }

  setReverb(mix: number): void {
    this.chain?.setReverb(mix);
  }

  setDistortion(amount: number): void {
    this.chain?.setDistortion(amount);
  }

  setDistortionEnabled(e: boolean): void {
    this.chain?.setDistortionEnabled(e);
  }

  setFilter(type: BiquadFilterType, cutoff: number, resonance: number): void {
    this.chain?.setFilter(type, cutoff, resonance);
  }

  setFilterEnabled(e: boolean): void {
    this.chain?.setFilterEnabled(e);
  }

  setEq(low: number, mid: number, high: number): void {
    this.chain?.setEq(low, mid, high);
  }

  setCompressor(p: { enabled: boolean; threshold: number; ratio: number; attack: number; release: number }): void {
    this.chain?.setCompressor(p);
  }

  setGranularEnabled(e: boolean): void {
    this.granularEnabled = e;
    if (this.isPlaying) this.syncPositionedSource();
  }

  setBypass(b: boolean): void {
    this.bypass = b;
    if (this.isPlaying) this.syncPositionedSource();
  }

  setGrainDensity(v: number): void {
    this.grainDensity = v;
  }

  setGrainSize(v: number): void {
    this.grainSize = v;
  }

  setPitchShift(v: number): void {
    this.pitchShift = v;
  }

  setSpray(v: number): void {
    this.spray = v;
  }

  setTextureMix(v: number): void {
    this.textureMix = v;
  }

  setHarmonicMode(m: AudioEngine["harmonicMode"]): void {
    this.harmonicMode = m;
  }

  // -------------------------------------------------------------------------
  // Recording hook
  // -------------------------------------------------------------------------

  createRecordingDest(): MediaStreamAudioDestinationNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const dest = ctx.createMediaStreamDestination();
    this.chain?.connectRecording(dest);
    return dest;
  }

  disconnectRecording(dest: MediaStreamAudioDestinationNode): void {
    this.chain?.disconnectRecording(dest);
  }

  // -------------------------------------------------------------------------
  // Internals: scheduler + grains + positioned sources
  // -------------------------------------------------------------------------

  private onCursorChanged(): void {
    if (this.buffer && this.buffer.duration > 0) {
      this.callbacks.onPlayhead?.(Math.min(1, Math.max(0, this.cursor / this.buffer.duration)));
    }
  }

  private harmonicPitchFactor(basePitch: number): number {
    if (this.harmonicMode === "none") {
      return basePitch * (1 + (Math.random() * 0.04 - 0.02));
    }

    let ratios = [1.0];
    if (this.harmonicMode === "octaves") ratios = [0.5, 1.0, 2.0];
    else if (this.harmonicMode === "fifths") ratios = [0.75, 1.0, 1.5, 2.0];
    else if (this.harmonicMode === "minor_pentatonic") ratios = [1.0, 1.2, 1.333, 1.5, 1.778, 2.0];
    else if (this.harmonicMode === "major") ratios = [0.5, 1.0, 1.125, 1.25, 1.333, 1.5, 1.667, 2.0];
    else if (this.harmonicMode === "whole_tone") ratios = [0.5, 1.0, 1.122, 1.26, 1.414, 1.588, 1.782, 2.0];

    const chosen = ratios[Math.floor(Math.random() * ratios.length)];
    return basePitch * chosen;
  }

  private stopScheduledGrains(): void {
    const now = this.ctx?.currentTime ?? 0;
    this.scheduledSources.forEach((src) => {
      try {
        src.stop(now);
      } catch {
        /* noop */
      }
      try {
        src.disconnect();
      } catch {
        /* noop */
      }
    });
    this.scheduledSources.clear();
  }

  private stopPositionedSources(): void {
    this.stopSource(this.bypassSource);
    this.bypassSource = null;
    this.stopSource(this.cleanSource);
    this.cleanSource = null;
  }

  private stopSource(ref: AudioBufferSourceNode | null): void {
    if (!ref) return;
    try {
      ref.stop();
    } catch {
      /* noop */
    }
    try {
      ref.disconnect();
    } catch {
      /* noop */
    }
  }

  private spawnGrainAt(grainTime: number, baseOffset: number): void {
    const ctx = this.ctx;
    const buffer = this.buffer;
    const fxIn = this.chain?.input;
    if (!ctx || !buffer || !fxIn) return;

    const dur = buffer.duration;
    let pos = baseOffset;
    if (this.looping) {
      const ls = this.loopStart;
      const le = this.loopEnd;
      if (ls !== null && le !== null && le - ls > 0.005) {
        const a = ls * dur;
        const len = (le - ls) * dur;
        pos = a + ((((pos - a) % len) + len) % len);
      } else {
        pos = ((pos % dur) + dur) % dur;
      }
    } else {
      pos = Math.min(Math.max(0, pos), Math.max(0, dur - this.grainSize));
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.harmonicPitchFactor(this.pitchShift);

    const grainGain = ctx.createGain();
    const attack = this.grainSize * 0.3;
    const peak = Math.max(0.0001, this.textureMix * 0.5);
    grainGain.gain.setValueAtTime(0, grainTime);
    grainGain.gain.linearRampToValueAtTime(peak, grainTime + attack);
    grainGain.gain.exponentialRampToValueAtTime(0.0001, grainTime + this.grainSize);

    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = Math.random() * 2 - 1;
      source.connect(panner);
      panner.connect(grainGain);
    } else {
      source.connect(grainGain);
    }
    grainGain.connect(fxIn);

    const maxOffset = Math.max(0, dur - this.grainSize);
    const offset = Math.min(maxOffset, Math.max(0, pos + (Math.random() * this.spray - this.spray / 2)));
    const len = this.grainSize + 0.05;

    source.start(grainTime, offset, len);
    source.stop(grainTime + len);
    this.scheduledSources.add(source);
    source.onended = () => {
      this.scheduledSources.delete(source);
    };
  }

  private advanceAndTick(): void {
    const ctx = this.ctx;
    const buffer = this.buffer;
    if (!ctx || !buffer) return;

    const now = performance.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;

    if (this.isPlaying) {
      this.cursor += dt;
      const dur = buffer.duration;
      if (this.looping) {
        const ls = this.loopStart;
        const le = this.loopEnd;
        if (ls !== null && le !== null && le - ls > 0.005) {
          const a = ls * dur;
          const len = (le - ls) * dur;
          if (this.cursor >= a + len) this.cursor = a + ((this.cursor - a) % len);
          else if (this.cursor < a) this.cursor = a;
        } else if (this.cursor >= dur) {
          this.cursor = this.cursor % dur;
        }
      } else if (this.cursor >= dur) {
        this.cursor = dur;
        this.isPlaying = false;
        this.stopGrainScheduler();
        this.stopScheduledGrains();
        this.stopPositionedSources();
        this.callbacks.onStopped?.();
      }
      this.onCursorChanged();
    }

    if (!this.isPlaying || this.bypass || !this.granularEnabled) return;

    const nowClock = ctx.currentTime;

    // If the scheduler fell far behind the audio clock (tab throttling, etc.)
    // jump the emission time forward rather than spooling a backlog of
    // back-dated grains that would all fire instantly as a dense burst.
    if (this.nextGrainTime < nowClock - AudioEngine.LOOKAHEAD_SECONDS) {
      this.nextGrainTime = nowClock + 50 / 1000;
    }

    const horizon = nowClock + AudioEngine.LOOKAHEAD_SECONDS;
    const intervalSec = 1 / Math.max(1, this.grainDensity);
    let spawned = 0;
    while (this.nextGrainTime < horizon && spawned < AudioEngine.MAX_GRAINS_PER_TICK) {
      const grainTime = this.nextGrainTime;
      const offset = this.cursor + (grainTime - nowClock);
      this.spawnGrainAt(grainTime, offset);
      this.nextGrainTime += intervalSec;
      spawned++;
    }
  }

  private startScheduler(): void {
    if (this.grainSchedulerToken !== null) return;
    this.scheduleNextTick();
  }

  private scheduleNextTick(): void {
    this.grainSchedulerToken = window.setTimeout(() => {
      this.grainSchedulerToken = null;
      this.advanceAndTick();
      if (this.isPlaying) this.scheduleNextTick();
    }, AudioEngine.TIMER_INTERVAL_MS);
  }

  private stopGrainScheduler(): void {
    if (this.grainSchedulerToken !== null) {
      clearTimeout(this.grainSchedulerToken);
      this.grainSchedulerToken = null;
    }
  }

  private syncPositionedSource(): void {
    const ctx = this.ctx;
    const buffer = this.buffer;
    if (!ctx || !buffer || !this.chain) return;

    this.stopPositionedSources();
    if (!this.isPlaying) return;
    this.resumeIfNeeded();

    const dur = buffer.duration;
    const ls = this.loopStart;
    const le = this.loopEnd;
    const regionActive = ls !== null && le !== null && le - ls > 0.005;
    const loopA = regionActive ? ls * dur : 0;
    const loopB = regionActive ? le * dur : dur;
    const pos = regionActive
      ? Math.max(loopA, Math.min(this.cursor, Math.max(loopA, loopB - 0.001)))
      : Math.min(this.cursor, Math.max(0, dur - 0.001));
    const applyRegion = (source: AudioBufferSourceNode) => {
      if (regionActive) {
        source.loopStart = loopA;
        source.loopEnd = loopB;
      }
    };

    if (this.bypass) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = this.looping;
      applyRegion(source);
      source.playbackRate.value = 1.0;
      source.connect(this.chain.bypassGain);
      source.start(0, pos);
      this.bypassSource = source;
    } else if (!this.granularEnabled && this.chain.input) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = this.looping;
      applyRegion(source);
      source.playbackRate.value = 1.0;
      source.connect(this.chain.input);
      source.start(0, pos);
      this.cleanSource = source;
    }
  }

  dispose(): void {
    this.stopGrainScheduler();
    this.stopScheduledGrains();
    this.stopPositionedSources();
    this.chain?.dispose();
    this.ctx = null;
    this.chain = null;
  }
}
