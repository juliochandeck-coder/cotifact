export function KpiCard({
  label,
  value,
  trendPct,
  trendGoodWhenUp = true,
}: {
  label: string;
  value: string;
  trendPct: number | null;
  trendGoodWhenUp?: boolean;
}) {
  const isUp = (trendPct ?? 0) >= 0;
  const isGood = trendPct === null ? null : isUp === trendGoodWhenUp;

  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate">{label}</p>
      <p className="font-mono text-xl font-semibold text-ink mt-1 tabular-nums">{value}</p>
      {trendPct !== null && (
        <p
          className={`text-xs mt-1 ${
            isGood === null ? "text-slate" : isGood ? "text-forest" : "text-brick"
          }`}
        >
          {isUp ? "↑" : "↓"} {Math.abs(trendPct).toFixed(0)}% vs período anterior
        </p>
      )}
    </div>
  );
}

export function FunnelBar({
  steps,
}: {
  steps: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...steps.map((s) => s.value));

  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide mb-4">
        Embudo
      </h2>
      <div className="space-y-3">
        {steps.map((s, i) => {
          const pct = (s.value / max) * 100;
          const ofPrev =
            i > 0 && steps[i - 1].value > 0
              ? Math.round((s.value / steps[i - 1].value) * 100)
              : null;
          return (
            <div key={s.label}>
              <div className="flex items-baseline justify-between text-xs mb-1">
                <span className="text-slate">{s.label}</span>
                <span className="font-mono text-ink tabular-nums">
                  {s.value}
                  {ofPrev !== null && <span className="text-slate"> · {ofPrev}%</span>}
                </span>
              </div>
              <div className="h-2 rounded-full bg-line overflow-hidden">
                <div
                  className="h-full rounded-full bg-ink transition-all"
                  style={{ width: `${Math.max(pct, s.value > 0 ? 3 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RankedList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; primary: string; secondary?: string }[];
}) {
  return (
    <div className="card p-5">
      <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide mb-4">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate">Sin datos en este período.</p>
      ) : (
        <ol className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-xs text-slate w-4 shrink-0">{i + 1}</span>
                <span className="text-ink truncate">{r.label}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="font-mono text-ink tabular-nums">{r.primary}</span>
                {r.secondary && <span className="text-xs text-slate ml-1.5">{r.secondary}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
