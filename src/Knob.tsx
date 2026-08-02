import { useCallback, useRef, useState } from "react";

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  displayValue?: string;
  size?: number;
  defaultValue?: number;
  accent?: boolean;
}

export default function Knob({
  value,
  min,
  max,
  onChange,
  label,
  displayValue,
  size = 68,
  defaultValue,
  accent = false,
}: KnobProps) {
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);

  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const deg = -140 + pct * 280;
  const range = max - min;
  const mid = defaultValue ?? (min + max) / 2;
  const isAccentActive = accent && pct > 0.3;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      startY.current = e.clientY;
      startVal.current = value;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [value]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const deltaY = startY.current - e.clientY;
      const div = e.altKey ? 800 : 200;
      const newVal = Math.min(max, Math.max(min, startVal.current + (deltaY / div) * range));
      onChange(newVal);
    },
    [min, max, range, onChange]
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const step = e.altKey ? range * 0.002 : range * 0.02;
      const dir = e.deltaY > 0 ? -1 : 1;
      onChange(Math.min(max, Math.max(min, value + dir * step)));
    },
    [min, max, range, value, onChange]
  );

  const handleDoubleClick = useCallback(() => {
    onChange(mid);
  }, [mid, onChange]);

  const r = size / 2;
  const cx = size / 2;
  const cy = size / 2;
  const strokeW = 2;
  const arcR = r - strokeW - 2;
  const needleLen = arcR - 4;

  const needleX = cx + needleLen * Math.sin((deg * Math.PI) / 180);
  const needleY = cy - needleLen * Math.cos((deg * Math.PI) / 180);

  const accentColor = accent ? "#FF0040" : "#ffffff";
  const accentGlow = accent ? "rgba(255,0,64,0.5)" : "rgba(255,255,255,0.3)";
  const arcColor = hover && accent ? "#FF0040" : accent && pct > 0.3 ? "#FF0040" : accent ? "#FF0040" : "#ffffff";

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        tabIndex={0}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        className="knob-control relative cursor-grab active:cursor-grabbing select-none mx-auto"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="absolute inset-0">
          <defs>
            <filter id={`glow-${label}`}>
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx={cx}
            cy={cy}
            r={arcR}
            fill="none"
            stroke={hover ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}
            strokeWidth={strokeW}
          />
          <circle
            cx={cx}
            cy={cy}
            r={arcR}
            fill="none"
            stroke={accentColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${pct * 2 * Math.PI * arcR} ${2 * Math.PI * arcR}`}
            transform={`rotate(-130 ${cx} ${cy})`}
            style={{ opacity: hover ? 1 : 0.8, transition: "opacity 0.15s", filter: hover || focused ? `drop-shadow(0 0 4px ${accentGlow})` : "none" }}
          />
          {(hover || focused) && (
            <circle
              cx={cx}
              cy={cy}
              r={arcR + 4}
              fill="none"
              stroke={accentColor}
              strokeWidth={1}
              opacity={0.2}
              style={{ filter: `drop-shadow(0 0 6px ${accentGlow})` }}
            />
          )}
          <line
            x1={cx}
            y1={cy}
            x2={needleX}
            y2={needleY}
            stroke={accentColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            style={{ filter: hover ? `drop-shadow(0 0 4px ${accentGlow})` : "none", transition: "filter 0.15s" }}
          />
          <circle cx={cx} cy={cy} r={2.5} fill={accentColor} style={{ filter: hover ? `drop-shadow(0 0 4px ${accentGlow})` : "none", transition: "filter 0.15s" }} />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingTop: "22px" }}>
          <span className="text-[9px] font-mono font-bold" style={{ color: hover ? accentColor : "#ffffff", transition: "color 0.15s" }}>
            {displayValue ?? Math.round(pct * 100)}
          </span>
        </div>
      </div>

      <span className="text-[9px] tracking-widest text-neutral-500 uppercase text-center leading-tight">{label}</span>
    </div>
  );
}
