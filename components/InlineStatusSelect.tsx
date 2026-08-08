"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { QuoteStatusBadge, InvoiceStatusBadge } from "@/components/StatusBadge";
import { QuoteStatus, InvoiceStatus } from "@/types";

/**
 * El badge de estado en una fila de lista, pero clicable: al tocarlo se
 * convierte en un selector para actualizar el estado sin abrir el detalle.
 *
 * "kind" en vez de recibir una funcion para dibujar el badge: esto se usa
 * desde paginas que corren en el servidor (Server Components), y una
 * funcion de React no se puede pasar como prop a traves de esa frontera
 * hacia un componente de cliente — solo datos planos (texto, numeros,
 * objetos serializables). Por eso el badge se resuelve aqui adentro.
 */
export default function InlineStatusSelect({
  kind,
  table,
  id,
  value,
  options,
  labels,
}: {
  kind: "quote" | "invoice";
  table: "quotes" | "invoices";
  id: string;
  value: QuoteStatus | InvoiceStatus;
  options: readonly string[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState(value);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleChange(next: string) {
    setOpen(false);
    if (next === status || busy) return;

    const previous = status;
    setStatus(next as QuoteStatus | InvoiceStatus);
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
        {kind === "quote" ? (
          <QuoteStatusBadge status={status as QuoteStatus} />
        ) : (
          <InvoiceStatusBadge status={status as InvoiceStatus} />
        )}
      </button>
    );
  }

  return (
    <select
      autoFocus
      className="field-input w-auto py-1 pr-7 text-xs cursor-pointer"
      value={status}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => handleChange(e.target.value)}
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
