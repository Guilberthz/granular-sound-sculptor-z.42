import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function Module({
  label,
  icon,
  description,
  enabled,
  onToggle,
  miniKnob,
  defaultOpen,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
  miniKnob?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? enabled);
  return (
    <div className="border-t border-neutral-800 pt-2">
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggle}
          title={`${enabled ? "Disable" : "Enable"} ${label}`}
          className={`futuristic-button compact-button flex-shrink-0 w-7 h-7 text-[8px] font-bold border transition-all ${
            enabled ? "bg-[#FF0040] text-white border-[#FF0040] shadow-[0_0_10px_rgba(255,0,64,0.25)] hover:bg-[#cc0033]" : "bg-black/30 text-neutral-500 border-neutral-800 hover:bg-black/50 hover:text-neutral-300 hover:border-neutral-700"
          }`}
        >
          {enabled ? "ON" : "OFF"}
        </button>
        <button
          onClick={() => setOpen(!open)}
          title={`${open ? "Collapse" : "Expand"} ${label} section`}
          className="flex items-center gap-1 flex-1 min-w-0 text-left text-[10px] font-bold text-neutral-300 hover:text-white transition-colors active:scale-95"
        >
          {icon}
          <span className="truncate">{label}</span>
          <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        </button>
        {miniKnob && <div className="flex-shrink-0 w-8">{miniKnob}</div>}
      </div>
      {description && <p className="mt-0.5 mb-2 text-[9px] leading-relaxed text-neutral-600">{description}</p>}
      {open && <div className={enabled ? "" : "opacity-40 pointer-events-none"}>{children}</div>}
    </div>
  );
}