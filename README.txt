Z.42 Sound Granular Scuptor

Here is the complete tech stack powering the **Granular Sound Sculptor** application:

---

### **1. Frontend Framework & Core Engine**

- **React 18**: Component lifecycle management, state hooks (`useState`, `useCallback`, `useRef`, `useEffect`), and reactive HUD UI updates.
- **TypeScript**: Strict static type definitions for audio nodes, WebGL uniforms, preset structures, and UI props.

---

### **2. Audio DSP & Synthesis Pipeline**

- **Web Audio API**: Real-time browser-native Digital Signal Processing (DSP) engine.
  - **Granular Generator**: `AudioBufferSourceNode` + `GainNode` + `StereoPannerNode` spawning micro-grain audio fragments on tight intervals.
  - **Distortion & Wave Shaping**: `WaveShaperNode` with a non-linear mathematical transfer curve for harmonic drive/saturation.
  - **Spatial Convolver Reverb**: `ConvolverNode` with a synthetically calculated 3.0-second exponential stereo impulse response buffer.
  - **Echo Delay**: `DelayNode` with feedback loop routing and dynamic wet/dry mix controls.
  - **Live Frequency Analysis**: `AnalyserNode` fast Fourier transform (FFT) for real-time visual feedback.
- **Offline Audio Context**: `OfflineAudioContext` for non-realtime background rendering of the full DSP effect chain into downloadable 16-bit PCM **WAV files**.

---

### **3. 3D Graphics & Visual Shaders**

- **Three.js**: WebGL rendering engine powering camera setup, 3D scene graphs, particle geometries, and render loops.
- **GLSL (OpenGL Shading Language)**: Custom GPU shaders for the **3D Black Hole Accretion Disk**:
  - **Custom Vertex Shader**: Handles orbital speed based on inverse-square distance to the event horizon, audio frequency particle displacement, and pseudo-random matrix dislocation glitches.
  - **Custom Fragment Shader**: Additive-blended point sprites with Fresnel edge lighting and dynamic brightness flares synced to audio amplitude.

---

### **4. UI Design & Styling**

- **Tailwind CSS**: Utility-first styling framework for the high-contrast monochromatic HUD interface, backdrop blurs, crisp grid layouts, and sci-fi borders.
- **Lucide React**: Clean vector icon suite (`Terminal`, `Zap`, `Waves`, `Sliders`, `Download`, `Upload`, `Activity`, `RotateCcw`, `Repeat`).
