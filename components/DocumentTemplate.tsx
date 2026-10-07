import { Fragment } from "react";
import { LineItem, CompanySettings } from "@/types";
import { formatMoney, num } from "@/lib/format";
import DocFit from "@/components/DocFit";

/**
 * Plantilla de impresion de cotizaciones y facturas (diseño dmc).
 *
 * Todo el documento fluye con el contenido: no hay posiciones fijas, asi que
 * textos largos (nombre, proyecto, dirección, conceptos, forma de pago)
 * empujan lo de abajo en vez de encimarse o cortarse. Las medidas de
 * `globals.css` (bloque `.doc`) salen de los PDF de referencia.
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
  /** RUC y dirección del cliente (del directorio). Vacíos se imprimen como ____ */
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
};

const BLANK = "____";

export default function DocumentTemplate(props: Props) {
  const { company } = props;
  const currency = company?.currency ?? "USD";
  const locale = company?.locale ?? "es-PA";
  const money = (v: unknown) => docMoney(v, currency, locale);
  const isInvoice = props.docLabel === "FACTURA";

  return (
    <DocFit>
      <article
        className={`doc ${isInvoice ? "doc--invoice" : "doc--quote"}`}
        aria-label={`${props.docLabel} ${props.number}`}
      >
        <div className="doc-rule" />

        {isInvoice ? <InvoiceBody {...props} money={money} /> : <QuoteBody {...props} money={money} />}

        <footer className="doc-footer">
          <div className="doc-rule" />
          <p className="doc-address">{company?.company_address || ""}</p>
        </footer>
      </article>
    </DocFit>
  );
}

type BodyProps = Props & { money: (v: unknown) => string };

/* ------------------------------------------------------------------ */
/* Encabezado                                                          */
/* ------------------------------------------------------------------ */

function Logo({ company }: { company?: CompanySettings | null }) {
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
  underlineEmail,
}: {
  company?: CompanySettings | null;
  underlineEmail?: boolean;
}) {
  return (
    <>
      <p className="doc-issuer-name">{(company?.company_name ?? "").toUpperCase()}</p>
      <div className="doc-issuer-info">
        <p>RUC: {company?.tax_id || BLANK}</p>
        <p>Teléfono: {company?.company_phone || BLANK}</p>
        <p>
          E-Mail:{" "}
          <span className={underlineEmail ? "doc-underline" : undefined}>
            {company?.company_email || BLANK}
          </span>
        </p>
      </div>
    </>
  );
}

function NumberBox({ number }: { number: string }) {
  return <div className="doc-numbox">{displayNumber(number)}</div>;
}

/* ------------------------------------------------------------------ */
/* FACTURA                                                             */
/* ------------------------------------------------------------------ */

function InvoiceBody(p: BodyProps) {
  const { money } = p;
  const items = p.items ?? [];
  // La forma de pago de la factura, o la fija de Ajustes si la factura no trae una.
  const [payTitle, ...payLines] = splitLines(
    p.paymentMethod?.trim() ? p.paymentMethod : p.company?.default_payment_method
  );

  return (
    <>
      <header className="doc-head">
        <Logo company={p.company} />
        <div className="doc-head-right">
          <NumberBox number={p.number} />
          <IssuerInfo company={p.company} />
        </div>
      </header>

      <section className="inv-client">
        <p>
          <b>Cliente</b>: {p.clientName || BLANK}
        </p>
        <p>
          <b>RUC</b>: {p.clientTaxId || BLANK}
        </p>
        <p>
          <b>Dirección:</b> {p.clientAddress || BLANK}
        </p>
        <p>
          <b>Fecha</b>: {p.date}
        </p>
      </section>

      <section className="inv-table">
        <div className="inv-row inv-row--head">
          <div className="inv-c1">DETALLE</div>
          <div className="inv-c2">TOTAL</div>
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
          <p className="inv-pay-title">Forma de pago:</p>
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
            <div className="inv-tl">Subtotal</div>
            <div className="inv-tv">{money(p.subtotal)}</div>
          </div>
          <div className="inv-trow">
            <div className="inv-tl">ITBMS</div>
            <div className="inv-tv">{money(p.taxAmount)}</div>
          </div>
          <div className="inv-trow inv-trow--total">
            <div className="inv-tl">TOTAL</div>
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

function QuoteBody(p: BodyProps) {
  const { money } = p;
  const items = p.items ?? [];
  const client = joinClient(p.clientCompany, p.clientName);
  const rows = items.length ? items : [{ description: "", quantity: 0, unit_price: 0 }];

  return (
    <>
      <header className="doc-head">
        <Logo company={p.company} />
        <div className="doc-head-right">
          <div className="doc-titlerow">
            <p className="doc-title">COTIZACIÓN</p>
            <NumberBox number={p.number} />
          </div>
          <IssuerInfo company={p.company} underlineEmail />
        </div>
      </header>

      <section className="q-client">
        <p>
          <b>Cliente</b>: {client || BLANK}
        </p>
        <p>
          <b>Proyecto</b>: {p.projectName || BLANK}
        </p>
        {p.projectDescription && <p className="q-project-desc">{p.projectDescription}</p>}
        <p>
          <b>Fecha</b>: {p.date}
        </p>
      </section>

      <section
        className="q-table"
        style={{
          // encabezado, conceptos, 2 filas vacías, Subtotal, ITBMS, TOTAL
          gridTemplateRows: `auto repeat(${rows.length}, auto) 25.4pt 25.6pt 25.6pt 25.7pt 28.9pt`,
        }}
      >
        <div className="q-th k1">Descripción</div>
        <div className="q-th k2">Cantidad</div>
        <div className="q-th k3">Precio unit.</div>
        <div className="q-th k4">Costo</div>

        {rows.map((item, i) => {
          const qty = num(item.quantity);
          const empty = !items.length;
          const isLast = i === rows.length - 1;
          return (
            <Fragment key={i}>
              {/* La descripción del último concepto baja también por las dos filas vacías,
                  igual que en la plantilla original. */}
              <div
                className={`q-desc k1 ${isLast ? "q-desc--last" : "q-sep"}`}
                style={isLast ? { gridRow: "span 3" } : undefined}
              >
                <Description text={item.description} />
              </div>
              <div className="q-num k2 q-sep">{empty ? "" : qty}</div>
              <div className="q-num k3 q-sep">{empty || qty === 1 ? "" : money(item.unit_price)}</div>
              <div className="q-num k4 q-sep">{empty ? "" : money(qty * num(item.unit_price))}</div>
            </Fragment>
          );
        })}

        <div className="k2 q-sep" />
        <div className="k3 q-sep" />
        <div className="k4 q-sep" />
        <div className="k2" />
        <div className="k3" />
        <div className="k4" />

        <div className="q-tot k1 q-solid q-sep" />
        <div className="q-tot k2 q-solid q-sep" />
        <div className="q-tot k3 q-solid q-sep q-tl">Subtotal</div>
        <div className="q-tot k4 q-solid q-sep q-tv">{money(p.subtotal)}</div>

        <div className="q-tot k1" />
        <div className="q-tot k2" />
        <div className="q-tot k3 q-tl">{num(p.taxAmount) !== 0 ? "ITBMS" : ""}</div>
        <div className="q-tot k4 q-tv">{money(p.taxAmount)}</div>

        <div className="q-tot q-total k1 q-solid q-solid-b" />
        <div className="q-tot q-total k2 q-solid q-solid-b" />
        <div className="q-tot q-total k3 q-solid q-solid-b q-tl">TOTAL</div>
        <div className="q-tot q-total k4 q-solid q-solid-b q-tv">{money(p.total)}</div>
      </section>

      <section className="q-details">
        <p className="q-details-title">Detalles de la cotización:</p>
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
