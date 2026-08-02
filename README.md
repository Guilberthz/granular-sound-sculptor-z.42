# Granular Sound Sculptor Z.42

![](C:\Users\senpa\AppData\Roaming\marktext\images\2026-07-31-13-38-20-{7FF6F003-A59D-4A59-B89B-28DE315CCF22}.png)

**PRIMESYSTEM v4.2** — a real-time granular synthesis instrument built with React, Three.js and the Web Audio API. Drag any audio file into the 3D black-hole "void" and instantly re-synthesize, sculpt, texture and mutate it into new sound.

> Desktop build ships as an Electron app (`electron:build`), and the same codebase runs in any modern browser (`npm run dev`).

---

## Feature Overview

### 1. Granular Synthesis Engine

The heart of the app. The source buffer is chopped into thousands of overlapping micro-grains that are pitch-shifted, panned and enveloped in real time.

| Control         | Range         | Description                                               |
| --------------- | ------------- | --------------------------------------------------------- |
| **Density**     | 2–50 grains/s | How many grains are spawned every second.                 |
| **Size**        | 20–300 ms     | Length of each individual grain.                          |
| **Pitch**       | 0.2×–2.0×     | Playback-rate transposition of every grain.               |
| **Spray**       | 0–150 ms      | Random time-spread around each grain's playback position. |
| **Texture Mix** | internal      | Grain envelope loudness (attack/decay shaping).           |

**Harmonic Modes** — each grain picks a random musical interval ratio from the active scale:

- `OFF` — free detune (±2%).
- `OCTAVES` — sub, fundamental, octave up.
- `FIFTHS & 4THS` — perfect fourths/fifths stacked.
- `PENTATONIC` — minor pentatonic scale.
- `MAJOR` — major scale (new).
- `WHOLE TONE` — whole-tone scale, dreamy/impressionist (new).

The **ENGINE ENABLED** toggle bypasses the granular engine itself (clean sample passes through the FX chain).

### 2. FX Rack

Every FX module has an **ON / BYPASS** toggle and a collapsible section header.

| Module                  | Controls                                                           | DSP                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **DISTORTION**          | Drive 0–100%                                                       | `WaveShaperNode` with a non-linear hyperbolic transfer curve.                                                                           |
| **REVERB**              | Space 0–100%                                                       | `ConvolverNode` with a synthetic 3.0 s exponential-decay stereo impulse.                                                                |
| **DELAY**               | Echo 0–100%                                                        | `DelayNode` with a **feedback loop** (Feedback knob lives in the Particle panel).                                                       |
| **FILTER**              | LPF / HPF / BPF, Cutoff 50–20 kHz, Resonance 0.1–20                | `BiquadFilterNode`.                                                                                                                     |
| **COMPRESSOR** *(new)*  | Threshold −60…0 dB, Ratio 1–20, Attack 0–500 ms, Release 0–1000 ms | `DynamicsCompressorNode` at the master bus. Transparent (ratio 1) when off.                                                             |
| **SPECTRAL EQ** *(new)* | Low / Mid / High gain −12…+12 dB                                   | 3-band `BiquadFilterNode` (lowshelf 120 Hz, peaking 1 kHz, highshelf 5 kHz) inserted between the filter and the dry/delay/reverb split. |

### 3. DRY BYPASS — 100% Raw Sample (new)

A global **DRY BYPASS (RAW)** toggle (or press **B**) that bypasses **everything** — the granular engine and the entire FX rack — and plays the original, untouched source buffer straight through the master output. Perfect for A/B-comparing your sculpted sound against the raw material.

- The spectrum analyser and volume/feedback controls stay live, so you can compare levels directly.
- Exporting while bypassed produces a **`_DRY.wav`** (the unprocessed sample).

### 4. Presets

**Built-in presets** (loaded with number keys `1`–`5`):

| #   | Code              | Type       | Character                         |
| --- | ----------------- | ---------- | --------------------------------- |
| 1   | PLANET Z.42       | `O78-4`    | 65 Hz synth drone with reverb pad |
| 2   | GLITCHED VOID     | `VOID-ERR` | 180 Hz noise glitch storm         |
| 3   | ARGON VOID        | `Ar-18`    | 110 Hz soft texture bed           |
| 4   | SINGULARITY NOISE | `Q5-TEST`  | 220 Hz dense noise singularity    |
| 5   | DELTA PULSE       | `D2-459`   | 40 Hz slow sub pulse              |

**Custom presets:**

- **SAVE PRESET** — snapshots every parameter (including the new compressor/EQ settings) into a new preset diamond.
- **Persistence** — custom presets are saved to `localStorage` (`z42-custom-presets`) and restored on every launch, including in the Electron app.
- **Rename** — double-click a custom preset to edit its name inline.
- **Delete** — hover a custom preset and click **✕**.
- **Load** — number keys `1`–`N` cycle through built-in + custom presets automatically.

### 5. Recording & Export

- **RECORD OUTPUT** — captures the live stereo output to a WAV file (taps the post-compressor bus, so it matches what you hear; raw bypass signal is also captured).
- **EXPORT WAV SAMPLE** — renders offline through the **full DSP chain** (new): `source → distortion → filter → spectral EQ → dry/wet mix (delay + reverb) → master volume → compressor → 16-bit PCM WAV`. Exports now match the live sound exactly (the filter, EQ, volume and compressor were previously missing from exports).

### 6. 3D Black-Hole Void (Three.js)

- **Particle modes** *(new: RINGS)*:
  - **DOTS** — sharp additive points.
  - **RINGS** — particles band into concentric orbiting rings with warm/cool band colors.
  - **BLUR** — soft Gaussian-blurred clouds (Blur intensity knob appears).
- **Reactive core** *(new)* — a pulsing wireframe sphere at the event horizon that scales and brightens with the audio's average frequency.
- **Pitch-reactive color tint** *(new)* — the particle palette warms for downward pitch shifts and cools for upward shifts.
- **Auto-Orbit camera** *(new)* — toggle in the Particle panel to slowly rotate the camera around the void.
- **GLITCH VOID** — visual glitch bursts synced to a pseudo-random matrix; the shader also glitches particle positions and colors.
- **Glow / Feedback / Blur** knobs drive bloom strength and particle behavior.
- Audio-reactive orbital speed, point size, displacement warp and bloom intensity — all driven by a live 64-bin FFT analyser.

### 7. Layout & UX (new polish)

- **Collapsible sections** — every FX module and panel (Spectrum, Particle Mode, Timeline) can be collapsed/expanded via the chevron on its header.
- **Tooltips** — all transport, rack and particle buttons show descriptive tooltips.
- **RESET ALL** — resets every parameter back to the active preset's defaults.
- **Patch-cable overlay** — clickable cable clusters over the void (`SD - Rev PAD`, `GRAIN ECHO`, `DRIVE SINGLTY`) that re-route their mix amounts.

---

## Keyboard Shortcuts

| Key               | Action                                |
| ----------------- | ------------------------------------- |
| `Space`           | Play / Pause                          |
| `1`–`N`           | Load preset (built-in + custom)       |
| `B`               | DRY bypass — raw sample               |
| `C`               | Toggle compressor                     |
| `Shift + E`       | Toggle spectral EQ                    |
| `R`               | Record output                         |
| `E`               | Export WAV                            |
| `G`               | Toggle glitch void                    |
| `L`               | Toggle sample loop (keeps A–B region) |
| `←` / `→`         | Move loop start (A)                   |
| `Shift + ←` / `→` | Move loop end (B)                     |
| `Tab`             | Switch Granular / FX tab              |
| `/`               | Show shortcuts overlay                |
| `Alt + Scroll`    | Fine-tune a knob                      |
| `Double-click`    | Reset a knob to its default           |

---

## Audio Signal Flow (Live)

```
 Source buffer
      │
 grains (StereoPanner → Gain envelope)
      │
 [WaveShaper DISTORTION]
      │
 [BiquadFilter FILTER]
      │
 [Spectral EQ: Low → Mid → High]
      │
      ├──────────► dry
      │          + delay (feedback loop)
      │          + convolver reverb
      │
 [Master Gain (VOL)] ─► [DynamicsCompressor] ─► [Analyser FFT] ─► OUTPUT

 Raw bypass: source ─► master ─► compressor ─► analyser ─► OUTPUT
```

---

## Tech Stack

- **React 18** + **TypeScript** — HUD/state, typed audio & WebGL uniforms.
- **Web Audio API** — `AudioBufferSourceNode`, `GainNode`, `StereoPannerNode`, `WaveShaperNode`, `BiquadFilterNode`, `DelayNode`, `ConvolverNode`, `DynamicsCompressorNode`, `AnalyserNode`, `OfflineAudioContext`.
- **Three.js 0.160** — WebGL renderer, custom GLSL vertex/fragment shaders, `EffectComposer` + `UnrealBloomPass`, `OrbitControls`.
- **Tailwind CSS** + **Lucide React** — sci-fi HUD styling and icons.
- **Vite** — dev server & bundler.
- **Electron** — desktop packaging, native file open/save dialogs, global shortcuts.

---

## Development

```bash
npm install

# Web (browser)
npm run dev          # Vite dev server at http://localhost:5173

# Desktop (Electron, loads built app)
npm run build        # type-checked production build → dist/
npm run electron:dev # Vite + Electron in development
npm run electron:build  # package installers into release/
```

Verify types/build before shipping:

```bash
npx tsc --noEmit
npm run build
```

---

## Project Layout

```
src/
  App.tsx              # main app: state, DSP graph, UI panels
  types.ts             # PresetSample, PresetParams, HarmonicMode, ParticleMode
  presets.ts           # built-in samples + default parameter sets
  Knob.tsx             # rotary knob control
  PresetDiamond.tsx    # preset list item (rename / delete support)
  SpectrumView.tsx     # live FFT analyser bars
  WaveformView.tsx     # timeline waveform + playhead
  shaders.ts           # GLSL vertex + fragment shaders
  hooks/
    useThreeScene.ts   # Three.js scene, particles, bloom, camera
electron/
  main.js              # Electron main process (dialogs, shortcuts)
  preload.js           # secure IPC bridge (window.electronAPI)
```
