import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function PanelSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-t border-neutral-800 pt-3 space-y-3">
      <button
        onClick={() => setOpen(!open)}
        title={`${open ? "Collapse" : "Expand"} ${title}`}
        className="text-[10px] font-bold tracking-wider text-neutral-400 flex items-center gap-1 hover:text-white transition-colors"
      >
        {icon} {title}
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && children}
    </div>
  );
}