/**
 * Diseño editable de cotizaciones y facturas (página "Diseño").
 * Se guarda en company_settings.doc_design (jsonb). Lo que no esté guardado
 * toma el valor por defecto, que reproduce el diseño original de dmc.
 */

export type DocFont = "helvetica" | "montserrat" | "arial" | "inter" | "georgia";
export type LineStyle = "solid" | "dashed" | "dotted" | "none";

export type DocDesign = {
  font: DocFont;
  colors: {
    accent: string; // líneas superior e inferior
    number: string; // número del documento
    numberBorder: string; // recuadro del número
    title: string; // "COTIZACIÓN"
    issuer: string; // nombre y datos del emisor
    clientQuote: string; // Cliente / Proyecto / Fecha (cotización)
    clientInvoice: string; // Cliente / RUC / Dirección / Fecha (factura)
    text: string; // conceptos, totales, pie
    headerBg: string; // fondo del encabezado de tabla
    headerText: string; // texto del encabezado de tabla
    lines: string; // líneas internas de la tabla
    strongLines: string; // líneas de totales
    edges: string; // bordes exteriores de la tabla
    bullets: string; // viñetas
  };
  sizes: {
    issuerNameInvoice: number;
    issuerNameQuote: number;
    issuerInfo: number;
    title: number;
    number: number;
    client: number;
    tableHeader: number;
    itemQuote: number;
    itemInvoice: number;
    amounts: number;
    totalQuote: number;
    totalInvoice: number;
    small: number; // forma de pago, detalles, notas
    footer: number;
    logoWidth: number;
  };
  table: {
    lineStyle: LineStyle;
    lineWidth: number;
    strongLineWidth: number;
    accentWidth: number;
    /** Anchos relativos de las columnas de la cotización */
    colDescription: number;
    colQty: number;
    colUnit: number;
    colCost: number;
    /** % del ancho que ocupa DETALLE en la factura */
    invoiceDetailPct: number;
    emptyRows: number;
  };
  texts: {
    quoteTitle: string;
    invoiceTitle: string;
    clientLabel: string;
    projectLabel: string;
    dateLabel: string;
    rucLabel: string;
    addressLabel: string;
    colDescription: string;
    colQty: string;
    colUnit: string;
    colCost: string;
    colDetail: string;
    colTotal: string;
    subtotal: string;
    tax: string;
    total: string;
    quoteDetails: string;
    paymentTitle: string;
    blank: string;
  };
  show: {
    logo: boolean;
    issuerInfo: boolean;
    qtyColumn: boolean;
    unitColumn: boolean;
    taxRow: boolean;
    pageNumber: boolean;
    footerAddress: boolean;
    accentLines: boolean;
  };
};

export const DEFAULT_DESIGN: DocDesign = {
  font: "helvetica",
  colors: {
    accent: "#fadd10",
    number: "#c00000",
    numberBorder: "#000000",
    title: "#000000",
    issuer: "#535f65",
    clientQuote: "#535f65",
    clientInvoice: "#000000",
    text: "#000000",
    headerBg: "#000000",
    headerText: "#ffffff",
    lines: "#adadad",
    strongLines: "#000000",
    edges: "#e4e4e4",
    bullets: "#808785",
  },
  sizes: {
    issuerNameInvoice: 20,
    issuerNameQuote: 16,
    issuerInfo: 10,
    title: 20,
    number: 16,
    client: 12,
    tableHeader: 10,
    itemQuote: 10,
    itemInvoice: 13,
    amounts: 12,
    totalQuote: 15,
    totalInvoice: 14,
    small: 10,
    footer: 10,
    logoWidth: 206,
  },
  table: {
    lineStyle: "solid",
    lineWidth: 0.5,
    strongLineWidth: 1,
    accentWidth: 2.5,
    colDescription: 252,
    colQty: 52.7,
    colUnit: 63.8,
    colCost: 78.5,
    invoiceDetailPct: 75.7,
    emptyRows: 2,
  },
  texts: {
    quoteTitle: "COTIZACIÓN",
    invoiceTitle: "",
    clientLabel: "Cliente",
    projectLabel: "Proyecto",
    dateLabel: "Fecha",
    rucLabel: "RUC",
    addressLabel: "Dirección",
    colDescription: "Descripción",
    colQty: "Cantidad",
    colUnit: "Precio unit.",
    colCost: "Costo",
    colDetail: "DETALLE",
    colTotal: "TOTAL",
    subtotal: "Subtotal",
    tax: "ITBMS",
    total: "TOTAL",
    quoteDetails: "Detalles de la cotización:",
    paymentTitle: "Forma de pago:",
    blank: "____",
  },
  show: {
    logo: true,
    issuerInfo: true,
    qtyColumn: true,
    unitColumn: true,
    taxRow: true,
    pageNumber: true,
    footerAddress: true,
    accentLines: true,
  },
};

export const FONT_OPTIONS: { key: DocFont; label: string; css: string }[] = [
  { key: "helvetica", label: "Helvetica Neue (original)", css: '"Helvetica Neue", var(--font-mono), Helvetica, Arial, sans-serif' },
  { key: "montserrat", label: "Montserrat (dmc)", css: "Montserrat, Arial, sans-serif" },
  { key: "inter", label: "Inter", css: "var(--font-mono), Inter, Arial, sans-serif" },
  { key: "arial", label: "Arial", css: "Arial, Helvetica, sans-serif" },
  { key: "georgia", label: "Georgia (serif)", css: "Georgia, 'Times New Roman', serif" },
];

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Mezcla lo guardado con los valores por defecto, descartando valores inválidos. */
export function resolveDesign(raw: unknown): DocDesign {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = JSON.parse(JSON.stringify(DEFAULT_DESIGN)) as DocDesign;

  if (typeof src.font === "string" && FONT_OPTIONS.some((f) => f.key === src.font)) {
    out.font = src.font as DocFont;
  }
  const group = <K extends keyof DocDesign>(key: K) =>
    (src[key] && typeof src[key] === "object" ? src[key] : {}) as Record<string, unknown>;

  const colors = group("colors");
  for (const k of Object.keys(out.colors) as (keyof DocDesign["colors"])[]) {
    const v = colors[k];
    if (typeof v === "string" && HEX.test(v)) out.colors[k] = v;
  }
  const sizes = group("sizes");
  for (const k of Object.keys(out.sizes) as (keyof DocDesign["sizes"])[]) {
    const v = Number(sizes[k]);
    if (Number.isFinite(v) && v > 0 && v <= 400) out.sizes[k] = v;
  }
  const table = group("table");
  for (const k of Object.keys(out.table) as (keyof DocDesign["table"])[]) {
    const v = table[k];
    if (k === "lineStyle") {
      if (v === "solid" || v === "dashed" || v === "dotted" || v === "none") out.table.lineStyle = v;
    } else {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 1000) (out.table[k] as number) = n;
    }
  }
  out.table.invoiceDetailPct = Math.min(90, Math.max(40, out.table.invoiceDetailPct));
  out.table.emptyRows = Math.min(10, Math.round(out.table.emptyRows));
  const texts = group("texts");
  for (const k of Object.keys(out.texts) as (keyof DocDesign["texts"])[]) {
    const v = texts[k];
    if (typeof v === "string") out.texts[k] = v.slice(0, 120);
  }
  const show = group("show");
  for (const k of Object.keys(out.show) as (keyof DocDesign["show"])[]) {
    if (typeof show[k] === "boolean") out.show[k] = show[k] as boolean;
  }
  return out;
}

/** Variables CSS que consume el bloque `.doc` de globals.css. */
export function designVars(d: DocDesign): Record<string, string> {
  const font = FONT_OPTIONS.find((f) => f.key === d.font)?.css ?? FONT_OPTIONS[0].css;
  const pt = (n: number) => `${n}pt`;
  const lineStyle = d.table.lineStyle === "none" ? "solid" : d.table.lineStyle;
  const lineW = d.table.lineStyle === "none" ? 0 : d.table.lineWidth;
  return {
    "--doc-font": font,
    "--doc-yellow": d.colors.accent,
    "--doc-accent-w": d.show.accentLines ? pt(d.table.accentWidth) : "0pt",
    "--doc-number": d.colors.number,
    "--doc-numbox-border": d.colors.numberBorder,
    "--doc-title": d.colors.title,
    "--doc-grey": d.colors.issuer,
    "--doc-client-q": d.colors.clientQuote,
    "--doc-client-i": d.colors.clientInvoice,
    "--doc-text": d.colors.text,
    "--doc-head-bg": d.colors.headerBg,
    "--doc-head-fg": d.colors.headerText,
    "--doc-dots": d.colors.lines,
    "--doc-strong": d.colors.strongLines,
    "--doc-edge": d.colors.edges,
    "--doc-bullet": d.colors.bullets,
    "--doc-line": `${pt(lineW)} ${lineStyle} ${d.colors.lines}`,
    "--doc-strong-line": `${pt(d.table.strongLineWidth)} solid ${d.colors.strongLines}`,
    "--fs-issuer-i": pt(d.sizes.issuerNameInvoice),
    "--fs-issuer-q": pt(d.sizes.issuerNameQuote),
    "--fs-info": pt(d.sizes.issuerInfo),
    "--fs-title": pt(d.sizes.title),
    "--fs-number": pt(d.sizes.number),
    "--fs-client": pt(d.sizes.client),
    "--fs-th": pt(d.sizes.tableHeader),
    "--fs-item-q": pt(d.sizes.itemQuote),
    "--fs-item-i": pt(d.sizes.itemInvoice),
    "--fs-amount": pt(d.sizes.amounts),
    "--fs-total-q": pt(d.sizes.totalQuote),
    "--fs-total-i": pt(d.sizes.totalInvoice),
    "--fs-small": pt(d.sizes.small),
    "--fs-footer": pt(d.sizes.footer),
    "--logo-w": pt(d.sizes.logoWidth),
    "--inv-detail": String(d.table.invoiceDetailPct),
    "--inv-total": String(100 - d.table.invoiceDetailPct),
    "--inv-cols": `minmax(0, ${d.table.invoiceDetailPct}fr) minmax(0, ${100 - d.table.invoiceDetailPct}fr)`,
  };
}
