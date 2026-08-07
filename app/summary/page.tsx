import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import SummaryRangePicker from "@/components/SummaryRangePicker";
import { KpiCard, FunnelBar, RankedList } from "@/components/SummaryVisuals";
import { computeRange, trend } from "@/lib/dateRanges";
import { formatMoney, num } from "@/lib/format";
import {
  CompanySettings,
  SummaryKpis,
  SummaryFunnel,
  SummaryTopService,
  SummaryTopClient,
  SummaryAverages,
  SummaryRangePreset,
} from "@/types";

const VALID_PRESETS: SummaryRangePreset[] = ["month", "quarter", "year", "custom"];

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const preset = VALID_PRESETS.includes(searchParams.range as SummaryRangePreset)
    ? (searchParams.range as SummaryRangePreset)
    : "month";

  const { current, previous } = computeRange(preset, searchParams.from, searchParams.to);

  const [
    { data: settings },
    { data: kpisNow },
    { data: kpisPrev },
    { data: funnel },
    { data: topServicesRaw },
    { data: topClients },
    { data: averages },
  ] = await Promise.all([
    supabase.from("company_settings").select("*").eq("user_id", user!.id).maybeSingle(),
    supabase.rpc("summary_kpis", { p_from: current.from, p_to: current.to }).maybeSingle(),
    supabase.rpc("summary_kpis", { p_from: previous.from, p_to: previous.to }).maybeSingle(),
    supabase.rpc("summary_funnel", { p_from: current.from, p_to: current.to }).maybeSingle(),
    supabase.rpc("summary_top_services", { p_from: current.from, p_to: current.to, p_limit: 15 }),
    supabase.rpc("summary_top_clients", { p_from: current.from, p_to: current.to, p_limit: 5 }),
    supabase.rpc("summary_averages", { p_from: current.from, p_to: current.to }).maybeSingle(),
  ]);

  const company = settings as CompanySettings | null;
  const currency = company?.currency ?? "USD";
  const locale = company?.locale ?? "es-PA";
  const money = (v: unknown) => formatMoney(v, currency, locale);

  const kNow = kpisNow as SummaryKpis | null;
  const kPrev = kpisPrev as SummaryKpis | null;
  const f = (funnel as SummaryFunnel | null) ?? { sent: 0, approved: 0, invoiced: 0, collected: 0 };
  const avg = averages as SummaryAverages | null;

  const approvalTotal = num(kNow?.approved_count) + num(kNow?.rejected_count);
  const approvalRate = approvalTotal > 0 ? (num(kNow?.approved_count) / approvalTotal) * 100 : null;

  const approvalTotalPrev = num(kPrev?.approved_count) + num(kPrev?.rejected_count);
  const approvalRatePrev =
    approvalTotalPrev > 0 ? (num(kPrev?.approved_count) / approvalTotalPrev) * 100 : null;

  const services = (topServicesRaw ?? []) as SummaryTopService[];
  const byRevenue = [...services].sort((a, b) => num(b.total_revenue) - num(a.total_revenue)).slice(0, 5);
  const byFrequency = [...services].sort((a, b) => num(b.times_used) - num(a.times_used)).slice(0, 5);

  const clients = (topClients ?? []) as SummaryTopClient[];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h1 className="font-title text-2xl font-bold text-ink">Resumen</h1>
            <p className="text-sm text-slate mt-1">{current.label}</p>
          </div>
        </div>

        <SummaryRangePicker current={preset} />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <KpiCard
            label="Cotizado"
            value={money(kNow?.quoted_total)}
            trendPct={trend(num(kNow?.quoted_total), num(kPrev?.quoted_total))}
          />
          <KpiCard
            label="Facturado"
            value={money(kNow?.invoiced_total)}
            trendPct={trend(num(kNow?.invoiced_total), num(kPrev?.invoiced_total))}
          />
          <KpiCard
            label="Cobrado"
            value={money(kNow?.collected_total)}
            trendPct={trend(num(kNow?.collected_total), num(kPrev?.collected_total))}
          />
          <KpiCard
            label="Por cobrar"
            value={money(kNow?.outstanding_total)}
            trendPct={trend(num(kNow?.outstanding_total), num(kPrev?.outstanding_total))}
            trendGoodWhenUp={false}
          />
          <KpiCard
            label="Tasa de aprobación"
            value={approvalRate === null ? "—" : `${approvalRate.toFixed(0)}%`}
            trendPct={
              approvalRate !== null && approvalRatePrev !== null
                ? trend(approvalRate, approvalRatePrev)
                : null
            }
          />
          <KpiCard
            label="Ticket promedio"
            value={avg?.avg_ticket ? money(avg.avg_ticket) : "—"}
            trendPct={null}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <FunnelBar
            steps={[
              { label: "Enviadas", value: f.sent },
              { label: "Aprobadas", value: f.approved },
              { label: "Facturadas", value: f.invoiced },
              { label: "Cobradas", value: f.collected },
            ]}
          />

          <div className="card p-5">
            <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide mb-4">
              Tiempos
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate">Días promedio hasta aprobación</dt>
                <dd className="font-mono text-ink tabular-nums">
                  {avg?.avg_days_to_approval != null ? avg.avg_days_to_approval.toFixed(1) : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate">Días promedio hasta cobro</dt>
                <dd className="font-mono text-ink tabular-nums">
                  {avg?.avg_days_to_payment != null ? avg.avg_days_to_payment.toFixed(1) : "—"}
                </dd>
              </div>
              <div className="flex justify-between pt-3 border-t border-line">
                <dt className="text-slate">Cotizaciones aprobadas</dt>
                <dd className="font-mono text-ink tabular-nums">{num(kNow?.approved_count)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate">Cotizaciones no aprobadas</dt>
                <dd className="font-mono text-ink tabular-nums">{num(kNow?.rejected_count)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <RankedList
            title="Más ingreso"
            rows={byRevenue.map((s) => ({
              label: s.description,
              primary: money(s.total_revenue),
            }))}
          />
          <RankedList
            title="Más vendido"
            rows={byFrequency.map((s) => ({
              label: s.description,
              primary: `${s.times_used}×`,
            }))}
          />
          <RankedList
            title="Top clientes"
            rows={clients.map((c) => ({
              label: c.client_name,
              primary: money(c.total_amount),
              secondary: `${c.document_count} doc.`,
            }))}
          />
        </div>
      </main>
    </div>
  );
}
