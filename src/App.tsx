import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Play, Pause, Upload, Activity, Disc, Zap, Sliders, Waves, Terminal, Download, RotateCcw, Repeat, CircleDot, Filter, ChevronDown, Power } from "lucide-react";
import Knob from "./components/Knob";
import WaveformView from "./components/WaveformView";
import PresetDiamond from "./components/PresetDiamond";
import DeltaActivityView from "./components/DeltaActivityView";
import Module from "./components/Module";
import PanelSection from "./components/PanelSection";
import { PresetSample, PresetParams, HarmonicMode, ParticleMode } from "./types";
import { DEFAULT_PRESET_PARAMS } from "./presets";
import { usePresets } from "./hooks/usePresets";
import { useKeyboard } from "./hooks/useKeyboard";
import { useElectron } from "./hooks/useElectron";
import { useThreeScene } from "./hooks/useThreeScene";
import { AudioEngine } from "./audio/AudioEngine";
import { Recorder } from "./audio/Recorder";
import { exportBufferToWav } from "./audio/Exporter";
import { formatTime } from "./audio/utils";

// Module-level option lists: hoisted so they aren't re-created on every render.
const HARMONIC_MODES: { id: HarmonicMode; label: string }[] = [
  { id: "none", label: "OFF" },
  { id: "octaves", label: "OCTAVES" },
  { id: "fifths", label: "FIFTHS & 4THS" },
  { id: "minor_pentatonic", label: "PENTATONIC" },
  { id: "major", label: "MAJOR" },
  { id: "whole_tone", label: "WHOLE TONE" },
];
const FILTER_TYPES: { id: BiquadFilterType; label: string }[] = [
  { id: "lowpass", label: "LPF" },
  { id: "highpass", label: "HPF" },
  { id: "bandpass", label: "BPF" },
];
const PARTICLE_MODES: ParticleMode[] = ["dots", "rings", "blur", "blackhole"];

export default function SoundSculptor() {
  const {
    grainDensity, setGrainDensity, grainSize, setGrainSize, pitchShift, setPitchShift,
    spray, setSpray, textureMix, setTextureMix, harmonicMode, setHarmonicMode,
    enableGranular, setEnableGranular, enableDistortion, setEnableDistortion,
    distortion, setDistortion, enableReverb, setEnableReverb, reverbMix, setReverbMix,
    enableDelay, setEnableDelay, delayMix, setDelayMix, delayTime, setDelayTime,
    feedback, setFeedback, enableFilter, setEnableFilter, filterType, setFilterType,
    filterCutoff, setFilterCutoff, filterResonance, setFilterResonance,
    enableEq, setEnableEq, eqLowGain, setEqLowGain, eqMidGain, setEqMidGain,
    eqHighGain, setEqHighGain, enableCompressor, setEnableCompressor,
    compThreshold, setCompThreshold, compRatio, setCompRatio, compAttack, setCompAttack,
    compRelease, setCompRelease, volume, setVolume, isGlitchVoid, setIsGlitchVoid,
    glowIntensity, setGlowIntensity,
    selectedSample, setSelectedSample, allPresets, customPresets,
    allPresetsRef, savingPreset, setSavingPreset,
    newPresetName, setNewPresetName, applyPresetParams, selectPreset,
    saveCurrentPreset, deleteCustomPreset, renameCustomPreset,
  } = usePresets();

  const [isPlaying, setIsPlaying] = useState(false);
  const [customAudioName, setCustomAudioName] = useState<string | null>(null);

  const [isLooping, setIsLooping] = useState(true);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [playheadPos, setPlayheadPos] = useState(0);
  const playheadPosRef = useRef(0);
  playheadPosRef.current = playheadPos;

  const [isBypassed, setIsBypassed] = useState(false);

  const [bufferVersion, setBufferVersion] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false);

  const [particleMode, setParticleMode] = useState<ParticleMode>("dots");
  const [blurIntensity, setBlurIntensity] = useState(0.5);
  const [accretionIntensity, setAccretionIntensity] = useState(0.6);

  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;

  const applyLoopRegion = useCallback((a: number, b: number) => {
    const start = Math.max(0, Math.min(1, Math.min(a, b)));
    const end = Math.max(0, Math.min(1, Math.max(a, b)));
    setLoopStart(start);
    setLoopEnd(end);
    setIsLooping(true);
    engineRef.current?.applyLoopRegion(start, end);
  }, []);

  const clearLoopRegion = useCallback(() => {
    setLoopStart(null);
    setLoopEnd(null);
    engineRef.current?.clearLoopRegion();
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLooping((p) => !p);
    engineRef.current?.toggleLoop();
  }, []);

  const nudgeLoopStart = useCallback((deltaSec: number) => {
    const dur = audioBufferRef.current?.duration;
    if (!dur || loopStart === null || loopEnd === null) return;
    const step = deltaSec / dur;
    const a = Math.max(0, Math.min(loopEnd - 0.005, loopStart + step));
    applyLoopRegion(a, loopEnd);
  }, [loopStart, loopEnd, applyLoopRegion]);

  const nudgeLoopEnd = useCallback((deltaSec: number) => {
    const dur = audioBufferRef.current?.duration;
    if (!dur || loopStart === null || loopEnd === null) return;
    const step = deltaSec / dur;
    const b = Math.max(loopStart + 0.005, Math.min(1, loopEnd + step));
    applyLoopRegion(loopStart, b);
  }, [loopStart, loopEnd, applyLoopRegion]);

  const resetAll = useCallback(() => {
    const params = customPresets[selectedSample.id] || DEFAULT_PRESET_PARAMS[selectedSample.id];
    if (params) applyPresetParams(params);
    setVolume(0.75);
    setFeedback(0.3);
    setIsBypassed(false);
    setAutoRotate(false);
  }, [customPresets, selectedSample, applyPresetParams]);

  const [activeConnections, setActiveConnections] = useState<{ [key: string]: boolean }>({
    "synth-reverb": false,
    "granular-delay": false,
    "distortion-void": false,
  });

  const [isRecording, setIsRecording] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  const [isDraggingOverVoid, setIsDraggingOverVoid] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [dragFileName, setDragFileName] = useState<string | null>(null);

  const toggleConnection = (id: string) => {
    setActiveConnections((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      if (id === "synth-reverb") setReverbMix(updated[id] ? 0.85 : 0);
      if (id === "granular-delay") setDelayMix(updated[id] ? 0.5 : 0);
      if (id === "distortion-void") setDistortion(updated[id] ? 45 : 0);
      return updated;
    });
  };

  const handleVoidDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverVoid(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const arrayBuffer = evt.target?.result as ArrayBuffer;
      await loadAudioFromData(arrayBuffer, file.name.toUpperCase());
    };
    reader.readAsArrayBuffer(file);
  };

const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new AudioEngine({
      onPlayhead: (pos) => setPlayheadPos(pos),
      onStopped: () => setIsPlaying(false),
    });
  }
  const engine = engineRef.current;

  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const syncBufferRef = () => {
    audioBufferRef.current = engine.currentBuffer;
    setBufferVersion((v) => v + 1);
  };

  useEffect(() => {
    engine.ensure();
    analyserRef.current = engine.analyser;
  }, [engine]);

  // Three.js Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const orbitTargetRef = useRef<HTMLDivElement | null>(null);

  useThreeScene({
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement | null>,
    viewportRef: viewportRef as React.RefObject<HTMLDivElement | null>,
    orbitTargetRef: orbitTargetRef as React.RefObject<HTMLDivElement | null>,
    analyserRef: analyserRef as React.RefObject<AnalyserNode | null>,
    grainDensity,
    isGlitchVoid,
    particleMode,
    blurIntensity,
    glowIntensity,
    accretionIntensity,
    isPlaying,
    autoRotate,
    pitchShift,
  });

  const handleReplay = () => {
    engine.replay();
    if (!isPlaying) setIsPlaying(true);
  };

  const handleSeek = useCallback((pos: number) => {
    engine.seek(pos);
  }, [engine]);

  const loadAudioFromData = useCallback(async (arrayBuffer: ArrayBuffer, name: string) => {
    setCustomAudioName(name);
    try {
      const ctx = engine.ensure();
      if (!ctx) return;
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      engine.setBuffer(decoded, true);
      setPlayheadPos(0);
      syncBufferRef();
      if (!isPlaying) setIsPlaying(true);
    } catch (err) {
      console.error("Error decoding audio:", err);
    }
  }, [engine, isPlaying]);

  const currentAudioNameRef = useRef(customAudioName || selectedSample.name);
  currentAudioNameRef.current = customAudioName || selectedSample.name;

  const recorderRef = useRef<Recorder | null>(null);
  if (!recorderRef.current) {
    recorderRef.current = new Recorder(engine, {
      onStateChange: (recording) => setIsRecording(recording),
      onDuration: (d) => setRecordingDuration(d),
      getName: () => currentAudioNameRef.current,
    });
  }
  const recorder = recorderRef.current;

  // Push live parameter state into the audio engine whenever it changes.
  useEffect(() => { engine.setVolume(volume); }, [engine, volume]);
  useEffect(() => { engine.setFeedback(feedback); }, [engine, feedback]);
  useEffect(() => { engine.setDelay(delayTime, delayMix); }, [engine, delayTime, delayMix]);
  useEffect(() => { engine.setReverb(reverbMix); }, [engine, reverbMix]);
  useEffect(() => { engine.setDistortion(distortion); }, [engine, distortion]);
  useEffect(() => { engine.setDistortionEnabled(enableDistortion); }, [engine, enableDistortion]);
  useEffect(() => { engine.setFilter(filterType, filterCutoff, filterResonance); }, [engine, filterType, filterCutoff, filterResonance]);
  useEffect(() => { engine.setFilterEnabled(enableFilter); }, [engine, enableFilter]);
  useEffect(() => { engine.setEq(eqLowGain, eqMidGain, eqHighGain); }, [engine, eqLowGain, eqMidGain, eqHighGain]);
  useEffect(() => {
    engine.setCompressor({ enabled: enableCompressor, threshold: compThreshold, ratio: compRatio, attack: compAttack, release: compRelease });
  }, [engine, enableCompressor, compThreshold, compRatio, compAttack, compRelease]);

  useEffect(() => { engine.setGranularEnabled(enableGranular); }, [engine, enableGranular]);
  useEffect(() => { engine.setBypass(isBypassed); }, [engine, isBypassed]);
  useEffect(() => { engine.setGrainDensity(grainDensity); }, [engine, grainDensity]);
  useEffect(() => { engine.setGrainSize(grainSize); }, [engine, grainSize]);
  useEffect(() => { engine.setPitchShift(pitchShift); }, [engine, pitchShift]);
  useEffect(() => { engine.setSpray(spray); }, [engine, spray]);
  useEffect(() => { engine.setTextureMix(textureMix); }, [engine, textureMix]);
  useEffect(() => { engine.setHarmonicMode(harmonicMode); }, [engine, harmonicMode]);

  // Drive the engine from the React transport state.
  useEffect(() => {
    if (isPlaying) engine.play();
    else engine.pause();
  }, [isPlaying, engine]);

  const handleRecord = () => {
    recorder.toggle();
  };

  const handleExportWav = useCallback(async () => {
    if (!engine.currentBuffer) return;
    setIsExporting(true);
    try {
      await exportBufferToWav(engine, {
        volume,
        isBypassed,
        distortion,
        enableDistortion,
        filterType,
        filterCutoff,
        filterResonance,
        enableFilter,
        eqLowGain,
        eqMidGain,
        eqHighGain,
        enableEq,
        delayMix,
        delayTime,
        feedback,
        enableDelay,
        reverbMix,
        enableReverb,
        enableCompressor,
        compThreshold,
        compRatio,
        compAttack,
        compRelease,
      }, currentAudioNameRef.current);
    } finally {
      setIsExporting(false);
    }
  }, [engine, volume, isBypassed, distortion, enableDistortion, filterType, filterCutoff, filterResonance, enableFilter, eqLowGain, eqMidGain, eqHighGain, enableEq, delayMix, delayTime, feedback, enableDelay, reverbMix, enableReverb, enableCompressor, compThreshold, compRatio, compAttack, compRelease]);

  const pickAudioFileElectron = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.openAudio();
    if (!result) return;
    const uint8 = new Uint8Array(result.data);
    await loadAudioFromData(uint8.buffer, result.name);
  }, [loadAudioFromData]);

  const { appVersion } = useElectron({
    onMenuOpenFile: pickAudioFileElectron,
    onMenuExportWav: handleExportWav,
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const arrayBuffer = evt.target?.result as ArrayBuffer;
      await loadAudioFromData(arrayBuffer, file.name.toUpperCase());
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  useKeyboard({
    onTogglePlay: () => setIsPlaying((p) => !p),
    selectPreset: (index) => {
      if (index >= 1 && index <= allPresetsRef.current.length) {
        selectPreset(allPresetsRef.current[index - 1]);
        setIsBypassed(false);
      }
    },
    onRecord: () => recorder.toggle(),
    onToggleGlitch: () => setIsGlitchVoid((p) => !p),
    onToggleLoop: () => toggleLoop(),
    onClearLoop: () => clearLoopRegion(),
    onToggleBypass: () => setIsBypassed((p) => !p),
    onToggleCompressor: () => setEnableCompressor((p) => !p),
    onToggleEq: () => setEnableEq((p) => !p),
    onExport: () => handleExportWav(),
    onToggleShortcuts: () => setShowShortcuts((p) => !p),
    onNudgeLoopStart: (deltaSec) => nudgeLoopStart(deltaSec),
    onNudgeLoopEnd: (deltaSec) => nudgeLoopEnd(deltaSec),
  });

  useEffect(() => {
    const seen = localStorage.getItem("granular-onboarded");
    if (!seen) setHasSeenOnboarding(true);
  }, []);

  const dismissOnboarding = () => {
    localStorage.setItem("granular-onboarded", "1");
    setHasSeenOnboarding(false);
  };

  useEffect(() => {
    if (!engine.isCustom) {
      engine.generatePresetBuffer(selectedSample.type, selectedSample.freq, 4.0);
    }
    engine.seek(0);
    syncBufferRef();
    clearLoopRegion();
    const params = customPresets[selectedSample.id] || DEFAULT_PRESET_PARAMS[selectedSample.id];
    if (params) applyPresetParams(params);
    setIsBypassed(false);
  }, [selectedSample, clearLoopRegion]);

  useEffect(() => {
    return () => {
      engine.dispose();
    };
  }, [engine]);

  const loopActive = loopStart !== null && loopEnd !== null && loopEnd - loopStart > 0.005;
  const loopLabel = loopActive
    ? `${formatTime((audioBufferRef.current?.duration || 0) * (loopStart ?? 0))} â€“ ${formatTime((audioBufferRef.current?.duration || 0) * (loopEnd ?? 0))}`
    : "";

  const handleSetLoopStart = (pos: number) => {
    const region = engine.getLoopRegion();
    if (region.end !== null) applyLoopRegion(pos, region.end);
    else setLoopStart(pos);
  };
  const handleSetLoopEnd = (pos: number) => {
    const region = engine.getLoopRegion();
    if (region.start !== null) applyLoopRegion(region.start, pos);
    else setLoopEnd(pos);
  };
  return (
    <div className="min-h-screen w-full bg-black text-white font-mono select-none">
      <div className="w-full h-screen bg-black/80 border-x border-neutral-800 overflow-hidden relative shadow-2xl flex flex-col">
{/* Corner Screws */}
         <div className="absolute top-3 left-3 w-[10px] h-[10px] rounded-full bg-[#151515] flex items-center justify-center shadow-[inset_2px_2px_5px_rgba(0,0,0,0.9),inset_-1px_-1px_2px_rgba(255,255,255,0.04)] z-30 transition-all duration-300" style={isPlaying ? { boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.9), inset -1px -1px 2px rgba(255,255,255,0.04), 0 0 8px rgba(255,0,64,0.3)" } : {}}>
           <div className="w-full h-[1px] bg-black/60 rotate-45"></div>
         </div>
         <div className="absolute top-3 right-3 w-[10px] h-[10px] rounded-full bg-[#151515] flex items-center justify-center shadow-[inset_2px_2px_5px_rgba(0,0,0,0.9),inset_-1px_-1px_2px_rgba(255,255,255,0.04)] z-30 transition-all duration-300" style={isPlaying ? { boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.9), inset -1px -1px 2px rgba(255,255,255,0.04), 0 0 8px rgba(255,0,64,0.3)" } : {}}>
           <div className="w-full h-[1px] bg-black/60 -rotate-45"></div>
         </div>
         <div className="absolute bottom-3 left-3 w-[10px] h-[10px] rounded-full bg-[#151515] flex items-center justify-center shadow-[inset_2px_2px_5px_rgba(0,0,0,0.9),inset_-1px_-1px_2px_rgba(255,255,255,0.04)] z-30 transition-all duration-300" style={isPlaying ? { boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.9), inset -1px -1px 2px rgba(255,255,255,0.04), 0 0 8px rgba(255,0,64,0.3)" } : {}}>
           <div className="w-full h-[1px] bg-black/60 -rotate-12"></div>
         </div>
         <div className="absolute bottom-3 right-3 w-[10px] h-[10px] rounded-full bg-[#151515] flex items-center justify-center shadow-[inset_2px_2px_5px_rgba(0,0,0,0.9),inset_-1px_-1px_2px_rgba(255,255,255,0.04)] z-30 transition-all duration-300" style={isPlaying ? { boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.9), inset -1px -1px 2px rgba(255,255,255,0.04), 0 0 8px rgba(255,0,64,0.3)" } : {}}>
           <div className="w-full h-[1px] bg-black/60 rotate-12"></div>
         </div>

          {/* Top HUD Header Bar */}
          <div
            className="app-region-drag flex items-center justify-between px-6 py-2 border-b border-neutral-800 bg-black/60 backdrop-blur-sm text-xs text-neutral-400"
            style={window.electronAPI ? { paddingRight: 150 } : undefined}
          >
<div className="flex items-center gap-4">
               <span className={`flex items-center gap-1.5 font-bold tracking-widest transition-colors duration-300 ${isPlaying ? "text-[#FF0040] animate-accent-glow" : "text-white"}`}>
                 <Terminal className="w-4 h-4" />
                 PRIMESYSTEM
               </span>
               <span className="px-2 py-0.5 bg-neutral-900/50 border border-neutral-700 text-[10px] text-neutral-300 rounded uppercase tracking-wider">
                 â— ACTIVE
               </span>
             </div>
            <div className="app-region-no-drag flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Knob
                  value={volume}
                  min={0}
                  max={1}
                  onChange={setVolume}
                  label=""
                  displayValue=""
                  size={22}
                  accent={isPlaying}
                />
                <span className={`text-[10px] font-bold tracking-wider transition-colors duration-300 ${isPlaying ? "text-[#FF0040]" : "text-neutral-400"}`}>VOL</span>
              </div>
              <button
                onClick={() => setIsGlitchVoid(!isGlitchVoid)}
                title="Toggle glitch void (G)"
                className={`futuristic-button compact-button border px-2 py-1 text-[8px] font-bold transition-all ${
                  isGlitchVoid
                    ? "bg-[#FF0040] text-white border-[#FF0040] animate-accent-pulse"
                    : "bg-black/60 text-neutral-400 border-neutral-700 hover:text-white hover:border-[#FF0040]/60"
                }`}
              >
                GLITCH {isGlitchVoid ? "ON" : "OFF"}
              </button>
<div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isPlaying ? "bg-[#FF0040] animate-accent-pulse" : "bg-neutral-600"}`} />
                <span className={`text-[10px] transition-colors duration-300 ${isPlaying ? "text-[#FF0040] font-bold" : "text-neutral-400"}`}>SIGNAL</span>
              </div>
              <span className="text-[10px] text-neutral-500">BATTERY: <span className="text-white">98%</span></span>
            </div>
          </div>

        {/* Main Interface Body */}
        <div className="grid grid-cols-12 grid-rows-1 flex-1 min-h-0 relative">

          {/* Full-grid canvas behind everything */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" />

          {/* Left Telemetry Panel */}
          <div className="col-span-3 p-3 flex flex-col justify-between space-y-3 z-10 overflow-y-auto scrollbar-thin">

            {/* Spectrum Visualizer */}
            <PanelSection title="SPECTRUM" icon={<Activity className="w-3 h-3" />}>
              <DeltaActivityView analyserRef={analyserRef} />
            </PanelSection>

{/* Source Selection Grid */}
             <div className="space-y-2">
               <span className="text-[10px] tracking-widest text-neutral-500 uppercase font-sans">Samples</span>
               <div className="flex flex-wrap gap-1.5">
                {allPresets.map((sample) => (
                  <PresetDiamond
                    key={sample.id}
                    sample={sample}
                    active={!customAudioName && selectedSample.id === sample.id}
                    isCustom={sample.id.startsWith("custom_")}
                    onSelect={() => {
                      selectPreset(sample);
                      setIsBypassed(false);
                    }}
                    onDelete={sample.id.startsWith("custom_") ? () => deleteCustomPreset(sample) : undefined}
                    onRename={sample.id.startsWith("custom_") ? (name) => renameCustomPreset(sample, name) : undefined}
                  />
                ))}
              </div>

            </div>

              <div className="border-t border-neutral-800 pt-3 text-[11px]">
                <span className="text-[10px] tracking-widest text-neutral-500 uppercase font-sans">Signal Readout</span>
                <div className="grid grid-cols-2 gap-1 mt-2">
                  <div className="rounded border border-neutral-800/50 bg-black/40 px-1.5 py-1 flex flex-col gap-0.5">
                    <span className="text-[9px] tracking-wider text-neutral-500 uppercase">Grains</span>
                    <span className="text-[#FF0040] font-mono font-bold">{Math.round(grainDensity * (isPlaying ? 1 : 0))}/s</span>
                  </div>
                  <div className="rounded border border-neutral-800/50 bg-black/40 px-1.5 py-1 flex flex-col gap-0.5">
                    <span className="text-[9px] tracking-wider text-neutral-500 uppercase">Pitch</span>
                    <span className="text-white font-mono">{pitchShift.toFixed(2)}x</span>
                  </div>
                  <div className="rounded border border-neutral-800/50 bg-black/40 px-1.5 py-1 flex flex-col gap-0.5">
                    <span className="text-[9px] tracking-wider text-neutral-500 uppercase">Effects</span>
                    <span className="text-white font-mono">{[enableDistortion && 'D', enableReverb && 'R', enableDelay && 'E', enableFilter && 'F', enableCompressor && 'C', enableEq && 'EQ'].filter(Boolean).join(' ') || '—'}</span>
                  </div>
                  <div className="rounded border border-neutral-800/50 bg-black/40 px-1.5 py-1 flex flex-col gap-0.5">
                    <span className="text-[9px] tracking-wider text-neutral-500 uppercase">Harmonic</span>
                    <span className="text-white font-mono">{harmonicMode === 'none' ? 'OFF' : harmonicMode.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  <div className="rounded border border-neutral-800/50 bg-black/40 px-1.5 py-1 flex flex-col gap-0.5">
                    <span className="text-[9px] tracking-wider text-neutral-500 uppercase">Signal</span>
                    <span className={isBypassed ? "text-neutral-400 font-mono" : "text-[#FF0040] font-mono font-bold"}>{isBypassed ? "RAW DRY" : "SCULPTED"}</span>
                  </div>
                  <div className="rounded border border-neutral-800/50 bg-black/40 px-1.5 py-1 flex flex-col gap-0.5">
                    <span className="text-[9px] tracking-wider text-neutral-500 uppercase">Glitch</span>
                    <span className="text-[#FF0040] font-mono font-bold">{isGlitchVoid ? 'ON' : 'OFF'}</span>
                  </div>
                  <div className="rounded border border-neutral-800/50 bg-black/40 px-2 py-1.5 flex flex-col gap-0.5 col-span-2">
                    <span className="text-[9px] tracking-wider text-neutral-500 uppercase">Playhead</span>
                    <span className="text-white font-mono text-[10px]">{formatTime((audioBufferRef.current?.duration || 0) * playheadPos)} / {formatTime(audioBufferRef.current?.duration || 0)}</span>
                  </div>
                </div>
                {!audioBufferRef.current && (
                  <div className="text-neutral-600 text-center pt-2 text-[10px]">LOAD A SAMPLE TO BEGIN</div>
                )}
              </div>

{/* Particle Visuals */}
             <div className="border-t border-neutral-800 pt-3 space-y-2">
               <div className="flex items-center justify-between">
                 <span className="text-[10px] tracking-widest text-neutral-500 uppercase font-sans">Particle Visuals</span>
                 <button
                   onClick={() => setAutoRotate(!autoRotate)}
                   title="Toggle automatic camera orbit"
                   className={`futuristic-button compact-button px-2 py-0.5 text-[9px] rounded font-bold border transition-all ${
                     autoRotate ? "bg-white text-black border-white hover:opacity-80" : "bg-black/30 text-neutral-500 border-neutral-800 hover:bg-black/50 hover:text-neutral-300 hover:border-neutral-700"
                   }`}
                 >
                   {autoRotate ? "ORBIT ON" : "ORBIT OFF"}
                 </button>
               </div>
               <div className={`grid ${particleMode === "blur" ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
                 {particleMode === "blur" && (
                   <Knob
                     value={blurIntensity}
                     min={0.05}
                     max={0.95}
                     onChange={setBlurIntensity}
                     label="Blur"
                     displayValue={`${Math.round(blurIntensity * 100)}%`}
                     size={56}
                   />
                 )}
                 {particleMode === "blackhole" && (
                   <Knob
                     value={accretionIntensity}
                     min={0}
                     max={1}
                     onChange={setAccretionIntensity}
                     label="Accretion"
                     displayValue={`${Math.round(accretionIntensity * 100)}%`}
                     size={56}
                   />
                 )}
                 <Knob
                   value={glowIntensity}
                   min={0}
                   max={1}
                   onChange={setGlowIntensity}
                   label="Glow"
                   displayValue={`${Math.round(glowIntensity * 100)}%`}
                   size={56}
                 />
                 <Knob
                   value={feedback}
                   min={0}
                   max={1}
                   onChange={setFeedback}
                   label="Feedback"
                   displayValue={`${Math.round(feedback * 100)}%`}
                   size={56}
                 />
               </div>
               {feedback >= 0.7 && (
                 <p className="text-center text-[9px] leading-relaxed text-[#FF0040]">
                   HIGH FEEDBACK â€” reduce before changing samples
                 </p>
               )}
             </div>

            {/* Command Dock */}
            <div className="pt-2 border-t border-neutral-800 space-y-2">
              <span className="text-[10px] tracking-widest text-neutral-500 uppercase font-sans">Command Dock</span>

              {savingPreset && (
                <div className="flex items-center gap-1">
                  <input
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="Preset name..."
                    className="flex-1 min-w-0 bg-black/30 border border-neutral-700 px-2 py-1 text-[9px] text-white outline-none focus:border-[#FF0040]"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveCurrentPreset(); if (e.key === "Escape") setSavingPreset(false); }}
                  />
                  <button onClick={saveCurrentPreset} title="Confirm save" className="futuristic-button compact-button px-2 py-1 bg-[#FF0040] text-white text-[9px] font-bold hover:bg-[#cc0033] active:scale-95 transition-all">SAVE</button>
                  <button onClick={() => setSavingPreset(false)} title="Cancel" className="futuristic-button compact-button px-1.5 py-1 text-[9px] text-neutral-500 hover:text-white active:scale-95 transition-all">X</button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1.5 justify-items-center">
                <label
                  title="Load custom sample"
                  onClick={(e) => {
                    if (window.electronAPI) {
                      e.preventDefault();
                      pickAudioFileElectron();
                    }
                  }}
                  className="futuristic-button compact-button action-button w-9 h-9 cursor-pointer bg-black/30 text-neutral-300 border border-neutral-700 hover:text-white hover:border-[#FF0040]/40"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                </label>
                <button
                  onClick={() => setSavingPreset(true)}
                  title="Save current settings as a preset"
                  className="futuristic-button compact-button action-button w-9 h-9 bg-black/30 text-neutral-300 border border-neutral-700 hover:text-white hover:border-[#FF0040]/40"
                >
                  <Disc className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsBypassed(!isBypassed)}
                  title={`Bypass everything and listen to the raw sample (B) â€” ${isBypassed ? "ACTIVE" : "OFF"}`}
                  className={`futuristic-button compact-button action-button w-9 h-9 border transition-all ${
                    isBypassed
                      ? "bg-white text-black border-white animate-accent-pulse"
                      : "bg-black/30 text-neutral-300 border-neutral-700 hover:text-white hover:border-white/40"
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRecord}
                  title={isRecording ? `Recording â€” ${formatTime(recordingDuration)} (R)` : "Record output (R)"}
                  className={`futuristic-button compact-button action-button flex-col gap-0 w-9 h-9 border transition-all ${
                    isRecording
                      ? "bg-[#FF0040] text-white animate-accent-pulse"
                      : "bg-black/30 text-neutral-300 border-neutral-700 hover:text-[#FF0040] hover:border-[#FF0040]/40"
                  }`}
                >
                  <CircleDot className={`w-3.5 h-3.5 ${isRecording ? "animate-pulse" : ""}`} />
                  {isRecording && <span className="text-[7px] font-bold leading-none">{formatTime(recordingDuration)}</span>}
                </button>
                <button
                  onClick={handleExportWav}
                  disabled={isExporting}
                  title="Export rendered WAV sample (E)"
                  className={`futuristic-button compact-button action-button w-9 h-9 transition-colors ${
                    isExporting
                      ? "bg-neutral-600 text-neutral-300 cursor-wait"
                      : "bg-[#FF0040] text-white hover:bg-[#cc0033]"
                  }`}
                >
                  {isExporting ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={resetAll}
                  title="Reset all parameters to the active preset defaults"
                  className="futuristic-button compact-button action-button w-9 h-9 bg-black/20 text-neutral-500 border border-neutral-800 hover:text-neutral-300 hover:border-neutral-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

          {/* Center 3D Void Viewport */}
          <div ref={viewportRef} className="col-span-6 relative min-h-[380px]">
            <div
              ref={orbitTargetRef}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOverVoid(true); }}
              onDragEnter={(e) => { 
                e.preventDefault(); 
                setIsDraggingOverVoid(true); 
                const fn = e.dataTransfer.files?.[0]?.name;
                if (fn) setDragFileName(fn.toUpperCase());
              }}
              onDragLeave={() => { setIsDraggingOverVoid(false); setDragFileName(null); }}
              onDrop={handleVoidDrop}
              className={`absolute inset-0 ${
                isDraggingOverVoid ? "bg-neutral-900/80 border-white" : ""
              }`}
            />

{/* SVG Interactive Patch Cables overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-40">
                <style>{`
                  @keyframes dash-flow {
                    to { stroke-dashoffset: -24; }
                  }
                  .cable-flow {
                    stroke-dasharray: 6 4;
                    animation: cable-draw 0.3s linear infinite;
                  }
                `}</style>
                <line
                  x1="25%" y1="70%" x2="42%" y2="52%"
                  stroke={activeConnections["synth-reverb"] ? "#FF0040" : "#444444"}
                  strokeWidth="2"
                  strokeDasharray={activeConnections["synth-reverb"] ? "6 4" : "0"}
                  className={activeConnections["synth-reverb"] ? "cable-flow" : ""}
                />
                <line
                  x1="50%" y1="70%" x2="50%" y2="52%"
                  stroke={activeConnections["granular-delay"] ? "#FF0040" : "#444444"}
                  strokeWidth="2"
                  strokeDasharray={activeConnections["granular-delay"] ? "6 4" : "0"}
                  className={activeConnections["granular-delay"] ? "cable-flow" : ""}
                />
                <line
                  x1="75%" y1="70%" x2="58%" y2="52%"
                  stroke={activeConnections["distortion-void"] ? "#FF0040" : "#444444"}
                  strokeWidth="2"
                  strokeDasharray={activeConnections["distortion-void"] ? "6 4" : "0"}
                  className={activeConnections["distortion-void"] ? "cable-flow" : ""}
                />
              </svg>

{/* Effect Connection Cluster */}
             <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
               <div className="flex items-center gap-1.5">
                   <button
                     onClick={() => toggleConnection("synth-reverb")}
                     className={`futuristic-button compact-button px-1.5 py-1 text-[8px] border rounded font-bold transition-all flex items-center gap-1 ${
                       activeConnections["synth-reverb"] ? "bg-[#FF0040]/90 text-white border-[#FF0040]" : "bg-black/20 text-neutral-500 border-neutral-700/50 backdrop-blur-sm hover:bg-[#FF0040]/10 hover:text-[#FF0040] hover:border-[#FF0040]/50"
                     }`}
                   >
                     <Zap className="w-2.5 h-2.5" />
                     SD - Rev PAD
                   </button>
                   <div className={`transport-knob ${activeConnections["synth-reverb"] ? "transport-knob-active" : ""}`}>
                     <Knob value={reverbMix} min={0} max={1} onChange={setReverbMix} label="" displayValue="" size={24} />
                   </div>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <button
                     onClick={() => toggleConnection("granular-delay")}
                     className={`futuristic-button compact-button px-1.5 py-1 text-[8px] border rounded font-bold transition-all flex items-center gap-1 ${
                       activeConnections["granular-delay"] ? "bg-[#FF0040]/90 text-white border-[#FF0040]" : "bg-black/20 text-neutral-500 border-neutral-700/50 backdrop-blur-sm hover:bg-[#FF0040]/10 hover:text-[#FF0040] hover:border-[#FF0040]/50"
                     }`}
                   >
                     <Zap className="w-2.5 h-2.5" />
                     GRAIN ECHO
                   </button>
                   <div className={`transport-knob ${activeConnections["granular-delay"] ? "transport-knob-active" : ""}`}>
                     <Knob value={delayMix} min={0} max={0.8} onChange={setDelayMix} label="" displayValue="" size={24} />
                   </div>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <button
                     onClick={() => toggleConnection("distortion-void")}
                     className={`futuristic-button compact-button px-1.5 py-1 text-[8px] border rounded font-bold transition-all flex items-center gap-1 ${
                       activeConnections["distortion-void"] ? "bg-[#FF0040]/90 text-white border-[#FF0040]" : "bg-black/20 text-neutral-500 border-neutral-700/50 backdrop-blur-sm hover:bg-[#FF0040]/10 hover:text-[#FF0040] hover:border-[#FF0040]/50"
                     }`}
                   >
                     <Zap className="w-2.5 h-2.5" />
                     DRIVE SINGLTY
                   </button>
                   <div className={`transport-knob ${activeConnections["distortion-void"] ? "transport-knob-active" : ""}`}>
                     <Knob value={distortion} min={0} max={100} onChange={setDistortion} label="" displayValue="" size={24} />
                   </div>
                 </div>
             </div>

            {/* Play/Pause / Replay / Loop Transport Bar */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
              <button
                onClick={handleReplay}
                title="Replay from start"
                className="futuristic-button w-10 h-10 rounded-full border border-neutral-700 bg-black/80 text-neutral-300 hover:text-white hover:border-white transition-all flex items-center justify-center shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                 onClick={() => setIsPlaying(!isPlaying)}
                 title="Play / Pause (Space)"
                 className={`futuristic-button w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center shadow-2xl shrink-0 ${
                   isPlaying
                     ? "bg-[#FF0040] text-white border-[#FF0040] hover:scale-105 animate-accent-pulse"
                     : "bg-black/80 text-white border-neutral-400 hover:border-[#FF0040]/50 hover:bg-black"
                 }`}
               >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={toggleLoop}
                title="Toggle Sample Loop"
                className={`futuristic-button w-10 h-10 rounded-full border transition-all flex items-center justify-center shrink-0 ${
                  isLooping
                    ? "bg-white text-black border-white"
                    : "bg-black/80 border-neutral-700 text-neutral-500 hover:text-white"
                }`}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

{/* Hero Title */}
             <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none">
               <h2 className={`text-2xl font-black tracking-tighter transition-colors duration-300 ${isPlaying ? "text-white" : "text-neutral-300"}`}>
                 {customAudioName ? customAudioName : selectedSample.name}
               </h2>
               <p className="text-[10px] text-neutral-400 font-sans mt-0.5">
                 CODE: {selectedSample.code} | {selectedSample.type.toUpperCase()}
               </p>
             </div>

{isDraggingOverVoid ? (
               <div className="absolute inset-0 z-30 bg-black/95 border-2 border-[#FF0040] border-dashed flex flex-col items-center justify-center text-center p-4 shadow-[inset_0_0_60px_rgba(255,0,64,0.1)]">
                 <Upload className="w-10 h-10 text-[#FF0040] mb-2 animate-bounce" />
                 <p className="text-sm font-bold text-[#FF0040] tracking-widest">DROP SAMPLE INTO THE VOID</p>
                 {dragFileName && <p className="text-[11px] text-neutral-300 mt-1 font-mono">{dragFileName}</p>}
                 <p className="text-[10px] text-neutral-400 mt-1">INSTANT RE-SYNTHESIS & SCULPTING</p>
               </div>
             ) : (
               <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-neutral-400 tracking-widest uppercase bg-black/70 px-3 py-1 border border-neutral-800 rounded z-20">
                 DRAG & DROP AUDIO FILE INTO VOID
</div>
                )}
              </div>

{/* Right Control & FX Panel */}
           <div className="col-span-3 p-3 flex flex-col space-y-3 z-10 overflow-y-auto scrollbar-thin">

{/* Signal-Chain Rack: Granular + all FX in one chain */}
              <div className="rounded-md border border-neutral-700/80 bg-transparent flex flex-col overflow-hidden">
               <div className="px-3 py-2 border-b border-neutral-800 bg-black/30 flex items-center justify-between shrink-0">
                 <span className="flex items-center gap-1 text-[10px] font-bold tracking-widest text-neutral-300">
                   <Sliders className="w-3.5 h-3.5 text-[#FF0040]" /> SIGNAL CHAIN
                 </span>
                 <span className={isBypassed ? "text-neutral-400" : "text-[#FF0040]"}>{isBypassed ? "RAW" : "SCULPTED"}</span>
               </div>

               <div className="overflow-y-auto scrollbar-thin p-3 max-h-[52vh]">
              <div className="space-y-2">
                <Module
                  label="GRANULAR"
                  icon={<Waves className="w-3 h-3" />}
                  description="Granular synthesis engine for the source sample."
                  enabled={enableGranular}
                  onToggle={() => setEnableGranular(!enableGranular)}
                  defaultOpen={enableGranular}
                  miniKnob={<Knob value={grainDensity} min={2} max={50} onChange={setGrainDensity} label="" displayValue={`${grainDensity}`} size={32} />}
                >
                  <div className="grid grid-cols-4 gap-2">
                    <Knob
                      value={grainDensity}
                      min={2}
                      max={50}
                      onChange={setGrainDensity}
                      label="Density"
                      displayValue={`${grainDensity}/s`}
                      size={56}
                    />
                    <Knob
                      value={grainSize}
                      min={0.02}
                      max={0.3}
                      onChange={setGrainSize}
                      label="Size"
                      displayValue={`${Math.round(grainSize * 1000)}ms`}
                      size={56}
                    />
                    <Knob
                      value={pitchShift}
                      min={0.2}
                      max={2.0}
                      onChange={setPitchShift}
                      label="Pitch"
                      displayValue={`${pitchShift.toFixed(2)}x`}
                      size={56}
                    />
                    <Knob
                      value={spray}
                      min={0}
                      max={0.15}
                      onChange={setSpray}
                      label="Spray"
                      displayValue={`${Math.round(spray * 1000)}ms`}
                      size={56}
                    />
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-neutral-400 mb-1">
                      <span>Harmonic Mode</span>
                      <span className="text-white font-bold uppercase">{harmonicMode.replace("_", " ")}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {HARMONIC_MODES.map((mode) => (
                        <button
                          key={mode.id}
                          onClick={() => setHarmonicMode(mode.id)}
                          title={`Harmonic mode: ${mode.label}`}
                          className={`futuristic-button compact-button py-0.5 px-1.5 text-[9px] whitespace-nowrap rounded border transition-all ${
                            harmonicMode === mode.id
                              ? "bg-white text-black border-white font-bold"
                              : "bg-black/30 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white"
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </Module>

                <Module label="FILTER" icon={<Filter className="w-3 h-3" />} enabled={enableFilter} onToggle={() => setEnableFilter(!enableFilter)}
                  miniKnob={<Knob value={filterCutoff} min={50} max={20000} onChange={setFilterCutoff} label="" displayValue={filterCutoff >= 1000 ? `${(filterCutoff / 1000).toFixed(1)}k` : `${Math.round(filterCutoff)}`} size={32} />}
                >
                  <div className="flex gap-1 mb-2">
                    {FILTER_TYPES.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setFilterType(f.id)}
                        title={`Filter type: ${f.label}`}
                        className={`futuristic-button compact-button flex-1 py-1 text-[9px] font-bold border rounded tracking-wider transition-all ${
                          filterType === f.id
                            ? "bg-white text-black border-white"
                            : "bg-black/30 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Knob
                      value={filterCutoff}
                      min={50}
                      max={20000}
                      onChange={setFilterCutoff}
                      label="Cutoff"
                      displayValue={filterCutoff >= 1000 ? `${(filterCutoff / 1000).toFixed(1)}k` : `${Math.round(filterCutoff)}Hz`}
                      defaultValue={2000}
                      size={56}
                    />
                    <Knob
                      value={filterResonance}
                      min={0.1}
                      max={20}
                      onChange={setFilterResonance}
                      label="Resonance"
                      displayValue={`${filterResonance.toFixed(1)}`}
                      defaultValue={1}
                      size={56}
                    />
                  </div>
                </Module>

                <Module label="DISTORTION" icon={<Zap className="w-3 h-3" />} description="Adds harmonic saturation and edge to the source." enabled={enableDistortion} onToggle={() => setEnableDistortion(!enableDistortion)}
                  miniKnob={<Knob value={distortion} min={0} max={100} onChange={setDistortion} label="" displayValue={`${Math.round(distortion)}`} size={32} />}
                >
                  {distortion >= 75 && <p className="text-center text-[9px] text-[#FF0040]">HIGH DRIVE — output may become aggressive</p>}
                </Module>

                <Module label="DELAY" icon={<Repeat className="w-3 h-3" />} description="Repeats the signal; use Feedback below to control regeneration." enabled={enableDelay} onToggle={() => setEnableDelay(!enableDelay)}
                  miniKnob={<Knob value={delayMix} min={0} max={0.8} onChange={setDelayMix} label="" displayValue={`${Math.round(delayMix / 0.8 * 100)}`} size={32} />}
                >
                </Module>

                <Module label="REVERB" description="Blends the signal into a spacious ambient tail." enabled={enableReverb} onToggle={() => setEnableReverb(!enableReverb)}
                  miniKnob={<Knob value={reverbMix} min={0} max={1} onChange={setReverbMix} label="" displayValue={`${Math.round(reverbMix * 100)}`} size={32} />}
                >
                </Module>

                <Module label="COMPRESSOR" icon={<Sliders className="w-3 h-3" />} enabled={enableCompressor} onToggle={() => setEnableCompressor(!enableCompressor)}
                  miniKnob={<Knob value={compThreshold} min={-60} max={0} onChange={setCompThreshold} label="" displayValue={`${Math.round(compThreshold)}`} size={32} />}
                >
                  <div className="grid grid-cols-4 gap-2">
                    <Knob
                      value={compThreshold}
                      min={-60}
                      max={0}
                      onChange={setCompThreshold}
                      label="Threshold"
                      displayValue={`${Math.round(compThreshold)}dB`}
                      defaultValue={-24}
                      size={56}
                    />
                    <Knob
                      value={compRatio}
                      min={1}
                      max={20}
                      onChange={setCompRatio}
                      label="Ratio"
                      displayValue={`${compRatio.toFixed(1)}:1`}
                      defaultValue={3}
                      size={56}
                    />
                    <Knob
                      value={compAttack}
                      min={0}
                      max={0.5}
                      onChange={setCompAttack}
                      label="Attack"
                      displayValue={`${Math.round(compAttack * 1000)}ms`}
                      defaultValue={0.003}
                      size={56}
                    />
                    <Knob
                      value={compRelease}
                      min={0}
                      max={1}
                      onChange={setCompRelease}
                      label="Release"
                      displayValue={`${Math.round(compRelease * 1000)}ms`}
                      defaultValue={0.25}
                      size={56}
                    />
                  </div>
                </Module>

                <Module label="SPECTRAL EQ" icon={<Activity className="w-3 h-3" />} enabled={enableEq} onToggle={() => setEnableEq(!enableEq)}
                  miniKnob={<Knob value={eqMidGain} min={-12} max={12} onChange={setEqMidGain} label="" displayValue={`${eqMidGain > 0 ? "+" : ""}${eqMidGain.toFixed(0)}`} size={32} />}
                >
                  <div className="grid grid-cols-3 gap-2">
                    <Knob
                      value={eqLowGain}
                      min={-12}
                      max={12}
                      onChange={setEqLowGain}
                      label="Low"
                      displayValue={`${eqLowGain > 0 ? "+" : ""}${eqLowGain.toFixed(0)}dB`}
                      defaultValue={0}
                      size={56}
                    />
                    <Knob
                      value={eqMidGain}
                      min={-12}
                      max={12}
                      onChange={setEqMidGain}
                      label="Mid"
                      displayValue={`${eqMidGain > 0 ? "+" : ""}${eqMidGain.toFixed(0)}dB`}
                      defaultValue={0}
                      size={56}
                    />
                    <Knob
                      value={eqHighGain}
                      min={-12}
                      max={12}
                      onChange={setEqHighGain}
                      label="High"
                      displayValue={`${eqHighGain > 0 ? "+" : ""}${eqHighGain.toFixed(0)}dB`}
                      defaultValue={0}
                      size={56}
                    />
                  </div>
                  <p className="text-[9px] text-neutral-600 text-center mt-1">BANDS: 120Hz / 1kHz / 5kHz</p>
                </Module>
              </div>
                </div>
              </div>

              {/* Particle Visual Mode Controls */}
              <PanelSection title="PARTICLE MODE" icon={<CircleDot className="w-3 h-3" />}>
                <div className="flex gap-1">
                  {PARTICLE_MODES.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setParticleMode(mode)}
                      title={`Particle mode: ${mode.toUpperCase()}`}
                      className={`futuristic-button compact-button flex-1 py-1 text-[9px] font-bold border rounded uppercase tracking-wider transition-all ${
                        particleMode === mode
                          ? "bg-[#FF0040] text-white border-[#FF0040]"
                          : "bg-black/30 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white hover:border-[#FF0040]/30"
                      }`}
                    >
                      {mode === "dots" ? "● DOTS" : mode === "rings" ? "◉ RINGS" : mode === "blur" ? "◌ BLUR" : "◘ BLACK HOLE"}
                    </button>
                  ))}
                </div>
              </PanelSection>

              {/* Timeline preview */}
              <div className="border border-neutral-800 bg-black/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-neutral-400">
                  <span className="flex items-center gap-1"><Activity className="w-3 h-3 text-[#FF0040]" /> TIMELINE</span>
                  <div className="flex items-center gap-2">
                    {loopActive && (
                      <>
                        <span className="text-[#FF0040] font-mono font-bold">LOOP {loopLabel}</span>
                        <button
                          onClick={clearLoopRegion}
                          title="Clear loop region"
                          className="futuristic-button compact-button px-1 py-0.5 text-[8px] font-bold border rounded uppercase tracking-wider transition-all bg-black/30 text-neutral-400 border-neutral-800 hover:text-white hover:border-[#FF0040]/40"
                        >
                          CLEAR
                        </button>
                      </>
                    )}
                    <span className="text-[#FF0040] font-mono font-bold">{formatTime((audioBufferRef.current?.duration || 0) * playheadPos)} / {formatTime(audioBufferRef.current?.duration || 0)}</span>
                  </div>
                </div>
                <WaveformView
                  buffer={audioBufferRef.current}
                  playheadPos={playheadPos}
                  onSeek={handleSeek}
                  isPlaying={isPlaying}
                  height={92}
                  loopStart={loopStart}
                  loopEnd={loopEnd}
                  onSetLoopStart={handleSetLoopStart}
                  onSetLoopEnd={handleSetLoopEnd}
                  onClearLoop={clearLoopRegion}
                />
              </div>

</div>

</div>
          </div>

          {/* Full-width Timeline Deck */}
          <div className="relative z-20 shrink-0 border-t border-neutral-700/80 bg-black/45 px-5 backdrop-blur-md">
            <div className="flex h-9 items-center justify-between text-[10px] tracking-wider">
              <div className="flex items-center gap-3 text-neutral-400">
                <span className="flex items-center gap-1 font-bold text-neutral-200"><Activity className="w-3 h-3 text-[#FF0040]" /> TIMELINE</span>
                <span className="hidden text-neutral-600 sm:inline">{customAudioName || selectedSample.name}</span>
                <span className="text-[#FF0040] font-mono font-bold">{formatTime((audioBufferRef.current?.duration || 0) * playheadPos)} / {formatTime(audioBufferRef.current?.duration || 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                {loopActive && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-[#FF0040] font-mono font-bold">LOOP {loopLabel}</span>
                    <button
                      onClick={clearLoopRegion}
                      title="Clear loop region"
                      className="futuristic-button compact-button px-1.5 py-0.5 text-[8px] font-bold border rounded uppercase tracking-wider transition-all bg-black/30 text-neutral-400 border-neutral-800 hover:text-white hover:border-[#FF0040]/40"
                    >
                      CLEAR
                    </button>
                  </span>
                )}
                {!isTimelineCollapsed && <span className="text-[9px] text-neutral-600">DRAG TO SEEK Â· SCROLL TO ZOOM</span>}
                <button
                  onClick={() => setIsTimelineCollapsed((collapsed) => !collapsed)}
                  title={isTimelineCollapsed ? "Expand timeline" : "Collapse timeline"}
                  className="futuristic-button compact-button border border-neutral-700 bg-black/40 px-2 text-neutral-300 hover:border-white hover:text-white"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform ${isTimelineCollapsed ? "-rotate-90" : ""}`} />
                </button>
              </div>
            </div>
            {!isTimelineCollapsed && (
              <div className="pb-3">
                <WaveformView
                  buffer={audioBufferRef.current}
                  playheadPos={playheadPos}
                  onSeek={handleSeek}
                  isPlaying={isPlaying}
                  height={128}
                  loopStart={loopStart}
                  loopEnd={loopEnd}
                  onSetLoopStart={handleSetLoopStart}
                  onSetLoopEnd={handleSetLoopEnd}
                  onClearLoop={clearLoopRegion}
                />
              </div>
            )}
          </div>

          {/* Footer HUD Bar */}
         <div className="px-6 py-2 border-t border-neutral-800 bg-black/60 backdrop-blur-sm text-[10px] text-neutral-500 flex justify-between">
           <span className="text-neutral-600">Ar: ARGON 38.946</span>
           <span className="text-neutral-600">O2: OXYGEN 15.999</span>
           <span className="text-neutral-400">SYSTEM: <span className="text-[#FF0040]">PRIMESYSTEM</span> v{appVersion}</span>
         </div>

         {/* Onboarding Tooltip */}
         {hasSeenOnboarding && (
           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
             <div className="border border-neutral-700 bg-black/90 rounded-lg p-6 max-w-md text-center space-y-4">
               <h3 className="text-sm font-bold text-[#FF0040] tracking-widest uppercase">Welcome to Granular Sound Sculptor</h3>
                <div className="space-y-2 text-left text-xs text-neutral-300">
                  <p><span className="text-white font-bold">Drag & Drop</span> an audio file into the 3D void</p>
                  <p><span className="text-white font-bold">Space</span> to play/pause</p>
                  <p><span className="text-white font-bold">1-N</span> to switch presets</p>
                  <p><span className="text-white font-bold">R</span> to record output</p>
                  <p><span className="text-white font-bold">E</span> to export WAV</p>
                  <p><span className="text-white font-bold">B</span> to bypass everything (raw sample)</p>
                  <p><span className="text-white font-bold">C</span> to toggle compressor</p>
                  <p><span className="text-white font-bold">G</span> to toggle glitch void</p>
                  <p><span className="text-white font-bold">Click</span> a module to expand / collapse it</p>
                  <p><span className="text-white font-bold">/</span> show all keyboard shortcuts</p>
                  <p><span className="text-white font-bold">Scroll</span> on knobs for fine adjustment</p>
                </div>
               <button
                 onClick={dismissOnboarding}
                 className="px-4 py-2 bg-[#FF0040] text-white text-xs font-bold rounded hover:bg-[#cc0033] transition-colors"
               >
                 GET STARTED
               </button>
             </div>
           </div>
         )}

         {/* Keyboard Shortcuts Modal */}
         {showShortcuts && (
           <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
             <div className="border border-neutral-700 bg-black/90 rounded-lg p-6 max-w-md space-y-3" onClick={e => e.stopPropagation()}>
               <h3 className="text-sm font-bold text-[#FF0040] tracking-widest uppercase">Keyboard Shortcuts</h3>
               <div className="space-y-2 text-xs">
                  {[
                    ["Space", "Play / Pause"],
                    ["1 - N", "Load preset (built-in + custom)"],
                    ["B", "Bypass everything (raw sample)"],
                    ["C", "Toggle compressor"],
                    ["Shift + E", "Toggle spectral EQ"],
                    ["R", "Record output"],
                    ["E", "Export WAV"],
                    ["G", "Toggle glitch void"],
                    ["L", "Toggle loop on/off (keeps A\u2013B region)"],
                    ["\u2190 / \u2192", "Move loop start (A)"],
                    ["Shift + \u2190 / \u2192", "Move loop end (B)"],
                    ["/", "Show shortcuts"],
                    ["Click module", "Expand / collapse a signal-chain module"],
                    ["Alt + Scroll", "Fine-tune knob"],
                    ["Double-click", "Reset knob to default"],
                  ].map(([key, desc]) => (
                   <div key={key} className="flex justify-between items-center">
                     <kbd className="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-[10px] font-mono text-[#FF0040]">{key}</kbd>
                     <span className="text-neutral-400">{desc}</span>
                   </div>
                 ))}
               </div>
               <button
                 onClick={() => setShowShortcuts(false)}
                 className="w-full py-2 bg-[#FF0040] text-white text-xs font-bold rounded hover:bg-[#cc0033] transition-colors"
               >
                 CLOSE
               </button>
             </div>
           </div>
          )}
      </div>
    );
}
