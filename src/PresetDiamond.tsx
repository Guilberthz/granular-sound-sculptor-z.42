import React, { useState } from "react";
import { PresetSample } from "./types";

function PresetDiamond({
  sample,
  active,
  onSelect,
  isCustom = false,
  onDelete,
  onRename,
}: {
  sample: PresetSample;
  active: boolean;
  onSelect: () => void;
  isCustom?: boolean;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
}) {
  const [spinning, setSpinning] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(sample.name);

  const handleClick = () => {
    setSpinning(true);
    onSelect();
    setTimeout(() => setSpinning(false), 600);
  };

  const commitRename = () => {
    if (onRename && renameValue.trim()) onRename(renameValue);
    setRenaming(false);
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-2 w-full">
        <input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="Preset name..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setRenameValue(sample.name);
              setRenaming(false);
            }
          }}
          onBlur={commitRename}
          className="flex-1 min-w-0 bg-black/40 border border-[#FF0040]/50 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-[#FF0040]"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 w-full group">
      <button
        onClick={handleClick}
        onDoubleClick={() => {
          if (isCustom) {
            setRenameValue(sample.name);
            setRenaming(true);
          }
        }}
        title={isCustom ? `${sample.name} — double-click to rename` : sample.name}
        className="flex items-center gap-3 w-full text-left group flex-1 min-w-0"
      >
        <div
          className={`w-[30px] h-[30px] flex-shrink-0 flex items-center justify-center transition-all duration-300 ${
            spinning ? "animate-diamond-spin" : ""
          } group-hover:scale-110 group-hover:shadow-[0_0_12px_rgba(255,0,64,0.4)] active:scale-95`}
          style={{
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
            background: active ? "#FF0040" : "transparent",
            border: active ? "none" : "1px solid #555",
            boxShadow: active ? "0 0 12px rgba(255,0,64,0.5)" : "none",
            transition: "background 0.3s, border 0.3s, box-shadow 0.3s, transform 0.15s",
          }}
        >
          <span
            className={`text-[10px] font-bold font-mono transition-colors duration-300 ${
              active ? "text-white" : "text-neutral-500 group-hover:text-white"
            }`}
          >
            {sample.name.charAt(0)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={`text-xs truncate transition-colors duration-300 ${
              active ? "text-[#FF0040] font-bold" : "text-neutral-400 group-hover:text-white"
            }`}
          >
            {sample.name}
          </div>
          <div className="text-[9px] text-neutral-600 font-mono truncate transition-colors duration-300 group-hover:text-neutral-400">
            {sample.code}
          </div>
        </div>
      </button>
      {isCustom && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete preset"
          className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-[#FF0040] text-sm px-1 py-1 transition-opacity active:scale-95"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default PresetDiamond;
