import { LineItem, CompanySettings } from "@/types";
import { formatMoney, formatDate, num, isValidHex } from "@/lib/format";

type Args = {
  kind: "quote" | "invoice";
  number: string;
  clientName: string;
  items: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  dateLabel: string;
  dateValue: string | null;
  company: CompanySettings | null;
  message?: string;
};

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

/**
 * Correo en HTML de tabla plana: es lo unico que renderiza igual en Gmail,
 * Outlook y Apple Mail. Nada de flex ni grid aqui.
 */
export function buildEmail(a: Args): { subject: string; html: string; text: string } {
  const c = a.company;
  const primary = c && isValidHex(c.brand_primary) ? c.brand_primary : "#14213D";
  const secondary = c && isValidHex(c.brand_secondary) ? c.brand_secondary : "#A87C3F";
  const currency = c?.currency ?? "MXN";
  const locale = c?.locale ?? "es-MX";
  const money = (v: unknown) => formatMoney(v, currency, locale);
  const co = c?.company_name || "";
  const isQuote = a.kind === "quote";
  const label = isQuote ? "Cotización" : "Factura";

  const subject = `${label} ${a.number}${co ? ` — ${co}` : ""}`;

  const rows = a.items
    .map(
      (it) => `<tr>
        <td style="padding:9px 4px;border-bottom:1px solid #E4E0D6;font-size:14px;color:#14213D;">${esc(it.description)}</td>
        <td align="right" style="padding:9px 4px;border-bottom:1px solid #E4E0D6;font-size:14px;color:#14213D;">${num(it.quantity)}</td>
        <td align="right" style="padding:9px 4px;border-bottom:1px solid #E4E0D6;font-size:14px;color:#14213D;white-space:nowrap;">${money(num(it.quantity) * num(it.unit_price))}</td>
      </tr>`
    )
    .join("");

  const intro =
    a.message?.trim() ||
    (isQuote
      ? `Hola ${a.clientName}, te comparto la cotización que preparamos. Cualquier duda, respóndeme por este medio.`
      : `Hola ${a.clientName}, adjunto el detalle de la factura ${a.number}. Gracias por tu confianza.`);

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#FAF9F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F5;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E4E0D6;border-radius:4px;overflow:hidden;">
    <tr><td style="height:6px;background:${primary};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:28px 28px 0;">
      ${co ? `<p style="margin:0 0 2px;font-size:16px;font-weight:700;color:#14213D;">${esc(co)}</p>` : ""}
      ${c?.company_email ? `<p style="margin:0;font-size:12px;color:#5C6470;">${esc(c.company_email)}</p>` : ""}
    </td></tr>
    <tr><td style="padding:20px 28px 0;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5C6470;">${label}</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:${primary};font-family:'Courier New',monospace;">${esc(a.number)}</p>
      ${a.dateValue ? `<p style="margin:6px 0 0;font-size:13px;color:#5C6470;">${esc(a.dateLabel)}: ${esc(formatDate(a.dateValue, locale) ?? "")}</p>` : ""}
    </td></tr>
    <tr><td style="padding:20px 28px 0;">
      <p style="margin:0;font-size:14px;line-height:1.6;color:#14213D;">${esc(intro)}</p>
    </td></tr>
    <tr><td style="padding:22px 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <th align="left" style="padding:6px 4px;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#5C6470;border-bottom:2px solid ${primary};">Concepto</th>
          <th align="right" style="padding:6px 4px;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#5C6470;border-bottom:2px solid ${primary};">Cant.</th>
          <th align="right" style="padding:6px 4px;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#5C6470;border-bottom:2px solid ${primary};">Importe</th>
        </tr>
        ${rows}
      </table>
    </td></tr>
    <tr><td style="padding:16px 28px 0;">
      <table role="presentation" align="right" cellpadding="0" cellspacing="0" style="width:240px;">
        <tr><td style="font-size:13px;color:#5C6470;padding:3px 0;">Subtotal</td>
            <td align="right" style="font-size:13px;color:#5C6470;padding:3px 0;">${money(a.subtotal)}</td></tr>
        <tr><td style="font-size:13px;color:#5C6470;padding:3px 0;">Impuesto (${num(a.taxRate)}%)</td>
            <td align="right" style="font-size:13px;color:#5C6470;padding:3px 0;">${money(a.taxAmount)}</td></tr>
        <tr><td style="font-size:16px;font-weight:700;color:${primary};padding:9px 0 0;border-top:2px solid ${primary};">Total</td>
            <td align="right" style="font-size:16px;font-weight:700;color:${primary};padding:9px 0 0;border-top:2px solid ${primary};">${money(a.total)}</td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 28px;"><div style="clear:both;height:14px;"></div></td></tr>
    ${
      a.notes
        ? `<tr><td style="padding:8px 28px 0;">
      <p style="margin:0 0 3px;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#5C6470;">Notas</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#5C6470;white-space:pre-wrap;">${esc(a.notes)}</p></td></tr>`
        : ""
    }
    <tr><td style="padding:26px 28px 28px;">
      <p style="margin:0;font-size:11px;color:#9aa0a9;border-top:1px solid #E4E0D6;padding-top:14px;">
        ${co ? esc(co) : "Documento"}${c?.company_phone ? " · " + esc(c.company_phone) : ""}${c?.company_address ? " · " + esc(c.company_address) : ""}
      </p>
    </td></tr>
    <tr><td style="height:4px;background:${secondary};font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    `${label} ${a.number}`,
    co,
    "",
    intro,
    "",
    ...a.items.map(
      (it) => `- ${it.description} x${num(it.quantity)} = ${money(num(it.quantity) * num(it.unit_price))}`
    ),
    "",
    `Subtotal: ${money(a.subtotal)}`,
    `Impuesto (${num(a.taxRate)}%): ${money(a.taxAmount)}`,
    `Total: ${money(a.total)}`,
    a.notes ? `\nNotas:\n${a.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
