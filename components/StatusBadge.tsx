import { QuoteStatus, InvoiceStatus, QUOTE_STATUS_LABEL, INVOICE_STATUS_LABEL } from "@/types";

// Fondo + texto validados contra WCAG AA, mas un icono: el color nunca es
// el unico medio para distinguir el estado (accesibilidad para daltonismo).
const QUOTE_STYLE: Record<QuoteStatus, { cls: string; icon: string }> = {
  pendiente: { cls: "bg-slate/10 text-slate", icon: "●" },
  aprobada: { cls: "bg-successBg text-successText", icon: "✓" },
  rechazada: { cls: "bg-dangerBg text-dangerText", icon: "✕" },
  recotizar: { cls: "bg-warningBg text-warningText", icon: "↻" },
};

const INVOICE_STYLE: Record<InvoiceStatus, { cls: string; icon: string }> = {
  pendiente: { cls: "bg-slate/10 text-slate", icon: "●" },
  enviada: { cls: "bg-warningBg text-warningText", icon: "→" },
  pagada: { cls: "bg-successBg text-successText", icon: "✓" },
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const s = QUOTE_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      <span aria-hidden="true">{s.icon}</span>
      {QUOTE_STATUS_LABEL[status]}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const s = INVOICE_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      <span aria-hidden="true">{s.icon}</span>
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}
