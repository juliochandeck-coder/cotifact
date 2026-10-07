"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { CompanySettings, Quote } from "@/types";
import { createInvoiceFromQuote } from "@/lib/createInvoice";
import { askDocumentNumber } from "@/lib/documentNumber";

/**
 * Trabajo aprobado sin facturar es dinero que se queda sin cobrar por olvido.
 * Recibe cifras ya calculadas en Postgres (no la lista completa de documentos)
 * y factura una por una: como la numeracion es manual, se pide el numero de
 * cada factura. Cancelar detiene el proceso sin tocar las que faltan.
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

    const { data: idRows, error: idsError } = await supabase.rpc("unbilled_quote_ids");
    if (idsError) {
      setError("No se pudieron cargar las cotizaciones aprobadas. " + idsError.message);
      setBusy(false);
      return;
    }
    const ids = ((idRows ?? []) as unknown[]).map((r) =>
      typeof r === "string" ? r : (r as { unbilled_quote_ids: string }).unbilled_quote_ids
    );

    const { data: quotes } = await supabase
      .from("quotes")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: true });

    let created = 0;
    for (const quote of (quotes ?? []) as Quote[]) {
      const who = quote.client_company || quote.client_name;
      const invoiceNumber = await askDocumentNumber(
        supabase,
        "invoice",
        `Factura para la cotización ${quote.quote_number} (${who}) — ${created + 1} de ${quotes!.length}`
      );
      if (!invoiceNumber) break;

      const result = await createInvoiceFromQuote(supabase, quote, company, invoiceNumber);
      if (!result.ok) {
        setError(result.message);
        break;
      }
      created++;
    }

    setBusy(false);
    if (created > 0) router.push("/invoices");
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
