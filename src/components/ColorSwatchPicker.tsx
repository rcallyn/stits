"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { COLOR_PALETTE, colorByKey } from "@/lib/itemColor";

type Props = {
  value: string;
  onChange: (colorKey: string) => void;
};

export default function ColorSwatchPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = colorByKey(value);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Change color"
        title="Change color"
        className={`h-4 w-4 shrink-0 rounded-sm ${current.dot}`}
      />
      {open && (
        <Modal title="Choose a color" onClose={() => setOpen(false)}>
          <div className="grid grid-cols-6 gap-3">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  onChange(c.key);
                  setOpen(false);
                }}
                aria-label={c.key}
                title={c.key}
                className={`h-8 w-8 rounded-md ${c.dot} ${
                  c.key === value ? "ring-2 ring-offset-2 ring-foreground ring-offset-background" : ""
                }`}
              />
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
