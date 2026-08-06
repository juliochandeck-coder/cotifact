"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { CompanySettings } from "@/types";

/**
 * Trabajo aprobado sin facturar es dinero que se queda sin cobrar por olvido.
 * Recibe cifras ya calculadas en Postgres (no la lista completa de documentos)
 * y factura todo en una sola llamada, no una por cotizacion.
 */
export default function UnbilledAlert({
  count,
  amount,
  company,
}: {
  count: number;
  amount: number;
  company: CompanySettings | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (count === 0) return null;

  const currency = company?.currency ?? "USD";
  const locale = company?.locale ?? "es-PA";
  const many = count > 1;

  async function handleBillAll() {
    if (busy) return;
    setBusy(true);
    setError(null);

    // Una sola llamada: la base de datos crea todas las facturas en una
    // transaccion. Antes eran N viajes de red, uno por cotizacion.
    const { data, error: rpcError } = await supabase.rpc("bill_all_approved");

    if (rpcError) {
      setError("No se pudieron generar las facturas. " + rpcError.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    if ((data ?? 0) > 0) router.push("/invoices");
    router.refresh();
  }

  return (
    <div className="no-print rounded-sm border border-brass/40 bg-brass/5 p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display font-bold text-sm text-brass">
            Tienes {count} {many ? "cotizaciones aprobadas" : "cotización aprobada"} sin facturar
          </p>
          <p className="text-xs text-slate mt-0.5">
            {formatMoney(amount, currency, locale)} de trabajo aprobado que aún no has cobrado.
          </p>
        </div>
        <button onClick={handleBillAll} disabled={busy} className="btn-primary text-xs py-1.5">
          {busy ? "Facturando…" : many ? `Facturar las ${count}` : "Facturar ahora"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-brick mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
