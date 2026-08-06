"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props<T extends string> = {
  table: "quotes" | "invoices";
  id: string;
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChanged?: (next: T) => void;
  renderBadge: (status: T) => React.ReactNode;
};

export default function StatusControl<T extends string>({
  table,
  id,
  value,
  options,
  labels,
  onChanged,
  renderBadge,
}: Props<T>) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<T>(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleChange(next: T) {
    if (next === status) return;

    const previous = status;
    setStatus(next); // optimista: la UI responde de inmediato
    setError(null);
    onChanged?.(next);

    const { error } = await supabase.from(table).update({ status: next }).eq("id", id);

    if (error) {
      setStatus(previous); // revierte si el servidor rechaza
      onChanged?.(previous);
      setError("No se pudo cambiar el estado. Revisa tu conexión.");
      return;
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className="no-print card p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate">Estado</span>
          {renderBadge(status)}
          {pending && <span className="text-xs text-slate">Guardando…</span>}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Cambiar estado</span>
          <select
            className="field-input w-auto py-1.5 pr-8 cursor-pointer"
            value={status}
            onChange={(e) => handleChange(e.target.value as T)}
          >
            {options.map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-brick mt-3">
          {error}
        </p>
      )}
    </div>
  );
}
