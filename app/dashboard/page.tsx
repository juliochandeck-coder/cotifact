import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import ListFilters from "@/components/ListFilters";
import DocumentList from "@/components/DocumentList";
import Pagination from "@/components/Pagination";
import UnbilledAlert from "@/components/UnbilledAlert";
import QuickInvoiceButton from "@/components/QuickInvoiceButton";
import InlineStatusSelect from "@/components/InlineStatusSelect";
import { formatMoney, num, sanitizeSearch } from "@/lib/format";
import {
  Quote,
  QuoteStatus,
  QUOTE_STATUSES,
  QUOTE_STATUS_LABEL,
  CompanySettings,
} from "@/types";

const PAGE_SIZE = 25;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeSearch(searchParams.q ?? "");
  const status = QUOTE_STATUSES.includes(searchParams.status as QuoteStatus)
    ? (searchParams.status as QuoteStatus)
    : "";

  // Filtro y paginado ocurren en la base de datos, no en el navegador:
  // el listado no se degrada al llegar a cientos de cotizaciones.
  let query = supabase
    .from("quotes")
    .select("id, quote_number, client_name, client_company, total, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) {
    query = query.or(
      `client_name.ilike.%${q}%,client_company.ilike.%${q}%,quote_number.ilike.%${q}%`
    );
  }
  if (status) query = query.eq("status", status);

  // El conteo y el monto de lo no facturado se calculan en Postgres.
  // Antes se traian TODAS las cotizaciones aprobadas y TODAS las facturas al
  // navegador solo para cruzarlas: eso crecia sin limite con el uso.
  const [{ data: quotes, count }, { data: settings }, { data: summary }, { data: unbilledIdRows }] =
    await Promise.all([
      query,
      supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.rpc("unbilled_summary").maybeSingle(),
      supabase.rpc("unbilled_quote_ids"),
    ]);

  // Primera vez: al asistente, no a una pantalla vacia sin instrucciones.
  if (settings && !(settings as CompanySettings).onboarded_at && (count ?? 0) === 0) {
    redirect("/welcome");
  }

  const list = (quotes ?? []) as Quote[];

  const unbilledIds = new Set(
    ((unbilledIdRows ?? []) as unknown as string[]).map((r) =>
      typeof r === "string" ? r : (r as { unbilled_quote_ids: string }).unbilled_quote_ids
    )
  );
  const unbilledCount = num((summary as { total_count?: number } | null)?.total_count);
  const unbilledAmount = num((summary as { total_amount?: number } | null)?.total_amount);
  const company = settings as CompanySettings | null;
  const currency = company?.currency ?? "MXN";
  const locale = company?.locale ?? "es-MX";
  const total = count ?? 0;
  const isFiltered = !!q || !!status;

  const pipeline = list
    .filter((quote) => quote.status === "pendiente" || quote.status === "recotizar")
    .reduce((sum, quote) => sum + num(quote.total), 0);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="font-title text-2xl font-bold text-ink">Cotizaciones</h1>
            <p className="text-sm text-slate mt-1">
              {total} {total === 1 ? "cotización" : "cotizaciones"}
              {isFiltered && " con estos filtros"}
              {pipeline > 0 && (
                <> · {formatMoney(pipeline, currency, locale)} en espera de respuesta</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/export?kind=quotes" className="btn-secondary text-xs py-1.5" download>
              Exportar CSV
            </a>
            <Link href="/quotes/new" className="btn-primary">
              + Nueva cotización
            </Link>
          </div>
        </div>

        <UnbilledAlert count={unbilledCount} amount={unbilledAmount} company={company} />

        {(total > 0 || isFiltered) && (
          <ListFilters
            statuses={QUOTE_STATUSES}
            labels={QUOTE_STATUS_LABEL}
            placeholder="Buscar por cliente, empresa o número…"
          />
        )}

        {list.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-ink font-display font-semibold">
              {isFiltered ? "Ninguna cotización coincide" : "Todavía no hay cotizaciones"}
            </p>
            <p className="text-sm text-slate mt-1 mb-4">
              {isFiltered
                ? "Prueba con otro término o quita el filtro de estado."
                : "Genera la primera para verla aquí."}
            </p>
            {isFiltered ? (
              <Link href="/dashboard" className="btn-secondary">
                Limpiar filtros
              </Link>
            ) : (
              <Link href="/quotes/new" className="btn-primary">
                Crear cotización
              </Link>
            )}
          </div>
        ) : (
          <>
            <DocumentList
              basePath="/quotes"
              currency={currency}
              locale={locale}
              rows={list.map((quote) => ({
                id: quote.id,
                number: quote.quote_number,
                clientName: quote.client_name,
                clientCompany: quote.client_company,
                total: num(quote.total),
                createdAt: quote.created_at,
                badge: (
                  <InlineStatusSelect
                    kind="quote"
                    table="quotes"
                    id={quote.id}
                    value={quote.status}
                    options={QUOTE_STATUSES}
                    labels={QUOTE_STATUS_LABEL}
                  />
                ),
                action: unbilledIds.has(quote.id) ? (
                  <QuickInvoiceButton
                    quoteId={quote.id}
                    quoteNumber={quote.quote_number}
                    company={company}
                  />
                ) : undefined,
              }))}
            />
            <Pagination
              basePath="/dashboard"
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              params={{ q: q || undefined, status: status || undefined }}
            />
          </>
        )}
      </main>
    </div>
  );
}
