import { useEffect, useRef } from "react";

export interface KeyboardHandlers {
  onTogglePlay: () => void;
  selectPreset: (index: number) => void; // 1-based index into the sample list
  onRecord: () => void;
  onToggleGlitch: () => void;
  onToggleLoop: () => void;
  onClearLoop: () => void;
  onToggleBypass: () => void;
  onToggleCompressor: () => void;
  onToggleEq: () => void;
  onExport: () => void;
  onToggleShortcuts: () => void;
}

export function useKeyboard(handlers: KeyboardHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const h = ref.current;

      if (e.code === "Space") { e.preventDefault(); h.onTogglePlay(); }
      if (e.code.startsWith("Digit") || e.code.startsWith("Numpad")) {
        const num = parseInt(e.code.replace(/\D/g, ""));
        if (num >= 1) h.selectPreset(num);
      }
      if (e.code === "KeyR") h.onRecord();
      if (e.code === "KeyG") h.onToggleGlitch();
      if (e.code === "KeyL") h.onToggleLoop();
      if (e.code === "Escape") h.onClearLoop();
      if (e.code === "KeyB") h.onToggleBypass();
      if (e.code === "KeyC") h.onToggleCompressor();
      if (e.code === "KeyE" && e.shiftKey) h.onToggleEq();
      if (e.code === "KeyE" && !e.shiftKey) h.onExport();
      if (e.code === "Slash") { e.preventDefault(); h.onToggleShortcuts(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}