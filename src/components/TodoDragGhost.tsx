"use client";

import { useTodoDragState } from "@/hooks/useTodoDrag";

// Floating card that follows the pointer while a todo is being dragged onto
// the calendar (see useTodoDrag.ts). Mounted once at the app root so it
// renders above everything regardless of which page/component started the
// drag.
export default function TodoDragGhost() {
  const drag = useTodoDragState();
  if (!drag) return null;

  return (
    <div
      className="pointer-events-none fixed z-[70] max-w-[14rem] -translate-x-1/2 -translate-y-1/2 truncate rounded-lg bg-[#0071e3] px-3 py-1.5 text-xs font-medium text-white shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
      style={{ left: drag.x, top: drag.y }}
    >
      {drag.todo.title}
    </div>
  );
}
