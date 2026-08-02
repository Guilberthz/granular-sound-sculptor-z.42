# Phase 13 — Future Features

Recommendations for moving this toward professional-grade granular synthesis.
Ranked by **(Implementation difficulty · User impact)**, roughly top-down.

## High impact / achievable

| Feature | Difficulty | Why it matters |
| --- | --- | --- |
| **Modulation matrix** | Medium | Route any mod source (LFO, envelope, MIDI CC) to any parameter (grain density, pitch, filter cutoff, FX mix). The engine already exposes clean setters, so this is additive. |
| **LFOs + envelopes** | Medium | Adds motion to grains and FX; pairs naturally with the modulation matrix. |
| **Macros** | Low | Bundle several params onto one knob for performative control (e.g. "density & size vs. texture"). |
| **Automation recording** | Low–Medium | Record param gestures to the existing timeline; requires an automation lane + playback loop above the waveform. |
| **Envelope follower** (sidechain audio-reactive) | Medium | Let the input amplitude modulate grains/FX — strong granular "reactive" feel. |

## Low difficulty / high value

| Feature | Difficulty | Why it serves |
| --- | --- | --- |
| **Convolution / impulse-response browser** | Low | Bake a loader over the existing `convolver` in `EffectsChain` (it already renders `createReverbImpulse`). |
| **Spectral freeze / stretching** | Medium | Stretch grains around the playhead for texture-hold gestures. |
| **Preset import/export (files)** | Medium | Serialize `PresetManager` to a file (JSON) for sharing. |
| **Parameter reset (double-click)** | Low | Already partially wired on knobs; formalize defaults from `DEFAULT_PRESET_PARAMS`. |

## Higher difficulty / exploration

| Feature | Difficulty | Why it serves |
| --- | --- | --- |
| **Multi-track / layering** | High | Stack several engines into one session; the engine boundary already isolates per-track state. |
| **OSC / external control** | High | Control from hardware or another app; not aligned with the Electron/Web-Audio target yet. |
| **Plugin architecture** | High | Load third-party FX; `EffectsChain` is the seam where a plugin host would attach. |

## Suggested order for maximum user impact per effort

1. Macros + LFOs + modulation matrix (one coherent "motion" feature).
2. Automation recording on the existing timeline.
3. Convolution IR browser (cheap, high wow).
4. Envelope/audio-reactive modulation.
5. Spectral freeze, then preset import/export.

These all build cleanly on the modular base created in phases 2–12.