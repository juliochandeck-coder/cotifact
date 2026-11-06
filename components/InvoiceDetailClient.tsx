"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DocumentTemplate from "@/components/DocumentTemplate";
import StatusControl from "@/components/StatusControl";
import SendButton from "@/components/SendButton";
import { InvoiceStatusBadge } from "@/components/StatusBadge";
import { usePrintDocument } from "@/lib/usePrintDocument";
import { askDocumentNumber } from "@/lib/documentNumber";
import { formatDate, formatDateDMY, formatMoney, num, documentFilename } from "@/lib/format";
import {
  Invoice,
  InvoiceStatus,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUSES,
  CompanySettings,
} from "@/types";

export default function InvoiceDetailClient({
  invoice,
  company,
  linkedQuoteNumber,
  clientTaxId = null,
  clientAddress = null,
}: {
  invoice: Invoice;
  company: CompanySettings | null;
  linkedQuoteNumber: string | null;
  clientTaxId?: string | null;
  clientAddress?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const print = usePrintDocument(
    documentFilename("invoice", {
      issuer: company?.company_name,
      client: invoice.client_company || invoice.client_name,
      date: invoice.created_at,
    })
  );
  const [status, setStatus] = useState<InvoiceStatus>(invoice.status);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const locale = company?.locale ?? "es-PA";
  const currency = company?.currency ?? "USD";

  const dueDate = invoice.due_date ? new Date(invoice.due_date + "T00:00:00") : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLate = dueDate
    ? Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000)
    : 0;
  const isOverdue = status !== "pagada" && dueDate !== null && daysLate > 0;

  /**
   * Crea una factura nueva con los mismos datos (cliente, conceptos, proyecto,
   * forma de pago) y abre el formulario para ajustar los detalles. Pide el
   * número porque la numeración es manual. Queda pendiente, sin enviar ni pagar.
   */
  async function handleDuplicate() {
    if (duplicating) return;
    setDuplicateError(null);

    const invoiceNumber = await askDocumentNumber(
      supabase,
      "invoice",
      `Duplicar la factura ${invoice.invoice_number}`
    );
    if (!invoiceNumber) return;
    setDuplicating(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setDuplicateError("Tu sesión expiró. Vuelve a iniciar sesión.");
      setDuplicating(false);
      return;
    }

    const due = new Date();
    due.setDate(due.getDate() + (company?.payment_terms_days ?? 15));

    const { data, error } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        invoice_number: invoiceNumber,
        // Las facturas de retainer pueden repetirse para la misma cotización;
        // las demás no (una factura por cotización), así que la copia queda suelta.
        quote_id: invoice.is_retainer_invoice ? invoice.quote_id : null,
        is_retainer_invoice: invoice.is_retainer_invoice,
        client_id: invoice.client_id,
        client_name: invoice.client_name,
        client_company: invoice.client_company,
        client_email: invoice.client_email,
        client_phone: invoice.client_phone,
        project_name: invoice.project_name,
        project_description: invoice.project_description,
        items: invoice.items,
        subtotal: invoice.subtotal,
        tax_rate: invoice.tax_rate,
        tax_amount: invoice.tax_amount,
        total: invoice.total,
        notes: invoice.notes,
        payment_method: invoice.payment_method,
        requires_dgi: invoice.requires_dgi,
        due_date: due.toISOString().slice(0, 10),
        status: "pendiente",
      })
      .select("id")
      .single();

    if (error || !data) {
      setDuplicateError(
        error?.code === "23505"
          ? `Ya tienes otra factura con el número ${invoiceNumber}. Usa uno distinto.`
          : "No se pudo duplicar. " + (error?.message ?? "")
      );
      setDuplicating(false);
      return;
    }

    router.push(`/invoices/${data.id}/edit`);
    router.refresh();
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);

    const { error } = await supabase.from("invoices").delete().eq("id", invoice.id);

    if (error) {
      setDeleteError("No se pudo eliminar. " + error.message);
      setDeleting(false);
      return;
    }

    router.push("/invoices");
    router.refresh();
  }

  return (
    <div>
      <div className="no-print mb-6">
        <Link href="/invoices" className="text-sm text-slate hover:text-ink">
          ← Facturas
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
          <h1 className="font-title text-2xl font-bold text-ink">{invoice.invoice_number}</h1>
          <div className="flex items-center gap-2">
            {invoice.quote_id && (
              <Link href={`/quotes/${invoice.quote_id}`} className="btn-secondary">
                Ver cotización
              </Link>
            )}
            <Link href={`/invoices/${invoice.id}/edit`} className="btn-secondary">
              Editar
            </Link>
            <button onClick={handleDuplicate} disabled={duplicating} className="btn-secondary">
              {duplicating ? "Duplicando…" : "Duplicar"}
            </button>
            <SendButton
              kind="invoice"
              id={invoice.id}
              clientEmail={invoice.client_email}
              sentAt={invoice.sent_at}
              locale={locale}
            />
            <button onClick={print} className="btn-primary">
              Descargar PDF
            </button>
          </div>
        </div>
        {duplicateError && (
          <p role="alert" className="text-sm text-brick mt-2">
            {duplicateError}
          </p>
        )}
      </div>

      {isOverdue && (
        <div
          role="status"
          className="no-print card p-4 mb-6 border-brick/30 bg-brick/5"
        >
          <p className="text-sm font-medium text-brick">
            Vencida hace {daysLate} {daysLate === 1 ? "día" : "días"}
          </p>
          <p className="text-xs text-slate mt-0.5">
            {formatMoney(invoice.total, currency, locale)} pendientes de cobro desde el{" "}
            {formatDate(invoice.due_date, locale)}.
          </p>
        </div>
      )}

      {invoice.requires_dgi && (
        <div className="no-print card p-4 mb-6 border-warningBg bg-warningBg/40">
          <p className="text-sm font-medium text-warningText">Requiere factura fiscal (DGI)</p>
          {invoice.dgi_invoice_number ? (
            <p className="text-xs text-slate mt-0.5">
              Emitida como <span className="font-mono text-ink">{invoice.dgi_invoice_number}</span>
              {invoice.dgi_issued_at && ` el ${formatDate(invoice.dgi_issued_at, locale)}`}.
            </p>
          ) : (
            <p className="text-xs text-slate mt-0.5">
              Aún no se ha emitido en el facturador de la DGI —{" "}
              <Link href={`/invoices/${invoice.id}/edit`} className="underline hover:text-ink">
                anota el número aquí
              </Link>{" "}
              cuando la generes.
            </p>
          )}
        </div>
      )}

      <StatusControl<InvoiceStatus>
        table="invoices"
        id={invoice.id}
        value={invoice.status}
        options={INVOICE_STATUSES}
        labels={INVOICE_STATUS_LABEL}
        onChanged={setStatus}
        renderBadge={(s) => <InvoiceStatusBadge status={s} />}
      />

      {(!company?.company_address?.trim() ||
        !(invoice.payment_method?.trim() || company?.default_payment_method?.trim())) && (
        <div role="alert" className="no-print card p-4 mb-6 border-brick/30 bg-brick/5">
          <p className="text-sm font-medium text-brick">A esta factura le faltan datos obligatorios</p>
          <ul className="text-xs text-slate mt-1 list-disc pl-4 space-y-0.5">
            {!company?.company_address?.trim() && <li>Tu dirección (sale al pie del documento).</li>}
            {!(invoice.payment_method?.trim() || company?.default_payment_method?.trim()) && (
              <li>La forma de pago.</li>
            )}
          </ul>
          <Link href="/settings" className="btn-primary text-xs py-1.5 mt-3 inline-flex">
            Completar en Ajustes
          </Link>
        </div>
      )}

      <DocumentTemplate
        docLabel="FACTURA"
        number={invoice.invoice_number}
        date={formatDateDMY(invoice.created_at)}
        secondaryDateLabel="Vence"
        secondaryDate={formatDate(invoice.due_date, locale)}
        clientName={invoice.client_name}
        clientCompany={invoice.client_company}
        clientEmail={invoice.client_email}
        clientPhone={invoice.client_phone}
        clientTaxId={clientTaxId}
        clientAddress={clientAddress}
        items={invoice.items}
        subtotal={num(invoice.subtotal)}
        taxRate={num(invoice.tax_rate)}
        taxAmount={num(invoice.tax_amount)}
        total={num(invoice.total)}
        notes={invoice.notes}
        projectName={invoice.project_name}
        projectDescription={invoice.project_description}
        paymentMethod={invoice.payment_method}
        statusTag={status !== "pendiente" ? <InvoiceStatusBadge status={status} /> : null}
        company={company}
      />

      <div className="no-print mt-8 pt-6 border-t border-line">
        {confirmDelete ? (
          <div className="card p-4 border-brick/30 bg-brick/5 space-y-3">
            <div>
              <p className="text-sm font-medium text-ink">
                ¿Eliminar {invoice.invoice_number}? Esta acción no se puede deshacer.
              </p>
              {linkedQuoteNumber ? (
                <p className="text-xs text-slate mt-1">
                  Esta factura está asociada a la cotización{" "}
                  <span className="font-mono text-ink">{linkedQuoteNumber}</span>. Al eliminarla,
                  esa cotización queda libre para generar una factura nueva cuando quieras —
                  su estado de aprobada no cambia, solo deja de tener esta factura enlazada.
                </p>
              ) : (
                <p className="text-xs text-slate mt-1">
                  Esta factura no está asociada a ninguna cotización activa.
                </p>
              )}
              {deleteError && (
                <p role="alert" className="text-xs text-brick mt-2">
                  {deleteError}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger text-xs py-1.5"
              >
                {deleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="btn-ghost text-xs py-1.5"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="btn-ghost text-xs text-slate hover:text-brick"
          >
            Eliminar factura
          </button>
        )}
      </div>
    </div>
  );
}
