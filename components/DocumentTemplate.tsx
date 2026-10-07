import { Fragment } from "react";
import { LineItem, CompanySettings } from "@/types";
import { formatMoney, num } from "@/lib/format";

/**
 * Plantilla de impresion de cotizaciones y facturas.
 *
 * Replica 1:1 los documentos de referencia (hoja carta, 612 x 792 pt):
 * todas las medidas de `globals.css` (bloque `.doc`) estan en puntos y salen
 * de las coordenadas exactas de los PDF originales.
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

  return (
    <div className="doc-scroll">
      <article
        className={`doc print-sheet ${props.docLabel === "FACTURA" ? "doc--invoice" : "doc--quote"}`}
        aria-label={`${props.docLabel} ${props.number}`}
      >
        <div className="doc-rule" />

        {props.docLabel === "FACTURA" ? (
          <InvoiceBody {...props} money={money} />
        ) : (
          <QuoteBody {...props} money={money} />
        )}

        <footer className="doc-footer">
          <div className="doc-rule" />
          {company?.company_address && (
            <p className="doc-address">{company.company_address}</p>
          )}
        </footer>
      </article>
    </div>
  );
}

type BodyProps = Props & { money: (v: unknown) => string };

/* ------------------------------------------------------------------ */
/* Encabezado: datos del emisor                                        */
/* ------------------------------------------------------------------ */

function Logo({ company }: { company?: CompanySettings | null }) {
  if (!company?.logo_url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="doc-logo" src={company.logo_url} alt={company.company_name ?? "Logo"} />
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
      {company?.company_name && (
        <p className="doc-issuer-name">{company.company_name.toUpperCase()}</p>
      )}
      <div className="doc-issuer-info">
        {company?.tax_id && <p>RUC: {company.tax_id}</p>}
        {company?.company_phone && <p>Teléfono: {company.company_phone}</p>}
        {company?.company_email && (
          <p>
            E-Mail:{" "}
            <span className={underlineEmail ? "doc-underline" : undefined}>
              {company.company_email}
            </span>
          </p>
        )}
      </div>
    </>
  );
}

function NumberBox({ number }: { number: string }) {
  return (
    <div className="doc-numbox">
      <span>{displayNumber(number)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FACTURA                                                             */
/* ------------------------------------------------------------------ */

function InvoiceBody(p: BodyProps) {
  const { money } = p;
  const items = p.items ?? [];
  const extraRows = (p.projectName ? 1 : 0) + (p.projectDescription ? 1 : 0);
  const [payTitle, ...payLines] = splitLines(p.paymentMethod);

  return (
    <>
      <div className="doc-head doc-head--invoice">
        <Logo company={p.company} />
        <NumberBox number={p.number} />
        <div className="doc-issuer">
          <IssuerInfo company={p.company} />
        </div>
      </div>

      <div className="doc-client doc-client--invoice">
        <div>
          <p>
            <b>Cliente</b>: {p.clientName || BLANK}
          </p>
          <p>
            <b>Dirección:</b> {p.clientAddress || BLANK}
          </p>
        </div>
        <div>
          <p>
            <b>RUC</b>: {p.clientTaxId || BLANK}
          </p>
          <p>
            <b>Fecha</b>: {p.date}
          </p>
        </div>
      </div>

      <div className="inv-table">
        <div className="inv-th">DETALLE</div>
        <div className="inv-th">TOTAL</div>

        <div
          className="inv-body"
          style={{ gridTemplateRows: `repeat(${items.length + extraRows}, auto) 1fr` }}
        >
          {items.map((item, i) => (
            <Fragment key={i}>
              <div className="inv-desc">
                <Description text={item.description} />
              </div>
              <div className="inv-amount">
                {money(num(item.quantity) * num(item.unit_price))}
              </div>
            </Fragment>
          ))}
          {p.projectName && (
            <>
              <div className="inv-project">{p.projectName}</div>
              <div className="inv-amount" />
            </>
          )}
          {p.projectDescription && (
            <>
              <div className="inv-project-desc">
                <Description text={p.projectDescription} />
              </div>
              <div className="inv-amount" />
            </>
          )}
          <div className="inv-desc inv-filler" />
          <div className="inv-amount inv-filler" />
        </div>
      </div>

      <div className="inv-bottom">
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
          <div className="inv-tl">Subtotal</div>
          <div className="inv-tv">{money(p.subtotal)}</div>
          <div className="inv-tl">ITBMS</div>
          <div className="inv-tv">{money(p.taxAmount)}</div>
          <div className="inv-tl inv-total">TOTAL</div>
          <div className="inv-tv inv-total">{money(p.total)}</div>
        </div>
      </div>
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
  const last = items.length - 1;

  return (
    <>
      <div className="doc-head doc-head--quote">
        <Logo company={p.company} />
        <p className="doc-title">COTIZACIÓN</p>
        <NumberBox number={p.number} />
        <div className="doc-issuer">
          <IssuerInfo company={p.company} underlineEmail />
        </div>
      </div>

      <div className="doc-client doc-client--quote">
        <p>
          <b>Cliente</b>: {client || BLANK}
        </p>
        {p.projectName && (
          <p>
            <b>Proyecto</b>: {p.projectName}
          </p>
        )}
        {p.projectDescription && <p className="doc-project-desc">{p.projectDescription}</p>}
        <p>
          <b>Fecha</b>: {p.date}
        </p>
      </div>

      <div
        className="q-table"
        style={{
          // Filas: encabezado, conceptos, 2 filas vacías, Subtotal, ITBMS, TOTAL
          gridTemplateRows: `21.9pt repeat(${Math.max(items.length, 1)}, auto) 25.4pt 25.6pt 25.6pt 25.7pt 28.9pt`,
        }}
      >
        <div className="q-th k1">Descripción</div>
        <div className="q-th k2">Cantidad</div>
        <div className="q-th k3">Precio unit.</div>
        <div className="q-th k4">Costo</div>

        {items.map((item, i) => {
          const isLast = i === last;
          const qty = num(item.quantity);
          return (
            <Fragment key={i}>
              {/* La descripción del último concepto ocupa también las dos filas vacías */}
              <div
                className={`q-desc k1 ${isLast ? "q-desc--last" : "q-sep"}`}
                style={isLast ? { gridRow: "span 3" } : undefined}
              >
                <Description text={item.description} />
              </div>
              <div className="q-num k2 q-sep">{qty}</div>
              <div className="q-num k3 q-sep">{qty !== 1 ? money(item.unit_price) : ""}</div>
              <div className="q-num k4 q-sep">{money(qty * num(item.unit_price))}</div>
            </Fragment>
          );
        })}

        {items.length === 0 && (
          <>
            <div className="q-desc q-desc--last k1" style={{ gridRow: "span 3" }} />
            <div className="q-num k2 q-sep" />
            <div className="q-num k3 q-sep" />
            <div className="q-num k4 q-sep" />
          </>
        )}

        {/* Dos filas vacías bajo los conceptos, como en la plantilla original */}
        <div className="q-filler k2 q-sep" />
        <div className="q-filler k3 q-sep" />
        <div className="q-filler k4 q-sep" />
        <div className="q-filler k2" />
        <div className="q-filler k3" />
        <div className="q-filler k4" />

        <div className="q-tot k1 q-solid q-sep" />
        <div className="q-tot k2 q-solid q-sep" />
        <div className="q-tot k3 q-solid q-sep q-tl">Subtotal</div>
        <div className="q-tot k4 q-solid q-sep q-tv">{money(p.subtotal)}</div>

        <div className="q-tot k1" />
        <div className="q-tot k2" />
        <div className="q-tot k3 q-tl">{num(p.taxAmount) !== 0 ? "ITBMS" : ""}</div>
        <div className="q-tot k4 q-tv">{money(p.taxAmount)}</div>

        <div className="q-tot q-tot--big k1 q-solid q-solid-b" />
        <div className="q-tot q-tot--big k2 q-solid q-solid-b" />
        <div className="q-tot q-tot--big k3 q-solid q-solid-b q-tl q-total">TOTAL</div>
        <div className="q-tot q-tot--big k4 q-solid q-solid-b q-tv q-total">{money(p.total)}</div>
      </div>

      <div className="q-details">
        <p className="q-details-title">Detalles de la cotización:</p>
        {p.notes && <p className="q-notes">{p.notes}</p>}
      </div>
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
