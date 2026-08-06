"use client";

import { useState } from "react";

export default function CopyButton({
  text,
  label = "Copiar mensaje",
  className = "btn-secondary text-xs py-1.5",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Safari antiguo y contextos sin permiso: respaldo con textarea temporal
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        setFailed(true);
        return;
      }
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }

  return (
    <button onClick={copy} className={className} aria-live="polite">
      {failed ? "No se pudo copiar" : done ? "¡Copiado!" : label}
    </button>
  );
}
