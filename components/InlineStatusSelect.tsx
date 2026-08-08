"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * El badge de estado en una fila de lista, pero clicable: al tocarlo se
 * convierte en un selector para actualizar el estado sin abrir el detalle.
 * Misma logica optimista que StatusControl, en un formato compacto.
 */
export default function InlineStatusSelect<T extends string>({
  table,
  id,
  value,
  options,
  labels,
  renderBadge,
}: {
  table: "quotes" | "invoices";
  id: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  renderBadge: (status: T) => React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<T>(value);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleChange(next: T) {
    setOpen(false);
    if (next === status || busy) return;

    const previous = status;
    setStatus(next);
    setBusy(true);

    const { error } = await supabase.from(table).update({ status: next }).eq("id", id);

    setBusy(false);
    if (error) {
      setStatus(previous);
      return;
    }
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="cursor-pointer"
        aria-label="Cambiar estado"
        disabled={busy}
      >
        {renderBadge(status)}
      </button>
    );
  }

  return (
    <select
      autoFocus
      className="field-input w-auto py-1 pr-7 text-xs cursor-pointer"
      value={status}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => handleChange(e.target.value as T)}
      onBlur={() => setOpen(false)}
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {labels[s]}
        </option>
      ))}
    </select>
  );
}
