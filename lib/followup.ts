import { formatMoney, formatDate } from "@/lib/format";

type Ctx = { currency: string; locale: string; companyName?: string | null };

/** Mensaje para una cotización sin respuesta. Cortés, corto, con una pregunta clara. */
export function quoteFollowUp(
  clientName: string,
  number: string,
  total: number,
  days: number,
  ctx: Ctx
) {
  const first = clientName.trim().split(/\s+/)[0] || clientName;
  const firma = ctx.companyName ? `\n\n${ctx.companyName}` : "";
  return `Hola ${first}, ¿cómo vas?

Te escribo por la cotización ${number} que te envié hace ${days} ${days === 1 ? "día" : "días"}, por ${formatMoney(total, ctx.currency, ctx.locale)}.

¿La pudiste revisar? Si necesitas que ajuste algo del alcance o del precio, dime y lo vemos sin problema.${firma}`;
}

/** Recordatorio de pago. Directo pero sin agresividad: el cliente casi siempre olvidó. */
export function invoiceFollowUp(
  clientName: string,
  number: string,
  total: number,
  dueDate: string | null,
  daysLate: number,
  ctx: Ctx
) {
  const first = clientName.trim().split(/\s+/)[0] || clientName;
  const firma = ctx.companyName ? `\n\n${ctx.companyName}` : "";
  const venc = dueDate ? ` con vencimiento el ${formatDate(dueDate, ctx.locale)}` : "";
  return `Hola ${first}, espero que todo bien.

Te recuerdo la factura ${number} por ${formatMoney(total, ctx.currency, ctx.locale)}${venc}. Lleva ${daysLate} ${daysLate === 1 ? "día" : "días"} pendiente.

Si ya la pagaste, ignora este mensaje y avísame para actualizarla de mi lado. Si necesitas los datos de pago otra vez, te los reenvío.${firma}`;
}

export function daysBetween(from: string, to: Date = new Date()) {
  const parts = from.slice(0, 10).split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const t = new Date(to);
  t.setHours(0, 0, 0, 0);
  return Math.floor((t.getTime() - d.getTime()) / 86_400_000);
}
