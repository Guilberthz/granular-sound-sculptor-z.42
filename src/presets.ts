import { PresetSample, PresetParams } from "./types";

export const PRESET_SAMPLES: PresetSample[] = [
  { id: "z42", name: "PLANET Z.42", code: "O78-4", freq: 65, type: "synth" },
  { id: "glitch_void", name: "GLITCHED VOID", code: "VOID-ERR", freq: 180, type: "noise" },
  { id: "argon", name: "ARGON VOID", code: "Ar-18", freq: 110, type: "texture" },
  { id: "singularity", name: "SINGULARITY NOISE", code: "Q5-TEST", freq: 220, type: "noise" },
  { id: "delta", name: "DELTA PULSE", code: "D2-459", freq: 40, type: "synth" },
];

export const DEFAULT_PRESET_PARAMS: Record<string, PresetParams> = {
  z42: {
    grainDensity: 30, grainSize: 0.2, pitchShift: 1.0, spray: 0.08,
    harmonicMode: "none", distortion: 5, reverbMix: 0.85, delayMix: 0.5,
    enableGranular: true, enableDistortion: true, enableReverb: true, enableDelay: true, isGlitchVoid: true, glowIntensity: 0.5, enableFilter: false, filterType: "lowpass", filterCutoff: 2000, filterResonance: 1,
    enableCompressor: false, compThreshold: -24, compRatio: 3, compAttack: 0.003, compRelease: 0.25,
    enableEq: false, eqLowGain: 0, eqMidGain: 0, eqHighGain: 0,
  },
  glitch_void: {
    grainDensity: 45, grainSize: 0.05, pitchShift: 1.8, spray: 0.12,
    harmonicMode: "octaves", distortion: 80, reverbMix: 0.9, delayMix: 0.7,
    enableGranular: true, enableDistortion: true, enableReverb: true, enableDelay: true, isGlitchVoid: true, glowIntensity: 0.7, enableFilter: true, filterType: "highpass", filterCutoff: 400, filterResonance: 2,
    enableCompressor: true, compThreshold: -18, compRatio: 6, compAttack: 0.002, compRelease: 0.2,
    enableEq: true, eqLowGain: -4, eqMidGain: 2, eqHighGain: 6,
  },
  argon: {
    grainDensity: 15, grainSize: 0.25, pitchShift: 0.6, spray: 0.04,
    harmonicMode: "minor_pentatonic", distortion: 10, reverbMix: 0.75, delayMix: 0.35,
    enableGranular: true, enableDistortion: false, enableReverb: true, enableDelay: true, isGlitchVoid: false, glowIntensity: 0.3, enableFilter: false, filterType: "lowpass", filterCutoff: 2000, filterResonance: 1,
    enableCompressor: false, compThreshold: -24, compRatio: 3, compAttack: 0.003, compRelease: 0.25,
    enableEq: true, eqLowGain: 2, eqMidGain: 0, eqHighGain: -3,
  },
  singularity: {
    grainDensity: 50, grainSize: 0.03, pitchShift: 1.5, spray: 0.14,
    harmonicMode: "fifths", distortion: 100, reverbMix: 0.95, delayMix: 0.8,
    enableGranular: true, enableDistortion: true, enableReverb: true, enableDelay: true, isGlitchVoid: true, glowIntensity: 0.9, enableFilter: true, filterType: "bandpass", filterCutoff: 800, filterResonance: 5,
    enableCompressor: true, compThreshold: -22, compRatio: 8, compAttack: 0.001, compRelease: 0.3,
    enableEq: true, eqLowGain: -6, eqMidGain: 0, eqHighGain: 4,
  },
  delta: {
    grainDensity: 8, grainSize: 0.28, pitchShift: 0.4, spray: 0.02,
    harmonicMode: "none", distortion: 0, reverbMix: 0.4, delayMix: 0.15,
    enableGranular: true, enableDistortion: false, enableReverb: true, enableDelay: false, isGlitchVoid: false, glowIntensity: 0.2, enableFilter: false, filterType: "lowpass", filterCutoff: 2000, filterResonance: 1,
    enableCompressor: false, compThreshold: -24, compRatio: 3, compAttack: 0.003, compRelease: 0.25,
    enableEq: true, eqLowGain: 3, eqMidGain: 0, eqHighGain: -4,
  },
};
