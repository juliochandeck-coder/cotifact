import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import ListFilters from "@/components/ListFilters";
import InvoiceExtraFilters from "@/components/InvoiceExtraFilters";
import DocumentList from "@/components/DocumentList";
import Pagination from "@/components/Pagination";
import InlineStatusSelect from "@/components/InlineStatusSelect";
import { formatMoney, num, sanitizeSearch } from "@/lib/format";
import {
  Invoice,
  InvoiceStatus,
  INVOICE_STATUSES,
  INVOICE_STATUS_LABEL,
  CompanySettings,
} from "@/types";

const PAGE_SIZE = 25;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string; dgi?: string; retainer?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeSearch(searchParams.q ?? "");
  const status = INVOICE_STATUSES.includes(searchParams.status as InvoiceStatus)
    ? (searchParams.status as InvoiceStatus)
    : "";
  const dgi = searchParams.dgi === "yes" || searchParams.dgi === "no" ? searchParams.dgi : "";
  const retainerOnly = searchParams.retainer === "yes";

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, client_name, client_company, total, status, created_at, due_date",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) {
    query = query.or(
      `client_name.ilike.%${q}%,client_company.ilike.%${q}%,invoice_number.ilike.%${q}%`
    );
  }
  if (status) query = query.eq("status", status);
  if (dgi) query = query.eq("requires_dgi", dgi === "yes");
  if (retainerOnly) query = query.eq("is_retainer_invoice", true);

  const [{ data: invoices, count }, { data: settings }, { data: unpaid }] = await Promise.all([
    query,
    supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
    supabase.rpc("outstanding_total"),
  ]);

  const list = (invoices ?? []) as Invoice[];
  const company = settings as CompanySettings | null;
  const currency = company?.currency ?? "USD";
  const locale = company?.locale ?? "es-PA";
  const total = count ?? 0;
  const isFiltered = !!q || !!status || !!dgi || retainerOnly;

  const outstanding = num(unpaid);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-title text-2xl font-bold text-ink">Facturas</h1>
            <p className="text-sm text-slate mt-1">
              {total} {total === 1 ? "factura" : "facturas"}
              {isFiltered && " con estos filtros"}
              {outstanding > 0 && <> · {formatMoney(outstanding, currency, locale)} por cobrar</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/export?kind=invoices" className="btn-secondary text-xs py-1.5" download>
              Exportar CSV
            </a>
            <Link href="/invoices/new" className="btn-primary text-xs py-1.5">
              + Nueva factura
            </Link>
          </div>
        </div>

        {(total > 0 || isFiltered) && (
          <>
            <ListFilters
              statuses={INVOICE_STATUSES}
              labels={INVOICE_STATUS_LABEL}
              placeholder="Buscar por cliente, empresa o número…"
            />
            <InvoiceExtraFilters />
          </>
        )}

        {list.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-ink font-display font-semibold">
              {isFiltered ? "Ninguna factura coincide" : "Todavía no hay facturas"}
            </p>
            <p className="text-sm text-slate mt-1 mb-4">
              {isFiltered
                ? "Prueba con otro término o quita los filtros."
                : "Se generan desde una cotización aprobada, o crea una suelta si no aplica."}
            </p>
            {isFiltered ? (
              <Link href="/invoices" className="btn-secondary">
                Limpiar filtros
              </Link>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Link href="/dashboard" className="btn-secondary">
                  Ir a cotizaciones
                </Link>
                <Link href="/invoices/new" className="btn-primary">
                  + Nueva factura
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
            <DocumentList
              basePath="/invoices"
              currency={currency}
              locale={locale}
              rows={list.map((invoice) => ({
                id: invoice.id,
                number: invoice.invoice_number,
                clientName: invoice.client_name,
                clientCompany: invoice.client_company,
                total: num(invoice.total),
                createdAt: invoice.created_at,
                badge: (
                  <InlineStatusSelect
                    kind="invoice"
                    table="invoices"
                    id={invoice.id}
                    value={invoice.status}
                    options={INVOICE_STATUSES}
                    labels={INVOICE_STATUS_LABEL}
                  />
                ),
              }))}
            />
            <Pagination
              basePath="/invoices"
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              params={{
                q: q || undefined,
                status: status || undefined,
                dgi: dgi || undefined,
                retainer: retainerOnly ? "yes" : undefined,
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
