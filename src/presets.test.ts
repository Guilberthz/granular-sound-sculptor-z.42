import { describe, it, expect } from "vitest";
import { PRESET_SAMPLES, DEFAULT_PRESET_PARAMS } from "./presets";
import type { PresetSample, PresetParams } from "./types";

describe("built-in presets", () => {
  it("every sample has the required fields", () => {
    for (const s of PRESET_SAMPLES) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.name).toBe("string");
      expect(s.freq).toBeGreaterThan(0);
      expect(["synth", "texture", "noise"]).toContain(s.type);
    }
  });

  it("every default preset has a params entry", () => {
    for (const s of PRESET_SAMPLES) {
      expect(DEFAULT_PRESET_PARAMS[s.id]).toBeDefined();
    }
  });

  it("default params match the PresetParams shape", () => {
    const p: PresetParams = DEFAULT_PRESET_PARAMS[PRESET_SAMPLES[0].id];
    expect(p.grainDensity).toBeGreaterThan(0);
    expect(p.pitchShift).toBeGreaterThan(0);
    expect(typeof p.enableGranular).toBe("boolean");
  });

  it("provides at least the initial sample to start from", () => {
    expect(PRESET_SAMPLES.length).toBeGreaterThanOrEqual(1);
  });
});