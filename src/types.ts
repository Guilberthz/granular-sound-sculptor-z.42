export type HarmonicMode = "none" | "octaves" | "fifths" | "minor_pentatonic" | "major" | "whole_tone";

export interface PresetSample {
  id: string;
  name: string;
  code: string;
  freq: number;
  type: "synth" | "texture" | "noise";
}

export interface PresetParams {
  grainDensity: number;
  grainSize: number;
  pitchShift: number;
  spray: number;
  harmonicMode: HarmonicMode;
  distortion: number;
  reverbMix: number;
  delayMix: number;
  enableGranular: boolean;
  enableDistortion: boolean;
  enableReverb: boolean;
  enableDelay: boolean;
  isGlitchVoid: boolean;
  glowIntensity: number;
  enableFilter: boolean;
  filterType: BiquadFilterType;
  filterCutoff: number;
  filterResonance: number;
  enableCompressor: boolean;
  compThreshold: number;
  compRatio: number;
  compAttack: number;
  compRelease: number;
  enableEq: boolean;
  eqLowGain: number;
  eqMidGain: number;
  eqHighGain: number;
}

export type ParticleMode = "dots" | "blur" | "rings" | "blackhole";
