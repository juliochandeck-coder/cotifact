import { Fragment } from "react";
import { LineItem, CompanySettings } from "@/types";
import { formatMoney, num } from "@/lib/format";
import { DocDesign, designVars, resolveDesign } from "@/lib/docDesign";
import DocFit from "@/components/DocFit";

/**
 * Plantilla de impresion de cotizaciones y facturas.
 *
 * El aspecto (colores, tipografía, tamaños, tabla, textos, elementos visibles)
 * sale del diseño que el usuario edita en la página "Diseño"
 * (company_settings.doc_design). Sin diseño guardado se usa el original dmc.
 * Todo fluye con el contenido; al imprimir siempre cabe en una página.
 */
type Props = {
  docLabel: "COTIZACIÓN" | "FACTURA";
  number: string;
  /** Fecha ya formateada como dd-mm-aaaa */
  date: string;
  secondaryDateLabel?: string;
  secondaryDate?: string | null;
  clientName: string;
  clientCompany: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  /** RUC y dirección del cliente (del directorio). */
  clientTaxId?: string | null;
  clientAddress?: string | null;
  items: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  projectName?: string | null;
  projectDescription?: string | null;
  paymentMethod?: string | null;
  /** Se conserva por compatibilidad; el estado no se imprime en el documento. */
  statusTag?: React.ReactNode;
  company?: CompanySettings | null;
  /** Diseño a usar en lugar del guardado (vista previa de la página Diseño). */
  design?: DocDesign;
};

type Ctx = Props & { d: DocDesign; money: (v: unknown) => string; blank: string };

export default function DocumentTemplate(props: Props) {
  const { company } = props;
  const d = props.design ?? resolveDesign(company?.doc_design);
  const currency = company?.currency ?? "USD";
  const locale = company?.locale ?? "es-PA";
  const money = (v: unknown) => docMoney(v, currency, locale);
  const isInvoice = props.docLabel === "FACTURA";
  const ctx: Ctx = { ...props, d, money, blank: d.texts.blank };

  return (
    <DocFit>
      {!d.show.pageNumber && (
        <style>{"@media print { @page { @bottom-center { content: none; } } }"}</style>
      )}
      <article
        className={`doc ${isInvoice ? "doc--invoice" : "doc--quote"}`}
        style={designVars(d) as React.CSSProperties}
        aria-label={`${props.docLabel} ${props.number}`}
      >
        <div className="doc-rule" />

        {isInvoice ? <InvoiceBody {...ctx} /> : <QuoteBody {...ctx} />}

        <footer className="doc-footer">
          <div className="doc-rule" />
          {d.show.footerAddress && <p className="doc-address">{company?.company_address || ""}</p>}
        </footer>
      </article>
    </DocFit>
  );
}

/* ------------------------------------------------------------------ */
/* Encabezado                                                          */
/* ------------------------------------------------------------------ */

function Logo({ company, d }: { company?: CompanySettings | null; d: DocDesign }) {
  if (!d.show.logo) return <div className="doc-logo doc-logo--hidden" />;
  return (
    <div className="doc-logo">
      {company?.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.logo_url} alt={company.company_name ?? "Logo"} />
      )}
    </div>
  );
}

function IssuerInfo({
  company,
  d,
  underlineEmail,
}: {
  company?: CompanySettings | null;
  d: DocDesign;
  underlineEmail?: boolean;
}) {
  const blank = d.texts.blank;
  return (
    <>
      <p className="doc-issuer-name">{(company?.company_name ?? "").toUpperCase()}</p>
      {d.show.issuerInfo && (
        <div className="doc-issuer-info">
          <p>
            {d.texts.rucLabel}: {company?.tax_id || blank}
          </p>
          <p>Teléfono: {company?.company_phone || blank}</p>
          <p>
            E-Mail:{" "}
            <span className={underlineEmail ? "doc-underline" : undefined}>
              {company?.company_email || blank}
            </span>
          </p>
        </div>
      )}
    </>
  );
}

function NumberBox({ number }: { number: string }) {
  return <div className="doc-numbox">{displayNumber(number)}</div>;
}

/* ------------------------------------------------------------------ */
/* FACTURA                                                             */
/* ------------------------------------------------------------------ */

function InvoiceBody(p: Ctx) {
  const { money, d, blank } = p;
  const t = d.texts;
  const items = p.items ?? [];
  // La forma de pago de la factura, o la fija de Ajustes si la factura no trae una.
  const [payTitle, ...payLines] = splitLines(
    p.paymentMethod?.trim() ? p.paymentMethod : p.company?.default_payment_method
  );

  return (
    <>
      <header className="doc-head">
        <Logo company={p.company} d={d} />
        <div className="doc-head-right">
          {t.invoiceTitle.trim() ? (
            <div className="doc-titlerow">
              <p className="doc-title">{t.invoiceTitle}</p>
              <NumberBox number={p.number} />
            </div>
          ) : (
            <NumberBox number={p.number} />
          )}
          <IssuerInfo company={p.company} d={d} />
        </div>
      </header>

      <section className="inv-client">
        <p>
          <b>{t.clientLabel}</b>: {p.clientName || blank}
        </p>
        <p>
          <b>{t.rucLabel}</b>: {p.clientTaxId || blank}
        </p>
        <p>
          <b>{t.addressLabel}:</b> {p.clientAddress || blank}
        </p>
        <p>
          <b>{t.dateLabel}</b>: {p.date}
        </p>
      </section>

      <section className="inv-table">
        <div className="inv-row inv-row--head">
          <div className="inv-c1">{t.colDetail}</div>
          <div className="inv-c2">{t.colTotal}</div>
        </div>

        <div className="inv-bodyrows">
          {items.map((item, i) => (
            <div className="inv-row" key={i}>
              <div className="inv-c1 inv-desc">
                <Description text={item.description} />
              </div>
              <div className="inv-c2 inv-amount">
                {money(num(item.quantity) * num(item.unit_price))}
              </div>
            </div>
          ))}
          {(p.projectName || p.projectDescription) && (
            <div className="inv-row">
              <div className="inv-c1 inv-project">
                {p.projectName && <p className="inv-project-name">{p.projectName}</p>}
                {p.projectDescription && (
                  <div className="inv-project-desc">
                    <Description text={p.projectDescription} />
                  </div>
                )}
              </div>
              <div className="inv-c2" />
            </div>
          )}
          <div className="inv-row inv-row--fill">
            <div className="inv-c1" />
            <div className="inv-c2" />
          </div>
        </div>
      </section>

      <section className="inv-bottom">
        <div className="inv-pay">
          <p className="inv-pay-title">{t.paymentTitle}</p>
          {payTitle && <p className="inv-pay-method">{payTitle}</p>}
          {payLines.map((l, i) => (
            <p key={i} className="inv-pay-line">
              {l}
            </p>
          ))}
          {p.notes && <p className="inv-pay-line inv-notes">{p.notes}</p>}
        </div>

        <div className="inv-totals">
          <div className="inv-trow">
            <div className="inv-tl">{t.subtotal}</div>
            <div className="inv-tv">{money(p.subtotal)}</div>
          </div>
          {d.show.taxRow && (
            <div className="inv-trow">
              <div className="inv-tl">{t.tax}</div>
              <div className="inv-tv">{money(p.taxAmount)}</div>
            </div>
          )}
          <div className="inv-trow inv-trow--total">
            <div className="inv-tl">{t.total}</div>
            <div className="inv-tv">{money(p.total)}</div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* COTIZACIÓN                                                          */
/* ------------------------------------------------------------------ */

type ColKey = "desc" | "qty" | "unit" | "cost";

function QuoteBody(p: Ctx) {
  const { money, d, blank } = p;
  const t = d.texts;
  const items = p.items ?? [];
  const client = joinClient(p.clientCompany, p.clientName);
  const rows = items.length ? items : [{ description: "", quantity: 0, unit_price: 0 }];

  // Columnas visibles y sus anchos relativos
  const cols: { key: ColKey; label: string; w: number }[] = [
    { key: "desc", label: t.colDescription, w: d.table.colDescription },
    ...(d.show.qtyColumn ? [{ key: "qty" as ColKey, label: t.colQty, w: d.table.colQty }] : []),
    ...(d.show.unitColumn ? [{ key: "unit" as ColKey, label: t.colUnit, w: d.table.colUnit }] : []),
    { key: "cost", label: t.colCost, w: d.table.colCost },
  ];
  const last = cols.length - 1;
  const labelCol = last - 1; // columna donde van "Subtotal", "ITBMS", "TOTAL"
  const colTemplate = cols
    .map((c) => (c.key === "desc" ? `minmax(0, ${c.w}fr)` : `minmax(max-content, ${c.w}fr)`))
    .join(" ");
  const empty = d.table.emptyRows;

  const cell = (
    i: number,
    extra = "",
    content: React.ReactNode = null,
    style?: React.CSSProperties
  ) => (
    <div
      className={`qc ${i === 0 ? "qc--first" : ""} ${i === last ? "qc--last" : ""} ${extra}`}
      style={{ gridColumn: i + 1, ...style }}
    >
      {content}
    </div>
  );

  const totalsRow = (label: string, value: string, cls: string) =>
    cols.map((c, i) => (
      <Fragment key={c.key}>
        {cell(
          i,
          `q-tot ${cls} ${i === labelCol ? (c.key === "desc" ? "q-tl q-tl--right" : "q-tl") : ""} ${
            i === last ? "q-tv" : ""
          }`,
          i === labelCol ? label : i === last ? value : null
        )}
      </Fragment>
    ));

  return (
    <>
      <header className="doc-head">
        <Logo company={p.company} d={d} />
        <div className="doc-head-right">
          <div className="doc-titlerow">
            {t.quoteTitle.trim() && <p className="doc-title">{t.quoteTitle}</p>}
            <NumberBox number={p.number} />
          </div>
          <IssuerInfo company={p.company} d={d} underlineEmail />
        </div>
      </header>

      <section className="q-client">
        <p>
          <b>{t.clientLabel}</b>: {client || blank}
        </p>
        <p>
          <b>{t.projectLabel}</b>: {p.projectName || blank}
        </p>
        {p.projectDescription && <p className="q-project-desc">{p.projectDescription}</p>}
        <p>
          <b>{t.dateLabel}</b>: {p.date}
        </p>
      </section>

      <section
        className="q-table"
        style={{
          gridTemplateColumns: colTemplate,
          // encabezado, conceptos, filas vacías, Subtotal, (ITBMS), TOTAL
          gridTemplateRows: [
            "auto",
            `repeat(${rows.length}, auto)`,
            empty ? `repeat(${empty}, 25.5pt)` : "",
            "minmax(25.6pt, auto)",
            d.show.taxRow ? "minmax(25.7pt, auto)" : "",
            "minmax(28.9pt, auto)",
          ]
            .filter(Boolean)
            .join(" "),
        }}
      >
        {cols.map((c, i) => (
          <Fragment key={c.key}>{cell(i, "q-th", c.label)}</Fragment>
        ))}

        {rows.map((item, r) => {
          const qty = num(item.quantity);
          const isEmpty = !items.length;
          const isLast = r === rows.length - 1;
          return (
            <Fragment key={r}>
              {cols.map((c, i) => {
                if (c.key === "desc") {
                  // La descripción del último concepto baja también por las filas vacías
                  return (
                    <Fragment key={c.key}>
                      {cell(
                        i,
                        `q-desc ${isLast ? "q-desc--last" : "q-sep"}`,
                        <Description text={item.description} />,
                        isLast && empty ? { gridRow: `span ${1 + empty}` } : undefined
                      )}
                    </Fragment>
                  );
                }
                const value = isEmpty
                  ? ""
                  : c.key === "qty"
                    ? String(qty)
                    : c.key === "unit"
                      ? qty === 1
                        ? ""
                        : money(item.unit_price)
                      : money(qty * num(item.unit_price));
                return (
                  <Fragment key={c.key}>
                    {cell(i, `q-num ${isLast && !empty ? "" : "q-sep"}`, value)}
                  </Fragment>
                );
              })}
            </Fragment>
          );
        })}

        {Array.from({ length: empty }).map((_, r) =>
          cols.slice(1).map((c, j) => (
            <Fragment key={`e${r}${c.key}`}>{cell(j + 1, r < empty - 1 ? "q-sep" : "")}</Fragment>
          ))
        )}

        {totalsRow(t.subtotal, money(p.subtotal), "q-solid q-sep")}
        {d.show.taxRow && totalsRow(num(p.taxAmount) !== 0 ? t.tax : "", money(p.taxAmount), "")}
        {totalsRow(t.total, money(p.total), "q-total q-solid q-solid-b")}
      </section>

      <section className="q-details">
        <p className="q-details-title">{t.quoteDetails}</p>
        {p.notes && <p className="q-notes">{p.notes}</p>}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/** Texto de concepto: respeta saltos de línea y convierte "- ", "• " o "* " en viñetas. */
function Description({ text }: { text: string | null | undefined }) {
  const lines = (text ?? "").replace(/\r\n?/g, "\n").split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const m = line.match(/^\s*(?:[-•*–·])\s+(.*)$/);
        if (m) {
          return (
            <p key={i} className="doc-bullet">
              <span className="doc-bullet-dot">•</span>
              {m[1]}
            </p>
          );
        }
        return <p key={i}>{line.trim() === "" ? " " : line}</p>;
      })}
    </>
  );
}

function splitLines(text: string | null | undefined): string[] {
  return (text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** "Jardines Urbanos" + "Xavier Mora" → "Jardines Urbanos. Xavier Mora" */
function joinClient(company: string | null, name: string): string {
  const c = (company ?? "").trim();
  const n = (name ?? "").trim();
  if (!c || c.toLowerCase() === n.toLowerCase()) return n || c;
  if (!n) return c;
  return `${c}${c.endsWith(".") ? "" : "."} ${n}`;
}

/**
 * El número se imprime tal como lo escribió el usuario. Solo los números
 * automáticos antiguos ("INV-2026-0263") se acortan a "263".
 */
export function displayNumber(number: string): string {
  const raw = (number ?? "").trim();
  const auto = raw.match(/^(?:COT|INV)-\d{4}-(\d+)$/);
  return auto ? String(parseInt(auto[1], 10)) : raw;
}

/** Montos como en los documentos originales: "$500.00". */
function docMoney(value: unknown, currency: string, locale: string): string {
  if (currency === "USD") {
    const n = num(value);
    const s = Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${n < 0 ? "-" : ""}$${s}`;
  }
  return formatMoney(value, currency, locale);
}
