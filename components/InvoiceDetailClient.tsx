"use client";

import { useState } from "react";
import Link from "next/link";
import DocumentTemplate from "@/components/DocumentTemplate";
import StatusControl from "@/components/StatusControl";
import SendButton from "@/components/SendButton";
import { InvoiceStatusBadge } from "@/components/StatusBadge";
import { usePrintDocument } from "@/lib/usePrintDocument";
import { formatDate, formatMoney, num } from "@/lib/format";
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
}: {
  invoice: Invoice;
  company: CompanySettings | null;
}) {
  const print = usePrintDocument(invoice.invoice_number);
  const [status, setStatus] = useState<InvoiceStatus>(invoice.status);

  const locale = company?.locale ?? "es-MX";
  const currency = company?.currency ?? "MXN";

  const dueDate = invoice.due_date ? new Date(invoice.due_date + "T00:00:00") : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLate = dueDate
    ? Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000)
    : 0;
  const isOverdue = status !== "pagada" && dueDate !== null && daysLate > 0;

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

      <StatusControl<InvoiceStatus>
        table="invoices"
        id={invoice.id}
        value={invoice.status}
        options={INVOICE_STATUSES}
        labels={INVOICE_STATUS_LABEL}
        onChanged={setStatus}
        renderBadge={(s) => <InvoiceStatusBadge status={s} />}
      />

      <DocumentTemplate
        docLabel="FACTURA"
        number={invoice.invoice_number}
        date={formatDate(invoice.created_at, locale) ?? ""}
        secondaryDateLabel="Vence"
        secondaryDate={formatDate(invoice.due_date, locale)}
        clientName={invoice.client_name}
        clientCompany={invoice.client_company}
        clientEmail={invoice.client_email}
        clientPhone={invoice.client_phone}
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
    </div>
  );
}
