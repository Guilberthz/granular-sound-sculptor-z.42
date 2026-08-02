import { PresetSample, PresetParams } from "../types";

const STORAGE_KEY = "z42-custom-presets";

export interface PresetStore {
  samples: PresetSample[];
  presets: Record<string, PresetParams>;
}

export interface PresetBase {
  name: string;
  freq: number;
  type: PresetSample["type"];
}

/**
 * Owns the serialization, localStorage persistence and mutation of user presets.
 * React components only interact with high-level methods and never touch
 * localStorage directly.
 */
export class PresetManager {
  samples: PresetSample[] = [];
  presets: Record<string, PresetParams> = {};

  /** Load persisted presets from localStorage (no-op if none exist). */
  load(): PresetStore {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.samples)) this.samples = data.samples;
        if (data.presets && typeof data.presets === "object") this.presets = data.presets;
      }
    } catch (err) {
      console.error("Failed to load custom presets:", err);
    }
    return { samples: this.samples, presets: this.presets };
  }

  /** Persist the current preset store to localStorage. */
  save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ samples: this.samples, presets: this.presets }),
      );
    } catch (err) {
      console.error("Failed to save custom presets:", err);
    }
  }

  /** Create and register a new user preset, returning the new sample entry. */
  addPreset(id: string, requestedName: string, params: PresetParams, base: PresetBase): PresetSample {
    const name = requestedName.trim() || `${base.name} CUSTOM`;
    const sample: PresetSample = { id, name, code: "USER", freq: base.freq, type: base.type };
    this.presets[id] = params;
    this.samples = [...this.samples, sample];
    return sample;
  }

  /** Remove a preset entirely. Returns true when a sample entry was removed. */
  deletePreset(sampleId: string): boolean {
    const before = this.samples.length;
    this.samples = this.samples.filter((s) => s.id !== sampleId);
    const removed = this.samples.length !== before;
    if (this.presets[sampleId] !== undefined) {
      const next = { ...this.presets };
      delete next[sampleId];
      this.presets = next;
    }
    return removed;
  }

  /** Rename the stored sample (uppercased). Safe no-op on empty names. */
  renamePreset(sampleId: string, newName: string): void {
    const trimmed = newName.trim().toUpperCase();
    if (!trimmed) return;
    this.samples = this.samples.map((s) => (s.id === sampleId ? { ...s, name: trimmed } : s));
  }

  /** Return the params for a sample, or null if unknown. */
  paramsFor(sampleId: string): PresetParams | null {
    return this.presets[sampleId] ?? null;
  }
}