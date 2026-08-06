import { QuoteStatus, InvoiceStatus, QUOTE_STATUS_LABEL, INVOICE_STATUS_LABEL } from "@/types";

const QUOTE_COLORS: Record<QuoteStatus, string> = {
  pendiente: "bg-slate/10 text-slate",
  aprobada: "bg-forest/10 text-forest",
  rechazada: "bg-brick/10 text-brick",
  recotizar: "bg-brass/10 text-brass",
};

const INVOICE_COLORS: Record<InvoiceStatus, string> = {
  pendiente: "bg-slate/10 text-slate",
  enviada: "bg-brass/10 text-brass",
  pagada: "bg-forest/10 text-forest",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${QUOTE_COLORS[status]}`}>
      {QUOTE_STATUS_LABEL[status]}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${INVOICE_COLORS[status]}`}>
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}
