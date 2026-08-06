import {
  LineItem,
  CompanySettings,
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
} from "@/types";
import { formatMoney, formatDate, hexToRgba, num, isValidHex } from "@/lib/format";

type Props = {
  docLabel: "COTIZACIÓN" | "FACTURA";
  number: string;
  date: string;
  secondaryDateLabel: string;
  secondaryDate: string | null;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  items: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  stamp?: { text: string; colorClass: string } | null;
  company?: CompanySettings | null;
};

export default function DocumentTemplate({
  docLabel,
  number,
  date,
  secondaryDateLabel,
  secondaryDate,
  clientName,
  clientCompany,
  clientEmail,
  clientPhone,
  items,
  subtotal,
  taxRate,
  taxAmount,
  total,
  notes,
  stamp,
  company,
}: Props) {
  const rawPrimary = company?.brand_primary ?? DEFAULT_BRAND_PRIMARY;
  const rawSecondary = company?.brand_secondary ?? DEFAULT_BRAND_SECONDARY;
  const primary = isValidHex(rawPrimary) ? rawPrimary : DEFAULT_BRAND_PRIMARY;
  const secondary = isValidHex(rawSecondary) ? rawSecondary : DEFAULT_BRAND_SECONDARY;

  const currency = company?.currency ?? "MXN";
  const locale = company?.locale ?? "es-MX";
  const money = (v: unknown) => formatMoney(v, currency, locale);

  const hasCompanyInfo = !!(
    company &&
    (company.company_name ||
      company.logo_url ||
      company.company_email ||
      company.company_phone ||
      company.company_address)
  );

  return (
    <article
      className="print-sheet relative bg-white border border-line rounded-sm shadow-sm
                 p-5 sm:p-8 md:p-10 max-w-3xl mx-auto overflow-hidden"
      aria-label={`${docLabel} ${number}`}
    >
      <div
        className="-mt-5 sm:-mt-8 md:-mt-10 -mx-5 sm:-mx-8 md:-mx-10 mb-6 sm:mb-8 h-2"
        style={{ background: `linear-gradient(to right, ${primary}, ${secondary})` }}
      />

      {stamp && (
        <div
          className={`stamp absolute top-9 sm:top-10 right-5 sm:right-8 md:right-10
                      text-xs sm:text-sm ${stamp.colorClass}`}
        >
          {stamp.text}
        </div>
      )}

      <header
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 pb-6 mb-6"
        style={{ borderBottom: `1px solid ${hexToRgba(primary, 0.15)}` }}
      >
        <div className="min-w-0">
          {hasCompanyInfo ? (
            <>
              {company?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logo_url}
                  alt={company.company_name ?? "Logo"}
                  className="max-h-12 max-w-[180px] object-contain object-left mb-2"
                />
              )}
              {company?.company_name && (
                <p className="font-display font-semibold text-ink leading-tight">
                  {company.company_name}
                </p>
              )}
              <div className="text-xs text-slate mt-1 space-y-0.5">
                {company?.company_address && <p>{company.company_address}</p>}
                {company?.company_email && <p>{company.company_email}</p>}
                {company?.company_phone && <p>{company.company_phone}</p>}
                {company?.tax_id && <p>ID fiscal: {company.tax_id}</p>}
              </div>
            </>
          ) : (
            <p className="text-xs uppercase tracking-widest text-slate">{docLabel}</p>
          )}
        </div>

        <div className="sm:text-right shrink-0">
          {hasCompanyInfo && (
            <p className="text-xs uppercase tracking-widest text-slate mb-1">{docLabel}</p>
          )}
          <p className="font-mono text-xl sm:text-2xl font-semibold" style={{ color: primary }}>
            {number}
          </p>
          <div className="text-sm text-slate mt-2 space-y-0.5">
            <p>
              Fecha: <span className="font-mono text-ink">{date}</span>
            </p>
            {secondaryDate && (
              <p>
                {secondaryDateLabel}: <span className="font-mono text-ink">{secondaryDate}</span>
              </p>
            )}
          </div>
        </div>
      </header>

      <section className="mb-8">
        <p className="field-label">Cliente</p>
        <p className="font-display font-semibold text-ink">{clientName}</p>
        {clientCompany && <p className="text-sm text-slate">{clientCompany}</p>}
        {clientEmail && <p className="text-sm text-slate break-words">{clientEmail}</p>}
        {clientPhone && <p className="text-sm text-slate">{clientPhone}</p>}
      </section>

      <div className="print-scroll -mx-5 sm:mx-0 px-5 sm:px-0 overflow-x-auto">
        <table className="w-full min-w-[420px] sm:min-w-0 text-sm mb-6">
          <caption className="sr-only">Conceptos de la {docLabel.toLowerCase()}</caption>
          <thead>
            <tr
              className="text-left text-xs uppercase tracking-wide text-slate"
              style={{ borderBottom: `1px solid ${hexToRgba(primary, 0.3)}` }}
            >
              <th scope="col" className="py-2 font-medium">Descripción</th>
              <th scope="col" className="py-2 font-medium text-right w-14">Cant.</th>
              <th scope="col" className="py-2 font-medium text-right w-28">Precio</th>
              <th scope="col" className="py-2 font-medium text-right w-28">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="py-2.5 pr-3 text-ink break-words">{item.description}</td>
                <td className="py-2.5 text-right font-mono text-ink tabular-nums">
                  {num(item.quantity)}
                </td>
                <td className="py-2.5 text-right font-mono text-ink tabular-nums whitespace-nowrap">
                  {money(item.unit_price)}
                </td>
                <td className="py-2.5 text-right font-mono text-ink tabular-nums whitespace-nowrap">
                  {money(num(item.quantity) * num(item.unit_price))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-8 print-keep">
        <dl className="w-full sm:w-64 text-sm space-y-1.5">
          <div className="flex justify-between text-slate">
            <dt>Subtotal</dt>
            <dd className="font-mono tabular-nums">{money(subtotal)}</dd>
          </div>
          <div className="flex justify-between text-slate">
            <dt>Impuesto ({num(taxRate)}%)</dt>
            <dd className="font-mono tabular-nums">{money(taxAmount)}</dd>
          </div>
          <div
            className="flex justify-between font-semibold text-base pt-1.5 mt-1.5"
            style={{ borderTop: `2px solid ${primary}`, color: primary }}
          >
            <dt>Total</dt>
            <dd className="font-mono tabular-nums">{money(total)}</dd>
          </div>
        </dl>
      </div>

      {notes && (
        <section className="border-t border-line pt-4 print-keep">
          <p className="field-label">Notas</p>
          <p className="text-sm text-slate whitespace-pre-wrap break-words">{notes}</p>
        </section>
      )}
    </article>
  );
}
