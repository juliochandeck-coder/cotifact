import Link from "next/link";

type Props = {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
};

export default function Pagination({ basePath, page, pageSize, total, params }: Props) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function href(target: number) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) search.set(k, v);
    });
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <nav
      className="no-print flex items-center justify-between mt-4 text-sm"
      aria-label="Paginación"
    >
      <p className="text-slate">
        {from}–{to} de {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="btn-secondary text-xs py-1.5">
            Anterior
          </Link>
        ) : (
          <span className="btn-secondary text-xs py-1.5 opacity-40 cursor-not-allowed">
            Anterior
          </span>
        )}
        {page < lastPage ? (
          <Link href={href(page + 1)} className="btn-secondary text-xs py-1.5">
            Siguiente
          </Link>
        ) : (
          <span className="btn-secondary text-xs py-1.5 opacity-40 cursor-not-allowed">
            Siguiente
          </span>
        )}
      </div>
    </nav>
  );
}
