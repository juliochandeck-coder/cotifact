"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DocumentTemplate from "@/components/DocumentTemplate";
import StatusControl from "@/components/StatusControl";
import SendButton from "@/components/SendButton";
import { QuoteStatusBadge } from "@/components/StatusBadge";
import { usePrintDocument } from "@/lib/usePrintDocument";
import { createInvoiceFromQuote } from "@/lib/createInvoice";
import { formatDate, num } from "@/lib/format";
import {
  Quote,
  Invoice,
  QuoteStatus,
  QUOTE_STATUS_LABEL,
  QUOTE_STATUSES,
  CompanySettings,
} from "@/types";

const STAMP_MAP: Record<QuoteStatus, { text: string; colorClass: string } | null> = {
  pendiente: null,
  aprobada: { text: "Aprobada", colorClass: "text-forest" },
  rechazada: { text: "No aprobada", colorClass: "text-brick" },
  recotizar: { text: "Re-cotizar", colorClass: "text-brass" },
};

export default function QuoteDetailClient({
  quote,
  existingInvoice,
  company,
}: {
  quote: Quote;
  existingInvoice: Invoice | null;
  company: CompanySettings | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const print = usePrintDocument(quote.quote_number);

  const [status, setStatus] = useState<QuoteStatus>(quote.status);
  const [busy, setBusy] = useState<null | "invoice" | "approve" | "duplicate" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const locale = company?.locale ?? "es-MX";

  async function handleGenerateInvoice() {
    if (busy) return;
    setBusy("invoice");
    setError(null);

    const result = await createInvoiceFromQuote(supabase, quote, company);

    if (!result.ok) {
      setError(result.message);
      setBusy(null);
      if (result.duplicate) router.refresh();
      return;
    }

    router.push(`/invoices/${result.id}`);
    router.refresh();
  }

  /** Aprobar y facturar de una vez: antes eran tres pasos separados. */
  async function handleApproveAndInvoice() {
    if (busy) return;
    setBusy("approve");
    setError(null);

    const { error: statusError } = await supabase
      .from("quotes")
      .update({ status: "aprobada" })
      .eq("id", quote.id);

    if (statusError) {
      setError("No se pudo aprobar la cotización. " + statusError.message);
      setBusy(null);
      return;
    }

    setStatus("aprobada");

    const result = await createInvoiceFromQuote(supabase, { ...quote, status: "aprobada" }, company);

    if (!result.ok) {
      // La aprobacion si quedo guardada; solo fallo la factura.
      setError(result.message);
      setBusy(null);
      router.refresh();
      return;
    }

    router.push(`/invoices/${result.id}`);
    router.refresh();
  }

  async function handleDuplicate() {
    if (busy) return;
    setBusy("duplicate");
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Tu sesión expiró.");
      setBusy(null);
      return;
    }

    const { data: quoteNumber, error: numberError } = await supabase.rpc(
      "next_document_number",
      { p_prefix: "COT" }
    );

    if (numberError || !quoteNumber) {
      setError("No se pudo asignar el número. " + (numberError?.message ?? ""));
      setBusy(null);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("quotes")
      .insert({
        user_id: user.id,
        quote_number: quoteNumber,
        client_name: quote.client_name,
        client_company: quote.client_company,
        client_email: quote.client_email,
        client_phone: quote.client_phone,
        items: quote.items,
        subtotal: quote.subtotal,
        tax_rate: quote.tax_rate,
        tax_amount: quote.tax_amount,
        total: quote.total,
        notes: quote.notes,
        valid_until: quote.valid_until,
        status: "pendiente",
      })
      .select("id")
      .single();

    if (insertError || !data) {
      setError("No se pudo duplicar. " + (insertError?.message ?? ""));
      setBusy(null);
      return;
    }

    router.push(`/quotes/${data.id}/edit`);
    router.refresh();
  }

  async function handleDelete() {
    if (busy) return;
    setBusy("delete");
    setError(null);

    const { error: deleteError } = await supabase.from("quotes").delete().eq("id", quote.id);

    if (deleteError) {
      setError("No se pudo eliminar. " + deleteError.message);
      setBusy(null);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <div className="no-print mb-6">
        <Link href="/dashboard" className="text-sm text-slate hover:text-ink">
          ← Cotizaciones
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
          <h1 className="font-display text-2xl font-bold text-ink">{quote.quote_number}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/quotes/${quote.id}/edit`} className="btn-secondary">
              Editar
            </Link>
            <button onClick={handleDuplicate} disabled={busy !== null} className="btn-secondary">
              {busy === "duplicate" ? "Duplicando…" : "Duplicar"}
            </button>
            <SendButton
              kind="quote"
              id={quote.id}
              clientEmail={quote.client_email}
              sentAt={quote.sent_at}
              locale={locale}
            />
            <button onClick={print} className="btn-primary">
              Descargar PDF
            </button>
          </div>
        </div>
      </div>

      <StatusControl<QuoteStatus>
        table="quotes"
        id={quote.id}
        value={quote.status}
        options={QUOTE_STATUSES}
        labels={QUOTE_STATUS_LABEL}
        onChanged={setStatus}
        renderBadge={(s) => <QuoteStatusBadge status={s} />}
      />

      {status === "recotizar" && (
        <div className="no-print card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">El cliente pidió re-cotizar</p>
            <p className="text-xs text-slate">
              Edita esta cotización, o duplícala para conservar la versión original.
            </p>
          </div>
          <Link href={`/quotes/${quote.id}/edit`} className="btn-primary">
            Ajustar precios
          </Link>
        </div>
      )}

      {/* Siempre visible: si aún no se puede facturar, dice por qué. */}
      <div className="no-print card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">
            {existingInvoice
              ? "Factura generada"
              : status === "aprobada"
                ? "Cotización aprobada"
                : status === "rechazada"
                  ? "Cotización no aprobada"
                  : "Todavía no se puede facturar"}
          </p>
          <p className="text-xs text-slate">
            {existingInvoice
              ? `Esta cotización ya se facturó como ${existingInvoice.invoice_number}.`
              : status === "aprobada"
                ? "Genera la factura con estos mismos datos."
                : status === "rechazada"
                  ? "No se factura trabajo que el cliente rechazó."
                  : "Aprueba la cotización para generar la factura."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!existingInvoice && status !== "aprobada" && status !== "rechazada" && (
            <button
              onClick={handleApproveAndInvoice}
              disabled={busy !== null}
              className="btn-secondary"
            >
              {busy === "approve" ? "Procesando…" : "Aprobar y facturar"}
            </button>
          )}

          {existingInvoice ? (
            <Link href={`/invoices/${existingInvoice.id}`} className="btn-primary">
              Ver {existingInvoice.invoice_number}
            </Link>
          ) : (
            <button
              onClick={handleGenerateInvoice}
              disabled={busy !== null || status !== "aprobada"}
              className="btn-primary"
            >
              {busy === "invoice" ? "Generando…" : "Generar factura"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="no-print text-sm text-brick mb-4">
          {error}
        </p>
      )}

      <DocumentTemplate
        docLabel="COTIZACIÓN"
        number={quote.quote_number}
        date={formatDate(quote.created_at, locale) ?? ""}
        secondaryDateLabel="Válida hasta"
        secondaryDate={formatDate(quote.valid_until, locale)}
        clientName={quote.client_name}
        clientCompany={quote.client_company}
        clientEmail={quote.client_email}
        clientPhone={quote.client_phone}
        items={quote.items}
        subtotal={num(quote.subtotal)}
        taxRate={num(quote.tax_rate)}
        taxAmount={num(quote.tax_amount)}
        total={num(quote.total)}
        notes={quote.notes}
        stamp={STAMP_MAP[status]}
        company={company}
      />

      <div className="no-print mt-8 pt-6 border-t border-line">
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink">
              ¿Eliminar {quote.quote_number}? Esta acción no se puede deshacer.
            </p>
            <button onClick={handleDelete} disabled={busy !== null} className="btn-danger text-xs py-1.5">
              {busy === "delete" ? "Eliminando…" : "Sí, eliminar"}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="btn-ghost text-xs py-1.5">
              Cancelar
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="btn-ghost text-xs text-slate hover:text-brick">
            Eliminar cotización
          </button>
        )}
      </div>
    </div>
  );
}
