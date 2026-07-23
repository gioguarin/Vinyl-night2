"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="rounded-lg border border-line bg-surface2 px-3 py-1.5 font-mono text-xs text-ink hover:border-amber"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
