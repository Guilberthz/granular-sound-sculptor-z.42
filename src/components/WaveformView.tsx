import React, { useState, useEffect, useRef, useCallback } from "react";

function WaveformView({
  buffer,
  playheadPos,
  onSeek,
  isPlaying,
  height = 128,
  loopStart = null,
  loopEnd = null,
  onSetLoopStart,
  onSetLoopEnd,
  onClearLoop,
}: {
  buffer: AudioBuffer | null;
  playheadPos: number;
  onSeek: (pos: number) => void;
  isPlaying: boolean;
  height?: number;
  loopStart?: number | null;
  loopEnd?: number | null;
  onSetLoopStart?: (pos: number) => void;
  onSetLoopEnd?: (pos: number) => void;
  onClearLoop?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const rightDragging = useRef(false);
  const movedRef = useRef(false);
  const downXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<number | null>(null);
  const previewLoopEndRef = useRef<number | null>(null);
  const onSetLoopStartRef = useRef(onSetLoopStart);
  const onSetLoopEndRef = useRef(onSetLoopEnd);
  const onClearLoopRef = useRef(onClearLoop);
  onSetLoopStartRef.current = onSetLoopStart;
  onSetLoopEndRef.current = onSetLoopEnd;
  onClearLoopRef.current = onClearLoop;
  const [zoom, setZoom] = useState(1);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const getSeekFromClientX = useCallback((clientX: number) => {
    const el = wrapperRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft;
    const totalWidth = el.scrollWidth;
    return Math.max(0, Math.min(1, x / totalWidth));
  }, []);

  const flushFrame = useCallback(() => {
    rafRef.current = null;
    if (pendingSeekRef.current !== null) {
      onSeek(pendingSeekRef.current);
      pendingSeekRef.current = null;
    }
    if (pendingHoverRef.current !== null) {
      setHoverX(pendingHoverRef.current);
      pendingHoverRef.current = null;
    }
  }, [onSeek]);

  const schedule = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(flushFrame);
  }, [flushFrame]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!buffer) {
      ctx.fillStyle = "#444";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("NO SIGNAL", w / 2, h / 2 + 3);
      return;
    }

    const data = buffer.getChannelData(0);
    const totalSamples = data.length;
    const visibleSamples = Math.floor(totalSamples / zoom);
    const startSample = Math.floor((canvas.scrollLeft / (canvas.scrollWidth - canvas.clientWidth || 1)) * (totalSamples - visibleSamples));
    const endSample = Math.min(startSample + visibleSamples, totalSamples);
    const samplesPerPixel = Math.max(1, (endSample - startSample) / w);
    const amp = h / 2 - 14;

    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const idx = startSample + Math.floor(x * samplesPerPixel);
      let min = 0;
      let max = 0;
      const count = Math.floor(samplesPerPixel);
      for (let i = 0; i < count && idx + i < endSample; i++) {
        const s = data[idx + i];
        if (s < min) min = s;
        if (s > max) max = s;
      }
      ctx.moveTo(x, h / 2 + min * amp);
      ctx.lineTo(x, h / 2 + max * amp);
    }
    ctx.stroke();

    const effLoopEnd = previewLoopEndRef.current !== null ? previewLoopEndRef.current : loopEnd;
    if (loopStart !== null && effLoopEnd !== null && effLoopEnd - loopStart > 0.005) {
      const aSample = loopStart * totalSamples;
      const bSample = effLoopEnd * totalSamples;
      const ax = ((aSample - startSample) / (endSample - startSample)) * w;
      const bx = ((bSample - startSample) / (endSample - startSample)) * w;
      const fillL = Math.max(0, Math.min(w, ax));
      const fillR = Math.max(0, Math.min(w, bx));
      if (fillR > fillL) {
        ctx.fillStyle = "rgba(255, 0, 64, 0.14)";
        ctx.fillRect(fillL, 0, fillR - fillL, h);
      }
      ctx.strokeStyle = "#FF0040";
      ctx.lineWidth = 1.5;
      if (ax >= -2 && ax <= w + 2) {
        ctx.beginPath();
        ctx.moveTo(ax, 0);
        ctx.lineTo(ax, h);
        ctx.stroke();
      }
      if (bx >= -2 && bx <= w + 2) {
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, h);
        ctx.stroke();
      }
      ctx.font = "8px monospace";
      if (ax >= 2 && ax <= w - 4) {
        ctx.fillStyle = "#FF0040";
        ctx.fillText("A", ax + 3, 8);
      }
      if (bx >= 2 && bx <= w - 4) {
        ctx.fillStyle = "#FF0040";
        ctx.fillText("B", bx + 3, 8);
      }
    }

    const duration = buffer.duration;
    const startTime = (startSample / totalSamples) * duration;
    const endTime = (endSample / totalSamples) * duration;
    const timeSpan = endTime - startTime;
    const step = timeSpan > 10 ? 5 : timeSpan > 5 ? 2 : timeSpan > 2 ? 1 : 0.5;
    ctx.fillStyle = "#555";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    for (let t = Math.ceil(startTime / step) * step; t < endTime; t += step) {
      const px = ((t - startTime) / timeSpan) * w;
      ctx.fillText(`${t.toFixed(1)}s`, px, h - 2);
    }

    if (hoverX !== null && !dragging.current) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const playheadSample = playheadPos * totalSamples;
    const px = ((playheadSample - startSample) / (endSample - startSample)) * w;

    if (isPlaying) {
      const time = performance.now() * 0.003;
      const glowW = 6 + Math.sin(time) * 3;
      ctx.strokeStyle = "#FF0040";
      ctx.lineWidth = glowW;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = isPlaying ? "#FF0040" : "#ffffff";
    ctx.lineWidth = isPlaying ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
  }, [buffer, playheadPos, zoom, hoverX, isPlaying, height, loopStart, loopEnd]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    if (!wrapperRef.current || !buffer) return;
    const autoScroll = playheadPos > 0 && playheadPos < 1;
    if (!autoScroll) return;
    const totalSamples = buffer.length;
    const visibleSamples = Math.floor(totalSamples / zoom);
    const scrollableWidth = wrapperRef.current.scrollWidth - wrapperRef.current.clientWidth;
    const targetScroll = (playheadPos - (visibleSamples / totalSamples) / 2) * scrollableWidth;
    wrapperRef.current.scrollLeft = Math.max(0, Math.min(scrollableWidth, targetScroll));
  }, [playheadPos, zoom, buffer]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    setZoom((z) => Math.max(1, Math.min(10, z + delta)));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLDivElement;
    el.setPointerCapture(e.pointerId);
    downXRef.current = e.clientX;
    movedRef.current = false;
    pendingHoverRef.current = e.clientX - el.getBoundingClientRect().left;
    if (e.button === 2) {
      rightDragging.current = true;
      previewLoopEndRef.current = getSeekFromClientX(e.clientX);
    } else if (e.button === 0) {
      dragging.current = true;
      pendingSeekRef.current = getSeekFromClientX(e.clientX);
    }
    schedule();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLDivElement;
    pendingHoverRef.current = e.clientX - el.getBoundingClientRect().left;
    if ((dragging.current || rightDragging.current) && downXRef.current !== null && Math.abs(e.clientX - downXRef.current) > 4) {
      movedRef.current = true;
    }
    if (dragging.current) {
      pendingSeekRef.current = getSeekFromClientX(e.clientX);
    }
    if (rightDragging.current) {
      previewLoopEndRef.current = getSeekFromClientX(e.clientX);
    }
    schedule();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragging.current && !movedRef.current) {
      onSetLoopStartRef.current?.(getSeekFromClientX(e.clientX));
    } else if (rightDragging.current) {
      if (movedRef.current) {
        onSetLoopEndRef.current?.(getSeekFromClientX(e.clientX));
      } else {
        onClearLoopRef.current?.();
      }
    }
    dragging.current = false;
    rightDragging.current = false;
    movedRef.current = false;
    downXRef.current = null;
    previewLoopEndRef.current = null;
  };

  const handlePointerLeave = () => {
    setHoverX(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const parentWidth = wrapper.clientWidth;
    const totalWidth = Math.max(parentWidth, Math.round(parentWidth * zoom));
    canvas.width = totalWidth;
    canvas.style.width = `${totalWidth}px`;
    canvas.height = height;
    canvas.style.height = `${height}px`;
    draw();
  }, [zoom, height, draw]);

  useEffect(() => {
    handleResize();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(handleResize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [handleResize]);

  return (
    <div
      ref={wrapperRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={handleContextMenu}
      title="Left click: loop start. Right-click drag: loop end. Drag to seek. Scroll to zoom. Arrow keys: move loop markers (Shift for B)."
      className="w-full border border-neutral-800 bg-black/20 relative overflow-auto scrollbar-thin touch-none"
      style={{ scrollbarWidth: "thin", scrollbarColor: "#333 #000", cursor: "pointer" }}
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{ minWidth: "100%", height: `${height}px` }}
      />
    </div>
  );
}

export default WaveformView;