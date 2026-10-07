"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createInvoiceFromQuote } from "@/lib/createInvoice";
import { askDocumentNumber } from "@/lib/documentNumber";
import { Quote, CompanySettings } from "@/types";

/**
 * Facturar sin abrir el detalle. Para quien lleva la empresa solo,
 * cada paso que se ahorra cuenta.
 *
 * Recibe solo el id y el numero: el listado ya no trae los conceptos de cada
 * documento (seria mucho peso al crecer). El documento completo se carga
 * unicamente al hacer clic.
 */
export default function QuickInvoiceButton({
  quoteId,
  quoteNumber,
  company,
  full,
}: {
  quoteId: string;
  quoteNumber: string;
  company: CompanySettings | null;
  full?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    setError(null);
    const invoiceNumber = await askDocumentNumber(
      supabase,
      "invoice",
      `Factura para la cotización ${quoteNumber}`
    );
    if (!invoiceNumber) return;
    setBusy(true);

    const { data: quote, error: loadError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .maybeSingle();

    if (loadError || !quote) {
      setError("No se pudo cargar la cotización.");
      setBusy(false);
      return;
    }

    const result = await createInvoiceFromQuote(supabase, quote as Quote, company, invoiceNumber);

    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      if (result.duplicate) router.refresh();
      return;
    }

    router.push(`/invoices/${result.id}`);
    router.refresh();
  }

  return (
    <div className={full ? "w-full" : ""}>
      <button
        onClick={handleClick}
        disabled={busy}
        className={`btn-secondary text-xs py-1.5 ${full ? "w-full" : ""}`}
        aria-label={`Generar factura para ${quoteNumber}`}
      >
        {busy ? "Facturando…" : "Facturar"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-brick mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
