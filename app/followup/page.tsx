import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import CopyButton from "@/components/CopyButton";
import { QuoteStatusBadge, InvoiceStatusBadge } from "@/components/StatusBadge";
import { formatMoney, formatDate, num } from "@/lib/format";
import { quoteFollowUp, invoiceFollowUp, daysBetween } from "@/lib/followup";
import { Quote, Invoice, CompanySettings } from "@/types";

const DEFAULT_STALE_DAYS = 7;

export default async function FollowUpPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El umbral lo decide el usuario en Ajustes; 7 dias si aun no lo ha tocado.
  const { data: settings } = await supabase
    .from("company_settings")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  const staleDays = num((settings as CompanySettings | null)?.followup_days) || DEFAULT_STALE_DAYS;

  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);

  const [{ data: staleRaw }, { data: overdueRaw }] = await Promise.all([
    supabase
      .from("quotes")
      .select("*")
      .eq("status", "pendiente")
      .lt("created_at", cutoff.toISOString())
      .order("created_at", { ascending: true }),
    supabase
      .from("invoices")
      .select("*")
      .neq("status", "pagada")
      .not("due_date", "is", null)
      .lt("due_date", today)
      .order("due_date", { ascending: true }),
  ]);

  const stale = (staleRaw ?? []) as Quote[];
  const overdue = (overdueRaw ?? []) as Invoice[];
  const company = settings as CompanySettings | null;
  const currency = company?.currency ?? "MXN";
  const locale = company?.locale ?? "es-MX";
  const ctx = { currency, locale, companyName: company?.company_name };

  const owed = overdue.reduce((s, i) => s + num(i.total), 0);
  const waiting = stale.reduce((s, q) => s + num(q.total), 0);
  const clear = stale.length === 0 && overdue.length === 0;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-ink">Seguimiento</h1>
        <p className="text-sm text-slate mt-1">
          Lo que necesita un recordatorio hoy. Copia el mensaje y pégalo en WhatsApp o correo.
        </p>
        <p className="text-xs text-slate mt-1 mb-6">
          Aviso a los {staleDays} {staleDays === 1 ? "día" : "días"} sin respuesta ·{" "}
          <Link href="/settings" className="text-brass hover:underline">
            cambiar plazo
          </Link>
        </p>

        {clear && (
          <div className="card p-10 text-center">
            <p className="font-display font-semibold text-ink">Todo al día</p>
            <p className="text-sm text-slate mt-1">
              Ninguna cotización lleva más de {staleDays} {staleDays === 1 ? "día" : "días"} sin
              respuesta y no hay facturas vencidas.
            </p>
          </div>
        )}

        {overdue.length > 0 && (
          <section className="mb-8">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display font-semibold text-ink">Facturas vencidas</h2>
              <p className="text-sm text-brick font-medium">
                {formatMoney(owed, currency, locale)} por cobrar
              </p>
            </div>

            <ul className="space-y-3">
              {overdue.map((inv) => {
                const late = daysBetween(inv.due_date!);
                const msg = invoiceFollowUp(
                  inv.client_name,
                  inv.invoice_number,
                  num(inv.total),
                  inv.due_date,
                  late,
                  ctx
                );
                return (
                  <li key={inv.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="font-mono text-sm text-ink hover:text-brass"
                          >
                            {inv.invoice_number}
                          </Link>
                          <InvoiceStatusBadge status={inv.status} />
                        </div>
                        <p className="text-sm text-ink mt-1">{inv.client_name}</p>
                        <p className="text-xs text-brick mt-0.5">
                          Vencida hace {late} {late === 1 ? "día" : "días"} · venció el{" "}
                          {formatDate(inv.due_date, locale)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm text-ink tabular-nums">
                          {formatMoney(inv.total, currency, locale)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-line flex flex-wrap gap-2">
                      <CopyButton text={msg} />
                      {inv.client_email && (
                        <a
                          href={`mailto:${inv.client_email}?subject=${encodeURIComponent(
                            `Factura ${inv.invoice_number}`
                          )}&body=${encodeURIComponent(msg)}`}
                          className="btn-secondary text-xs py-1.5"
                        >
                          Abrir en correo
                        </a>
                      )}
                      <Link href={`/invoices/${inv.id}`} className="btn-ghost text-xs py-1.5">
                        Ver factura
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {stale.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display font-semibold text-ink">
                Sin respuesta hace +{staleDays} {staleDays === 1 ? "día" : "días"}
              </h2>
              <p className="text-sm text-slate">
                {formatMoney(waiting, currency, locale)} en juego
              </p>
            </div>

            <ul className="space-y-3">
              {stale.map((q) => {
                const days = daysBetween(q.created_at);
                const msg = quoteFollowUp(
                  q.client_name,
                  q.quote_number,
                  num(q.total),
                  days,
                  ctx
                );
                return (
                  <li key={q.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/quotes/${q.id}`}
                            className="font-mono text-sm text-ink hover:text-brass"
                          >
                            {q.quote_number}
                          </Link>
                          <QuoteStatusBadge status={q.status} />
                        </div>
                        <p className="text-sm text-ink mt-1">{q.client_name}</p>
                        <p className="text-xs text-slate mt-0.5">
                          Enviada hace {days} días
                          {q.valid_until && ` · vence el ${formatDate(q.valid_until, locale)}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm text-ink tabular-nums">
                          {formatMoney(q.total, currency, locale)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-line flex flex-wrap gap-2">
                      <CopyButton text={msg} />
                      {q.client_email && (
                        <a
                          href={`mailto:${q.client_email}?subject=${encodeURIComponent(
                            `Cotización ${q.quote_number}`
                          )}&body=${encodeURIComponent(msg)}`}
                          className="btn-secondary text-xs py-1.5"
                        >
                          Abrir en correo
                        </a>
                      )}
                      <Link href={`/quotes/${q.id}`} className="btn-ghost text-xs py-1.5">
                        Ver cotización
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
