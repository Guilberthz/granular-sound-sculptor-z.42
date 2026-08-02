import { useEffect, useRef, useState } from "react";

interface DeltaActivityViewProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
}

type SpectrumMode = "pulse" | "mirror";

const FRAME_MS = 1000 / 30;

export default function DeltaActivityView({ analyserRef }: DeltaActivityViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const modeRef = useRef<SpectrumMode>("pulse");
  const [mode, setMode] = useState<SpectrumMode>("pulse");
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    if (!analyser) return;

    analyser.fftSize = 512;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const smooth = new Float32Array(bufferLength);
    const peaks = new Float32Array(bufferLength);
    const displayLength = Math.floor(bufferLength * 0.4);

    let gradient: CanvasGradient | null = null;
    let lastGradH = -1;
    let lastDraw = 0;
    let silentFrames = 0;

    const ensureGradient = (h: number) => {
      if (!gradient || lastGradH !== h) {
        gradient = ctx.createLinearGradient(0, h, 0, 0);
        gradient.addColorStop(0, "rgba(255, 0, 64, 0.35)");
        gradient.addColorStop(0.55, "rgba(255, 0, 64, 0.12)");
        gradient.addColorStop(1, "rgba(255, 0, 64, 0)");
        lastGradH = h;
      }
      return gradient;
    };

    const render = (now: number) => {
      rafRef.current = requestAnimationFrame(render);
      if (document.hidden) return;
      if (now - lastDraw < FRAME_MS) return;

      const currentAnalyser = analyserRef.current;
      if (!currentAnalyser) return;

      currentAnalyser.getByteFrequencyData(dataArray);

      // Skip drawing while silent (leave last frame on screen)
      let sum = 0;
      for (let i = 0; i < displayLength; i++) sum += dataArray[i];
      if (sum === 0) {
        if (silentFrames > 3) return;
        silentFrames++;
      } else {
        silentFrames = 0;
      }

      lastDraw = now;

      const w = canvas.width;
      const h = canvas.height;
      const centerY = h * 0.5;
      const isMirror = modeRef.current === "mirror";

      ctx.clearRect(0, 0, w, h);

      const sliceWidth = w / displayLength;

      const yTop = (i: number) =>
        isMirror ? centerY - smooth[i] * centerY : (1 - smooth[i]) * h;

      // Gridlines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let g = 1; g < 4; g++) {
        const gy = (h / 4) * g;
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
      }
      ctx.stroke();

      // Baseline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      ctx.moveTo(0, h - 1);
      ctx.lineTo(w, h - 1);
      ctx.stroke();

      // Smooth bins
      for (let i = 0; i < displayLength; i++) {
        const raw = dataArray[i] / 255.0;
        smooth[i] += (raw - smooth[i]) * 0.45;
      }

      // Filled area (below the pulse, or the band between mirrored curves)
      ctx.fillStyle = ensureGradient(h);
      ctx.beginPath();
      if (isMirror) {
        ctx.moveTo(0, centerY);
        for (let i = 0; i < displayLength; i++) ctx.lineTo(i * sliceWidth, yTop(i));
        ctx.lineTo(w, centerY);
        for (let i = displayLength - 1; i >= 0; i--) {
          const top = yTop(i);
          ctx.lineTo(i * sliceWidth, h - top);
        }
        ctx.closePath();
      } else {
        ctx.moveTo(0, h);
        for (let i = 0; i < displayLength; i++) ctx.lineTo(i * sliceWidth, yTop(i));
        ctx.lineTo(w, h);
        ctx.closePath();
      }
      ctx.fill();

      // Glow stroke
      ctx.strokeStyle = "rgba(255, 0, 64, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < displayLength; i++) {
        const x = i * sliceWidth;
        if (i === 0) ctx.moveTo(x, yTop(i));
        else ctx.lineTo(x, yTop(i));
      }
      ctx.stroke();

      if (isMirror) {
        ctx.beginPath();
        for (let i = 0; i < displayLength; i++) {
          const x = i * sliceWidth;
          if (i === 0) ctx.moveTo(x, h - yTop(i));
          else ctx.lineTo(x, h - yTop(i));
        }
        ctx.stroke();
      }

      // Decaying white peak-hold caps
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      for (let i = 0; i < displayLength; i++) {
        const target = yTop(i);
        if (target < peaks[i]) peaks[i] = target;
        else peaks[i] = Math.min(target, peaks[i] + 0.7);
        const x = i * sliceWidth;
        ctx.fillRect(x, peaks[i] - 1, Math.max(1, sliceWidth), 2);
        if (isMirror) ctx.fillRect(x, h - peaks[i] - 1, Math.max(1, sliceWidth), 2);
      }
    };

    render(performance.now());

    return () => cancelAnimationFrame(rafRef.current);
  }, [analyserRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = Math.max(60, parent.clientHeight);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement!);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full bg-[#0a0a0c] border border-neutral-800 rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-[#0f0f11]">
        <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">DELTA ACTIVITY</span>
        <div className="flex gap-1">
          {(["pulse", "mirror"] as SpectrumMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              title={`Spectrum mode: ${m.toUpperCase()}`}
              className={`futuristic-button compact-button px-1.5 py-0.5 text-[8px] font-bold border rounded uppercase tracking-wider transition-all ${
                mode === m
                  ? "bg-[#FF0040] text-white border-[#FF0040]"
                  : "bg-black/30 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white hover:border-[#FF0040]/30"
              }`}
            >
              {m === "pulse" ? "PULSE" : "MIRROR"}
            </button>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full h-24 block" />
      <div className="flex justify-between px-3 py-2 text-[8px] font-mono text-neutral-600 border-t border-neutral-800 bg-[#0f0f11]">
        <span>02</span>
        <span>08</span>
        <span>16</span>
        <span>24</span>
        <span>32</span>
      </div>
    </div>
  );
}
