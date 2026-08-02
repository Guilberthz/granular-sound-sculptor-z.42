import { describe, it, expect, beforeEach } from "vitest";
import { PresetManager } from "./PresetManager";
import type { PresetParams } from "../types";

const params: PresetParams = {
  grainDensity: 30,
  grainSize: 0.2,
  pitchShift: 1.0,
  spray: 0.08,
  harmonicMode: "none",
  distortion: 0,
  reverbMix: 0,
  delayMix: 0,
  enableGranular: true,
  enableDistortion: true,
  enableReverb: true,
  enableDelay: true,
  isGlitchVoid: true,
  glowIntensity: 0.5,
  enableFilter: false,
  filterType: "lowpass",
  filterCutoff: 2000,
  filterResonance: 1,
  enableCompressor: false,
  compThreshold: -24,
  compRatio: 3,
  compAttack: 0.003,
  compRelease: 0.25,
  enableEq: false,
  eqLowGain: 0,
  eqMidGain: 0,
  eqHighGain: 0,
};

function localStorageMock() {
  const store: Record<string, string> = {};
  const mock = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
  };
  (globalThis as any).localStorage = mock;
  return store;
}

describe("PresetManager", () => {
  beforeEach(() => {
    localStorageMock();
  });

  it("adds a preset and returns a sample entry", () => {
    const m = new PresetManager();
    const sample = m.addPreset("custom_1", "MY SOUND", params, { name: "PLANET", freq: 65, type: "synth" });
    expect(sample.id).toBe("custom_1");
    expect(sample.name).toBe("MY SOUND");
    expect(sample.code).toBe("USER");
    expect(m.samples).toHaveLength(1);
    expect(m.paramsFor("custom_1")).toEqual(params);
  });

  it("falls back to a derived name when unnamed", () => {
    const m = new PresetManager();
    const sample = m.addPreset("custom_2", "", params, { name: "BASE", freq: 90, type: "noise" });
    expect(sample.name).toBe("BASE CUSTOM");
  });

  it("deletes a preset and its params", () => {
    const m = new PresetManager();
    m.addPreset("custom_1", "A", params, { name: "X", freq: 1, type: "synth" });
    expect(m.deletePreset("custom_1")).toBe(true);
    expect(m.samples).toHaveLength(0);
    expect(m.paramsFor("custom_1")).toBeNull();
  });

  it("renames a preset", () => {
    const m = new PresetManager();
    m.addPreset("custom_1", "old", params, { name: "X", freq: 1, type: "synth" });
    m.renamePreset("custom_1", "  new name  ");
    expect(m.samples[0].name).toBe("NEW NAME");
  });

  it("persists and re-loads from storage", () => {
    const m = new PresetManager();
    m.addPreset("custom_1", "PERSISTED", params, { name: "X", freq: 1, type: "synth" });
    m.save();

    const n = new PresetManager();
    const store = n.load();
    expect(store.samples).toHaveLength(1);
    expect(store.samples[0].name).toBe("PERSISTED");
    expect(n.paramsFor("custom_1")).toEqual(params);
  });
});