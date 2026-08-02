import { makeDistortionCurve, createReverbImpulse } from "./utils";

export interface ChainInitParams {
  delayTime: number;
  delayMix: number;
  feedback: number;
  reverbMix: number;
  distortion: number;
  enableDistortion: boolean;
  filterType: BiquadFilterType;
  filterCutoff: number;
  filterResonance: number;
  enableFilter: boolean;
  eqLowGain: number;
  eqMidGain: number;
  eqHighGain: number;
  enableCompressor: boolean;
  compThreshold: number;
  compRatio: number;
  compAttack: number;
  compRelease: number;
  /** When true, the raw bypass gain is also routed to the recording destination. */
  bypassRoute: boolean;
  volume: number;
}

/**
 * Owns the Web Audio signal chain: distortion -> filter -> EQ -> (dry/side delay
 * + reverb) -> master -> compressor -> analyser. Also owns the raw `bypassGain`
 * parallel path that feeds straight into the master.
 *
 * The reactive UI never touches AudioContext nodes directly; it calls these
 * setters, preserving the existing signal flow.
 */
export class EffectsChain {
  readonly context: BaseAudioContext;
  readonly input: GainNode;              // FX input: grains / clean sources connect here
  readonly analyser: AnalyserNode;
  readonly master: GainNode;
  readonly compressor: DynamicsCompressorNode;
  readonly bypassGain: GainNode;

  private readonly waveshaper: WaveShaperNode;
  private readonly distLevel: GainNode;
  private readonly distBypass: GainNode;

  private readonly filter: BiquadFilterNode;
  private readonly filterLevel: GainNode;
  private readonly filterBypass: GainNode;

  private readonly eqLow: BiquadFilterNode;
  private readonly eqMid: BiquadFilterNode;
  private readonly eqHigh: BiquadFilterNode;

  private readonly delay: DelayNode;
  private readonly delayGain: GainNode;
  private readonly feedbackGain: GainNode;

  private readonly reverbGain: GainNode;

  private readonly bypassRoute: boolean;

  constructor(ctx: BaseAudioContext, params: ChainInitParams) {
    this.context = ctx;
    this.bypassRoute = params.bypassRoute;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    const master = ctx.createGain();
    master.gain.value = params.volume;

    const waveshaper = ctx.createWaveShaper();
    waveshaper.curve = makeDistortionCurve(params.distortion);

    const distIn = ctx.createGain();
    distIn.gain.value = 1.0;
    const distLevel = ctx.createGain();
    distLevel.gain.value = params.enableDistortion ? 1.0 : 0.0;
    const distBypass = ctx.createGain();
    distBypass.gain.value = params.enableDistortion ? 0.0 : 1.0;

    const filter = ctx.createBiquadFilter();
    filter.type = params.filterType;
    filter.frequency.value = params.filterCutoff;
    filter.Q.value = params.filterResonance;

    const filterIn = ctx.createGain();
    filterIn.gain.value = 1.0;
    const filterLevel = ctx.createGain();
    filterLevel.gain.value = params.enableFilter ? 1.0 : 0.0;
    const filterBypass = ctx.createGain();
    filterBypass.gain.value = params.enableFilter ? 0.0 : 1.0;

    const eqLow = ctx.createBiquadFilter();
    eqLow.type = "lowshelf";
    eqLow.frequency.value = 120;
    eqLow.gain.value = params.eqLowGain;
    const eqMid = ctx.createBiquadFilter();
    eqMid.type = "peaking";
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1.0;
    eqMid.gain.value = params.eqMidGain;
    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = "highshelf";
    eqHigh.frequency.value = 5000;
    eqHigh.gain.value = params.eqHighGain;

    const delay = ctx.createDelay();
    delay.delayTime.value = params.delayTime;
    const delayGain = ctx.createGain();
    delayGain.gain.value = params.delayMix;
    const feedbackGain = ctx.createGain();
    feedbackGain.gain.value = params.feedback;
    delay.connect(delayGain);
    delayGain.connect(feedbackGain);
    feedbackGain.connect(delay);

    const convolver = ctx.createConvolver();
    convolver.buffer = createReverbImpulse(ctx, 3.0, 2.2);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = params.reverbMix;
    convolver.connect(reverbGain);

    const compressor = ctx.createDynamicsCompressor();
    if (params.enableCompressor) {
      compressor.threshold.value = params.compThreshold;
      compressor.ratio.value = params.compRatio;
      compressor.attack.value = params.compAttack;
      compressor.release.value = params.compRelease;
    } else {
      compressor.threshold.value = 0;
      compressor.ratio.value = 1;
      compressor.attack.value = 0.01;
      compressor.release.value = 0.3;
    }

    const bypassGain = ctx.createGain();
    bypassGain.gain.value = 1.0;

    // DISTORTION stage: distIn -> waveshaper -> distLevel -> filterIn
    //                   distIn -> distBypass -> filterIn
    distIn.connect(waveshaper);
    waveshaper.connect(distLevel);
    distLevel.connect(filterIn);
    distIn.connect(distBypass);
    distBypass.connect(filterIn);

    // FILTER stage: filterIn -> filter -> filterLevel -> eqLow
    //                      filterIn -> filterBypass -> eqLow
    filterIn.connect(filter);
    filter.connect(filterLevel);
    filterLevel.connect(eqLow);
    filterIn.connect(filterBypass);
    filterBypass.connect(eqLow);

    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(master);
    eqHigh.connect(delay);
    eqHigh.connect(convolver);

    master.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(ctx.destination);
    bypassGain.connect(master);

    this.analyser = analyser;
    this.master = master;
    this.compressor = compressor;
    this.bypassGain = bypassGain;
    this.input = distIn;
    this.waveshaper = waveshaper;
    this.distLevel = distLevel;
    this.distBypass = distBypass;
    this.filter = filter;
    this.filterLevel = filterLevel;
    this.filterBypass = filterBypass;
    this.eqLow = eqLow;
    this.eqMid = eqMid;
    this.eqHigh = eqHigh;
    this.delay = delay;
    this.delayGain = delayGain;
    this.feedbackGain = feedbackGain;
    this.reverbGain = reverbGain;
  }

  setDelay(time: number, mix: number): void {
    this.delay.delayTime.value = time;
    this.delayGain.gain.value = mix;
  }

  setFeedback(feedback: number): void {
    this.feedbackGain.gain.value = feedback;
  }

  setVolume(volume: number): void {
    this.master.gain.value = volume;
  }

  setReverb(mix: number): void {
    this.reverbGain.gain.value = mix;
  }

  setDistortion(amount: number): void {
    this.waveshaper.curve = makeDistortionCurve(amount);
  }

  setDistortionEnabled(enabled: boolean): void {
    const t = this.context.currentTime;
    this.distLevel.gain.setTargetAtTime(enabled ? 1 : 0, t, 0.005);
    this.distBypass.gain.setTargetAtTime(enabled ? 0 : 1, t, 0.005);
  }

  setFilter(type: BiquadFilterType, cutoff: number, resonance: number): void {
    this.filter.type = type;
    this.filter.frequency.value = cutoff;
    this.filter.Q.value = resonance;
  }

  setFilterEnabled(enabled: boolean): void {
    const t = this.context.currentTime;
    this.filterLevel.gain.setTargetAtTime(enabled ? 1 : 0, t, 0.005);
    this.filterBypass.gain.setTargetAtTime(enabled ? 0 : 1, t, 0.005);
  }

  setEq(low: number, mid: number, high: number): void {
    this.eqLow.gain.value = low;
    this.eqMid.gain.value = mid;
    this.eqHigh.gain.value = high;
  }

  setCompressor(params: {
    enabled: boolean;
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
  }): void {
    if (params.enabled) {
      this.compressor.threshold.value = params.threshold;
      this.compressor.ratio.value = params.ratio;
      this.compressor.attack.value = params.attack;
      this.compressor.release.value = params.release;
    } else {
      this.compressor.threshold.value = 0;
      this.compressor.ratio.value = 1;
      this.compressor.attack.value = 0.01;
      this.compressor.release.value = 0.3;
    }
  }

  /** Connect the uncompressed master + raw bypass to an external destination (recording). */
  connectRecording(dest: AudioNode): void {
    this.compressor.connect(dest);
    if (this.bypassRoute) this.bypassGain.connect(dest);
  }

  disconnectRecording(dest: AudioNode): void {
    try {
      this.compressor.disconnect(dest);
    } catch {
      /* noop */
    }
    try {
      this.bypassGain.disconnect(dest);
    } catch {
      /* noop */
    }
  }

  dispose(): void {
    (this.context as AudioContext).close().catch(() => {});
  }
}