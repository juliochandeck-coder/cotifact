"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DocumentTemplate from "@/components/DocumentTemplate";
import StatusControl from "@/components/StatusControl";
import SendButton from "@/components/SendButton";
import { QuoteStatusBadge, InvoiceStatusBadge } from "@/components/StatusBadge";
import { usePrintDocument } from "@/lib/usePrintDocument";
import { createInvoiceFromQuote } from "@/lib/createInvoice";
import { askDocumentNumber } from "@/lib/documentNumber";
import { formatDate, formatDateDMY, formatMoney, num, documentFilename } from "@/lib/format";
import {
  Quote,
  Invoice,
  QuoteStatus,
  InvoiceStatus,
  QUOTE_STATUS_LABEL,
  QUOTE_STATUSES,
  CompanySettings,
} from "@/types";

type RetainerSibling = {
  id: string;
  quote_number: string;
  total: number;
  status: string;
  created_at: string;
};

export default function QuoteDetailClient({
  quote,
  invoices,
  retainerSiblings,
  company,
}: {
  quote: Quote;
  invoices: Invoice[];
  retainerSiblings: RetainerSibling[];
  company: CompanySettings | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const print = usePrintDocument(
    documentFilename("quote", {
      issuer: company?.company_name,
      client: quote.client_company || quote.client_name,
      date: quote.created_at,
    })
  );

  const [status, setStatus] = useState<QuoteStatus>(quote.status);
  const [busy, setBusy] = useState<null | "invoice" | "approve" | "duplicate" | "delete" | "fee">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const locale = company?.locale ?? "es-PA";
  const currency = company?.currency ?? "USD";

  // Una cotizacion normal solo puede tener una factura (la base de datos lo
  // impone); un retainer puede tener varias, una por mes.
  const existingInvoice = !quote.is_retainer ? (invoices[0] ?? null) : null;

  async function handleGenerateInvoice() {
    if (busy) return;
    setError(null);
    const invoiceNumber = await askDocumentNumber(
      supabase,
      "invoice",
      `Factura para la cotización ${quote.quote_number}`
    );
    if (!invoiceNumber) return;
    setBusy("invoice");

    const result = await createInvoiceFromQuote(supabase, quote, company, invoiceNumber);

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
    setError(null);
    // Se pide el número antes de aprobar: si cancela, no cambia nada.
    const invoiceNumber = await askDocumentNumber(
      supabase,
      "invoice",
      `Factura para la cotización ${quote.quote_number}`
    );
    if (!invoiceNumber) return;
    setBusy("approve");

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

    const result = await createInvoiceFromQuote(
      supabase,
      { ...quote, status: "aprobada" },
      company,
      invoiceNumber
    );

    if (!result.ok) {
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

    const quoteNumber = await askDocumentNumber(supabase, "quote", `Duplicar la cotización ${quote.quote_number}`);
    if (!quoteNumber) {
      setBusy(null);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("quotes")
      .insert({
        user_id: user.id,
        quote_number: quoteNumber,
        client_id: quote.client_id,
        client_name: quote.client_name,
        client_company: quote.client_company,
        client_email: quote.client_email,
        client_phone: quote.client_phone,
        project_name: quote.project_name,
        project_description: quote.project_description,
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
      setError(
        insertError?.code === "23505"
          ? `Ya tienes otra cotización con el número ${quoteNumber}. Usa uno distinto.`
          : "No se pudo duplicar. " + (insertError?.message ?? "")
      );
      setBusy(null);
      return;
    }

    router.push(`/quotes/${data.id}/edit`);
    router.refresh();
  }

  /**
   * Sube el fee de un retainer: crea una cotizacion nueva con los mismos
   * datos, enlazada al mismo grupo (para que se pueda ver el historial
   * completo de fees despues), y manda directo a editar el precio.
   */
  async function handleUpdateFee() {
    if (busy) return;
    setBusy("fee");
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Tu sesión expiró.");
      setBusy(null);
      return;
    }

    const quoteNumber = await askDocumentNumber(supabase, "quote", `Nueva cotización con el fee actualizado (antes ${quote.quote_number})`);
    if (!quoteNumber) {
      setBusy(null);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("quotes")
      .insert({
        user_id: user.id,
        quote_number: quoteNumber,
        client_id: quote.client_id,
        client_name: quote.client_name,
        client_company: quote.client_company,
        client_email: quote.client_email,
        client_phone: quote.client_phone,
        project_name: quote.project_name,
        project_description: quote.project_description,
        items: quote.items,
        subtotal: quote.subtotal,
        tax_rate: quote.tax_rate,
        tax_amount: quote.tax_amount,
        total: quote.total,
        notes: quote.notes,
        valid_until: quote.valid_until,
        status: "pendiente",
        is_retainer: true,
        retainer_group_id: quote.retainer_group_id ?? quote.id,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      setError(
        insertError?.code === "23505"
          ? `Ya tienes otra cotización con el número ${quoteNumber}. Usa uno distinto.`
          : "No se pudo crear la actualización de fee. " + (insertError?.message ?? "")
      );
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
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-title text-2xl font-bold text-ink">{quote.quote_number}</h1>
            {quote.is_retainer && (
              <span className="text-xs font-medium bg-ink/5 text-ink rounded-full px-2.5 py-0.5">
                Retainer
              </span>
            )}
          </div>
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

      {quote.is_retainer ? (
        <div className="no-print card p-4 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Retainer</p>
              <p className="text-xs text-slate">
                {status === "aprobada"
                  ? "Genera una factura cada mes desde esta cotización."
                  : "Apruébala para poder empezar a facturar este retainer."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleUpdateFee}
                disabled={busy !== null}
                className="btn-secondary text-xs py-1.5"
              >
                {busy === "fee" ? "Creando…" : "Actualizar fee"}
              </button>
              <button
                onClick={handleGenerateInvoice}
                disabled={busy !== null || status !== "aprobada"}
                className="btn-primary text-xs py-1.5"
              >
                {busy === "invoice" ? "Generando…" : "Generar factura"}
              </button>
            </div>
          </div>

          {invoices.length > 0 && (
            <div className="mt-4 pt-3 border-t border-line">
              <p className="field-label mb-2">Facturas de esta cotización</p>
              <ul className="space-y-1.5">
                {invoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between text-sm gap-3">
                    <Link href={`/invoices/${inv.id}`} className="font-mono text-ink hover:text-primary">
                      {inv.invoice_number}
                    </Link>
                    <span className="text-slate text-xs">{formatDate(inv.created_at, locale)}</span>
                    <span className="font-mono text-ink tabular-nums">
                      {formatMoney(inv.total, currency, locale)}
                    </span>
                    <InvoiceStatusBadge status={inv.status as InvoiceStatus} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {retainerSiblings.length > 0 && (
            <div className="mt-4 pt-3 border-t border-line">
              <p className="field-label mb-2">Historial de fee de este retainer</p>
              <ul className="space-y-1.5">
                {retainerSiblings.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm gap-3">
                    <Link href={`/quotes/${s.id}`} className="font-mono text-ink hover:text-primary">
                      {s.quote_number}
                    </Link>
                    <span className="text-slate text-xs">{formatDate(s.created_at, locale)}</span>
                    <span className="font-mono text-ink tabular-nums">
                      {formatMoney(s.total, currency, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        // Cotizacion normal: comportamiento de siempre, un solo botón segun el caso.
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
      )}

      {error && (
        <p role="alert" className="no-print text-sm text-brick mb-4">
          {error}
        </p>
      )}

      <DocumentTemplate
        docLabel="COTIZACIÓN"
        number={quote.quote_number}
        date={formatDateDMY(quote.created_at)}
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
        projectName={quote.project_name}
        projectDescription={quote.project_description}
        statusTag={status !== "pendiente" ? <QuoteStatusBadge status={status} /> : null}
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
