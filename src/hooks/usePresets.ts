import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { PresetSample, PresetParams, HarmonicMode } from "../types";
import { PRESET_SAMPLES, DEFAULT_PRESET_PARAMS } from "../presets";
import { PresetManager } from "../presets/PresetManager";

export interface UsePresetsResult {
  // sound parameters (kept in one place so presets can read + write them)
  grainDensity: number; setGrainDensity(v: number): void;
  grainSize: number; setGrainSize(v: number): void;
  pitchShift: number; setPitchShift(v: number): void;
  spray: number; setSpray(v: number): void;
  textureMix: number; setTextureMix(v: number): void;
  harmonicMode: HarmonicMode; setHarmonicMode(v: HarmonicMode): void;
  enableGranular: boolean; setEnableGranular(v: boolean): void;
  enableDistortion: boolean; setEnableDistortion(v: boolean): void;
  distortion: number; setDistortion(v: number): void;
  enableReverb: boolean; setEnableReverb(v: boolean): void;
  reverbMix: number; setReverbMix(v: number): void;
  enableDelay: boolean; setEnableDelay(v: boolean): void;
  delayMix: number; setDelayMix(v: number): void;
  delayTime: number; setDelayTime(v: number): void;
  feedback: number; setFeedback(v: number): void;
  enableFilter: boolean; setEnableFilter(v: boolean): void;
  filterType: BiquadFilterType; setFilterType(v: BiquadFilterType): void;
  filterCutoff: number; setFilterCutoff(v: number): void;
  filterResonance: number; setFilterResonance(v: number): void;
  enableEq: boolean; setEnableEq: React.Dispatch<React.SetStateAction<boolean>>;
  eqLowGain: number; setEqLowGain(v: number): void;
  eqMidGain: number; setEqMidGain(v: number): void;
  eqHighGain: number; setEqHighGain(v: number): void;
  enableCompressor: boolean; setEnableCompressor: React.Dispatch<React.SetStateAction<boolean>>;
  compThreshold: number; setCompThreshold(v: number): void;
  compRatio: number; setCompRatio(v: number): void;
  compAttack: number; setCompAttack(v: number): void;
  compRelease: number; setCompRelease(v: number): void;
  volume: number; setVolume(v: number): void;
  isGlitchVoid: boolean; setIsGlitchVoid: React.Dispatch<React.SetStateAction<boolean>>;
  glowIntensity: number; setGlowIntensity(v: number): void;

  // ---- preset / sample lifecycle
  selectedSample: PresetSample; setSelectedSample(v: PresetSample): void;
  customSamples: PresetSample[];
  customPresets: Record<string, PresetParams>;
  allPresets: PresetSample[];
  allPresetsRef: React.MutableRefObject<PresetSample[]>;
  customPresetsRef: React.MutableRefObject<Record<string, PresetParams>>;
  savingPreset: boolean; setSavingPreset(v: boolean): void;
  newPresetName: string; setNewPresetName(v: string): void;
  applyPresetParams: (params: PresetParams) => void;
  selectPreset: (sample: PresetSample) => void;
  saveCurrentPreset: () => void;
  deleteCustomPreset: (sample: PresetSample) => void;
  renameCustomPreset: (sample: PresetSample, newName: string) => void;
}

export function usePresets(): UsePresetsResult {
  const [selectedSample, setSelectedSample] = useState<PresetSample>(PRESET_SAMPLES[0]);
  const selectedSampleRef = useRef(selectedSample);
  selectedSampleRef.current = selectedSample;

  const [distortion, setDistortion] = useState(0);
  const [reverbMix, setReverbMix] = useState(0);
  const [delayMix, setDelayMix] = useState(0);
  const [delayTime, setDelayTime] = useState(0.4);

  const [grainDensity, setGrainDensity] = useState(30);
  const [grainSize, setGrainSize] = useState(0.2);
  const [pitchShift, setPitchShift] = useState(1.0);
  const [spray, setSpray] = useState(0.08);
  const [textureMix, setTextureMix] = useState(0.8);

  const [harmonicMode, setHarmonicMode] = useState<HarmonicMode>("none");

  const [enableGranular, setEnableGranular] = useState(true);
  const [enableDistortion, setEnableDistortion] = useState(true);
  const [enableReverb, setEnableReverb] = useState(true);
  const [enableDelay, setEnableDelay] = useState(true);

  const [enableCompressor, setEnableCompressor] = useState(false);
  const [compThreshold, setCompThreshold] = useState(-24);
  const [compRatio, setCompRatio] = useState(3);
  const [compAttack, setCompAttack] = useState(0.003);
  const [compRelease, setCompRelease] = useState(0.25);

  const [enableEq, setEnableEq] = useState(false);
  const [eqLowGain, setEqLowGain] = useState(0);
  const [eqMidGain, setEqMidGain] = useState(0);
  const [eqHighGain, setEqHighGain] = useState(0);

  const [isGlitchVoid, setIsGlitchVoid] = useState(true);
  const [glowIntensity, setGlowIntensity] = useState(0.5);

  const [volume, setVolume] = useState(0.75);
  const [feedback, setFeedback] = useState(0.3);

  const [enableFilter, setEnableFilter] = useState(false);
  const [filterType, setFilterType] = useState<BiquadFilterType>("lowpass");
  const [filterCutoff, setFilterCutoff] = useState(2000);
  const [filterResonance, setFilterResonance] = useState(1);

  const [customSamples, setCustomSamples] = useState<PresetSample[]>([]);
  const [customPresets, setCustomPresets] = useState<Record<string, PresetParams>>({});
  const [savingPreset, setSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const allPresets = useMemo(() => [...PRESET_SAMPLES, ...customSamples], [customSamples]);
  const allPresetsRef = useRef(allPresets);
  allPresetsRef.current = allPresets;
  const customPresetsRef = useRef(customPresets);
  customPresetsRef.current = customPresets;
  const managerRef = useRef<PresetManager | null>(null);

  const buildCurrentParams = useCallback((): PresetParams => ({
    grainDensity, grainSize, pitchShift, spray, harmonicMode,
    distortion, reverbMix, delayMix,
    enableGranular, enableDistortion, enableReverb, enableDelay,
    enableFilter, filterType, filterCutoff, filterResonance,
    enableCompressor, compThreshold, compRatio, compAttack, compRelease,
    enableEq, eqLowGain, eqMidGain, eqHighGain,
    isGlitchVoid, glowIntensity,
  }), [
    grainDensity, grainSize, pitchShift, spray, harmonicMode,
    distortion, reverbMix, delayMix,
    enableGranular, enableDistortion, enableReverb, enableDelay,
    enableFilter, filterType, filterCutoff, filterResonance,
    enableCompressor, compThreshold, compRatio, compAttack, compRelease,
    enableEq, eqLowGain, eqMidGain, eqHighGain, isGlitchVoid, glowIntensity,
  ]);

  const setParams = useCallback((params: PresetParams) => {
    setGrainDensity(params.grainDensity);
    setGrainSize(params.grainSize);
    setPitchShift(params.pitchShift);
    setSpray(params.spray);
    setHarmonicMode(params.harmonicMode);
    setDistortion(params.distortion);
    setReverbMix(params.reverbMix);
    setDelayMix(params.delayMix);
    setEnableGranular(params.enableGranular);
    setEnableDistortion(params.enableDistortion);
    setEnableReverb(params.enableReverb);
    setEnableDelay(params.enableDelay);
    setIsGlitchVoid(params.isGlitchVoid);
    setGlowIntensity(params.glowIntensity ?? 0.5);
    setEnableFilter(params.enableFilter ?? false);
    setFilterType(params.filterType ?? "lowpass");
    setFilterCutoff(params.filterCutoff ?? 2000);
    setFilterResonance(params.filterResonance ?? 1);
    setEnableCompressor(params.enableCompressor ?? false);
    setCompThreshold(params.compThreshold ?? -24);
    setCompRatio(params.compRatio ?? 3);
    setCompAttack(params.compAttack ?? 0.003);
    setCompRelease(params.compRelease ?? 0.25);
    setEnableEq(params.enableEq ?? false);
    setEqLowGain(params.eqLowGain ?? 0);
    setEqMidGain(params.eqMidGain ?? 0);
    setEqHighGain(params.eqHighGain ?? 0);
  }, []);

  const applyPresetParams = useCallback((params: PresetParams) => {
    setParams(params);
  }, [setParams]);

  const selectPreset = useCallback((sample: PresetSample) => {
    setSelectedSample(sample);
    const params = customPresetsRef.current[sample.id] || DEFAULT_PRESET_PARAMS[sample.id];
    if (params) setParams(params);
  }, [setParams]);

  const saveCurrentPreset = useCallback(() => {
    const name = newPresetName.trim() || `${selectedSample.name} CUSTOM`;
    const id = `custom_${Date.now()}`;
    const params = buildCurrentParams();
    setCustomPresets((prev) => ({ ...prev, [id]: params }));
    const newSample: PresetSample = { id, name, code: "USER", freq: selectedSample.freq, type: selectedSample.type };
    setCustomSamples((prev) => [...prev, newSample]);
    setSelectedSample(newSample);
    setNewPresetName("");
    setSavingPreset(false);
  }, [newPresetName, selectedSample, buildCurrentParams]);

  const deleteCustomPreset = useCallback((sample: PresetSample) => {
    setCustomSamples((prev) => prev.filter((s) => s.id !== sample.id));
    setCustomPresets((prev) => {
      const next = { ...prev };
      delete next[sample.id];
      return next;
    });
    if (selectedSampleRef.current.id === sample.id) {
      setSelectedSample(PRESET_SAMPLES[0]);
    }
  }, []);

  const renameCustomPreset = useCallback((sample: PresetSample, newName: string) => {
    const trimmed = newName.trim().toUpperCase();
    if (!trimmed) return;
    setCustomSamples((prev) => prev.map((s) => (s.id === sample.id ? { ...s, name: trimmed } : s)));
  }, []);

  useEffect(() => {
    const m = new PresetManager();
    managerRef.current = m;
    const store = m.load();
    setCustomSamples(store.samples);
    setCustomPresets(store.presets);
  }, []);

  useEffect(() => {
    const m = managerRef.current ?? (managerRef.current = new PresetManager());
    m.samples = customSamples;
    m.presets = customPresets;
    m.save();
  }, [customSamples, customPresets]);

  return {
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
    selectedSample, setSelectedSample, customSamples, customPresets,
    allPresets, allPresetsRef, customPresetsRef, savingPreset, setSavingPreset,
    newPresetName, setNewPresetName, applyPresetParams, selectPreset,
    saveCurrentPreset, deleteCustomPreset, renameCustomPreset,
  };
}