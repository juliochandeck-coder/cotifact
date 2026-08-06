import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/format";

export type ListRow = {
  id: string;
  number: string;
  clientName: string;
  clientCompany: string | null;
  total: number;
  createdAt: string;
  badge: React.ReactNode;
  action?: React.ReactNode;
};

type Props = {
  rows: ListRow[];
  basePath: string;
  currency: string;
  locale: string;
};

export default function DocumentList({ rows, basePath, currency, locale }: Props) {
  return (
    <>
      {/* Escritorio */}
      <div className="hidden sm:block card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate">
              <th scope="col" className="px-4 py-3 font-medium">Número</th>
              <th scope="col" className="px-4 py-3 font-medium">Cliente</th>
              <th scope="col" className="px-4 py-3 font-medium text-right">Total</th>
              <th scope="col" className="px-4 py-3 font-medium">Estado</th>
              <th scope="col" className="px-4 py-3 font-medium">Fecha</th>
              <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-line last:border-0 hover:bg-paper transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`${basePath}/${row.id}`}
                    className="font-mono text-ink hover:text-brass"
                  >
                    {row.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink">
                  {row.clientName}
                  {row.clientCompany && (
                    <span className="block text-xs text-slate">{row.clientCompany}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-ink tabular-nums whitespace-nowrap">
                  {formatMoney(row.total, currency, locale)}
                </td>
                <td className="px-4 py-3">{row.badge}</td>
                <td className="px-4 py-3 text-slate whitespace-nowrap">
                  {formatDate(row.createdAt, locale)}
                </td>
                <td className="px-4 py-3 text-right">{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Movil: tarjetas, el area tocable es toda la fila */}
      <ul className="sm:hidden space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="card p-4 relative hover:border-brass/50 transition-colors">
            {/* Enlace extendido: cubre la tarjeta sin envolver al botón de acción */}
            <Link
              href={`${basePath}/${row.id}`}
              className="absolute inset-0 z-0 rounded-sm"
              aria-label={`Abrir ${row.number}`}
            />
            <div className="relative z-10 pointer-events-none">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-ink">{row.number}</p>
                  <p className="text-sm text-ink truncate mt-0.5">{row.clientName}</p>
                  {row.clientCompany && (
                    <p className="text-xs text-slate truncate">{row.clientCompany}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm text-ink tabular-nums">
                    {formatMoney(row.total, currency, locale)}
                  </p>
                  <p className="text-xs text-slate mt-0.5">
                    {formatDate(row.createdAt, locale)}
                  </p>
                </div>
              </div>
              <div className="mt-3">{row.badge}</div>
            </div>
            {row.action && (
              <div className="relative z-10 mt-3 pt-3 border-t border-line">{row.action}</div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
