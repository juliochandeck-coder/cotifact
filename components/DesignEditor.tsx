"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DocumentTemplate from "@/components/DocumentTemplate";
import { CompanySettings, Quote, Invoice } from "@/types";
import { formatDateDMY, num } from "@/lib/format";
import {
  DocDesign,
  DEFAULT_DESIGN,
  FONT_OPTIONS,
  LineStyle,
  resolveDesign,
} from "@/lib/docDesign";

type Props = {
  company: CompanySettings | null;
  sampleQuote: Quote | null;
  sampleInvoice: Invoice | null;
};

type Section = "colores" | "tipografia" | "tabla" | "textos" | "elementos";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "colores", label: "Colores" },
  { key: "tipografia", label: "Tipografía y tamaños" },
  { key: "tabla", label: "Tabla y líneas" },
  { key: "textos", label: "Textos" },
  { key: "elementos", label: "Elementos visibles" },
];

const clone = (d: DocDesign): DocDesign => JSON.parse(JSON.stringify(d));

export default function DesignEditor({ company, sampleQuote, sampleInvoice }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const saved = useMemo(() => resolveDesign(company?.doc_design), [company?.doc_design]);
  const [design, setDesign] = useState<DocDesign>(() => clone(saved));
  const [preview, setPreview] = useState<"quote" | "invoice">("quote");
  const [open, setOpen] = useState<Section>("colores");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = JSON.stringify(design) !== JSON.stringify(saved);

  function set<G extends "colors" | "sizes" | "table" | "texts" | "show">(
    group: G,
    key: keyof DocDesign[G],
    value: DocDesign[G][keyof DocDesign[G]]
  ) {
    setDesign((d) => ({ ...d, [group]: { ...d[group], [key]: value } }));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMessage({ ok: false, text: "Tu sesión expiró. Vuelve a iniciar sesión." });
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("company_settings")
      .upsert({ user_id: user.id, doc_design: design }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      setMessage({
        ok: false,
        text: /doc_design/.test(error.message)
          ? "Falta un paso en Supabase: en SQL Editor corre el archivo supabase/migration_v10.sql y vuelve a guardar."
          : "No se pudo guardar. " + error.message,
      });
      return;
    }
    setMessage({ ok: true, text: "Diseño guardado. Ya se aplica a todas tus cotizaciones y facturas." });
    router.refresh();
  }

  function restoreOriginal() {
    setDesign(clone(DEFAULT_DESIGN));
    setMessage({ ok: true, text: "Se restauró el diseño original. Pulsa Guardar para aplicarlo." });
  }

  const c = design.colors;
  const s = design.sizes;
  const tb = design.table;
  const tx = design.texts;
  const sh = design.show;

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start">
      {/* ---------------- Controles ---------------- */}
      <div className="space-y-3">
        <div className="card p-4 flex flex-wrap items-center gap-2">
          <button onClick={save} disabled={saving || !dirty} className="btn-primary">
            {saving ? "Guardando…" : dirty ? "Guardar diseño" : "Guardado"}
          </button>
          <button onClick={() => setDesign(clone(saved))} disabled={!dirty} className="btn-secondary">
            Descartar cambios
          </button>
          <button onClick={restoreOriginal} className="btn-ghost text-xs">
            Restaurar original
          </button>
          {message && (
            <p role="status" className={`w-full text-xs ${message.ok ? "text-forest" : "text-brick"}`}>
              {message.text}
            </p>
          )}
        </div>

        {SECTIONS.map((sec) => (
          <section key={sec.key} className="card">
            <button
              type="button"
              onClick={() => setOpen(open === sec.key ? ("" as Section) : sec.key)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              aria-expanded={open === sec.key}
            >
              <span className="font-display font-semibold text-sm text-ink uppercase tracking-wide">
                {sec.label}
              </span>
              <span className="text-slate">{open === sec.key ? "–" : "+"}</span>
            </button>

            {open === sec.key && (
              <div className="px-4 pb-4 space-y-3 border-t border-line pt-3">
                {sec.key === "colores" && (
                  <>
                    <ColorField label="Líneas amarillas (arriba y pie)" value={c.accent} onChange={(v) => set("colors", "accent", v)} />
                    <ColorField label="Número del documento" value={c.number} onChange={(v) => set("colors", "number", v)} />
                    <ColorField label="Recuadro del número" value={c.numberBorder} onChange={(v) => set("colors", "numberBorder", v)} />
                    <ColorField label="Título (COTIZACIÓN)" value={c.title} onChange={(v) => set("colors", "title", v)} />
                    <ColorField label="Tu nombre y datos" value={c.issuer} onChange={(v) => set("colors", "issuer", v)} />
                    <ColorField label="Datos del cliente (cotización)" value={c.clientQuote} onChange={(v) => set("colors", "clientQuote", v)} />
                    <ColorField label="Datos del cliente (factura)" value={c.clientInvoice} onChange={(v) => set("colors", "clientInvoice", v)} />
                    <ColorField label="Texto general" value={c.text} onChange={(v) => set("colors", "text", v)} />
                    <ColorField label="Fondo del encabezado de tabla" value={c.headerBg} onChange={(v) => set("colors", "headerBg", v)} />
                    <ColorField label="Texto del encabezado de tabla" value={c.headerText} onChange={(v) => set("colors", "headerText", v)} />
                    <ColorField label="Líneas internas de la tabla" value={c.lines} onChange={(v) => set("colors", "lines", v)} />
                    <ColorField label="Líneas de totales" value={c.strongLines} onChange={(v) => set("colors", "strongLines", v)} />
                    <ColorField label="Bordes exteriores de la tabla" value={c.edges} onChange={(v) => set("colors", "edges", v)} />
                    <ColorField label="Viñetas" value={c.bullets} onChange={(v) => set("colors", "bullets", v)} />
                  </>
                )}

                {sec.key === "tipografia" && (
                  <>
                    <div>
                      <label className="field-label" htmlFor="font">Tipografía</label>
                      <select
                        id="font"
                        className="field-input"
                        value={design.font}
                        onChange={(e) => {
                          setDesign((d) => ({ ...d, font: e.target.value as DocDesign["font"] }));
                          setMessage(null);
                        }}
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-slate">Tamaños en puntos (pt), como en Word o Numbers.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <NumField label="Tu nombre (factura)" value={s.issuerNameInvoice} onChange={(v) => set("sizes", "issuerNameInvoice", v)} />
                      <NumField label="Tu nombre (cotización)" value={s.issuerNameQuote} onChange={(v) => set("sizes", "issuerNameQuote", v)} />
                      <NumField label="RUC, teléfono, e-mail" value={s.issuerInfo} onChange={(v) => set("sizes", "issuerInfo", v)} />
                      <NumField label="Título" value={s.title} onChange={(v) => set("sizes", "title", v)} />
                      <NumField label="Número" value={s.number} onChange={(v) => set("sizes", "number", v)} />
                      <NumField label="Datos del cliente" value={s.client} onChange={(v) => set("sizes", "client", v)} />
                      <NumField label="Encabezado de tabla" value={s.tableHeader} onChange={(v) => set("sizes", "tableHeader", v)} />
                      <NumField label="Conceptos (cotización)" value={s.itemQuote} onChange={(v) => set("sizes", "itemQuote", v)} />
                      <NumField label="Conceptos (factura)" value={s.itemInvoice} onChange={(v) => set("sizes", "itemInvoice", v)} />
                      <NumField label="Montos" value={s.amounts} onChange={(v) => set("sizes", "amounts", v)} />
                      <NumField label="TOTAL (cotización)" value={s.totalQuote} onChange={(v) => set("sizes", "totalQuote", v)} />
                      <NumField label="TOTAL (factura)" value={s.totalInvoice} onChange={(v) => set("sizes", "totalInvoice", v)} />
                      <NumField label="Forma de pago y detalles" value={s.small} onChange={(v) => set("sizes", "small", v)} />
                      <NumField label="Dirección al pie" value={s.footer} onChange={(v) => set("sizes", "footer", v)} />
                      <NumField label="Ancho del logo" value={s.logoWidth} step={2} onChange={(v) => set("sizes", "logoWidth", v)} />
                    </div>
                  </>
                )}

                {sec.key === "tabla" && (
                  <>
                    <div>
                      <label className="field-label" htmlFor="lineStyle">Estilo de las líneas internas</label>
                      <select
                        id="lineStyle"
                        className="field-input"
                        value={tb.lineStyle}
                        onChange={(e) => set("table", "lineStyle", e.target.value as LineStyle)}
                      >
                        <option value="solid">Continua</option>
                        <option value="dashed">Segmentada</option>
                        <option value="dotted">Punteada</option>
                        <option value="none">Sin líneas</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <NumField label="Grosor líneas internas" value={tb.lineWidth} step={0.25} onChange={(v) => set("table", "lineWidth", v)} />
                      <NumField label="Grosor líneas de totales" value={tb.strongLineWidth} step={0.25} onChange={(v) => set("table", "strongLineWidth", v)} />
                      <NumField label="Grosor líneas amarillas" value={tb.accentWidth} step={0.5} onChange={(v) => set("table", "accentWidth", v)} />
                      <NumField label="Filas vacías (cotización)" value={tb.emptyRows} step={1} unit="" onChange={(v) => set("table", "emptyRows", v)} />
                    </div>
                    <p className="text-xs text-slate pt-1">
                      Ancho de columnas de la cotización (proporciones: más alto = más ancho).
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <NumField label="Descripción" value={tb.colDescription} step={5} unit="" onChange={(v) => set("table", "colDescription", v)} />
                      <NumField label="Cantidad" value={tb.colQty} step={5} unit="" onChange={(v) => set("table", "colQty", v)} />
                      <NumField label="Precio unit." value={tb.colUnit} step={5} unit="" onChange={(v) => set("table", "colUnit", v)} />
                      <NumField label="Costo" value={tb.colCost} step={5} unit="" onChange={(v) => set("table", "colCost", v)} />
                    </div>
                    <NumField
                      label="Factura: ancho de DETALLE (% de la tabla)"
                      value={tb.invoiceDetailPct}
                      step={1}
                      unit="%"
                      onChange={(v) => set("table", "invoiceDetailPct", Math.min(90, Math.max(40, v)))}
                    />
                  </>
                )}

                {sec.key === "textos" && (
                  <>
                    <p className="text-xs text-slate">Deja un campo vacío para ocultar ese texto.</p>
                    <TextField label="Título de la cotización" value={tx.quoteTitle} onChange={(v) => set("texts", "quoteTitle", v)} />
                    <TextField label="Título de la factura (vacío = sin título)" value={tx.invoiceTitle} onChange={(v) => set("texts", "invoiceTitle", v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <TextField label="Cliente" value={tx.clientLabel} onChange={(v) => set("texts", "clientLabel", v)} />
                      <TextField label="Proyecto" value={tx.projectLabel} onChange={(v) => set("texts", "projectLabel", v)} />
                      <TextField label="Fecha" value={tx.dateLabel} onChange={(v) => set("texts", "dateLabel", v)} />
                      <TextField label="RUC" value={tx.rucLabel} onChange={(v) => set("texts", "rucLabel", v)} />
                      <TextField label="Dirección" value={tx.addressLabel} onChange={(v) => set("texts", "addressLabel", v)} />
                      <TextField label="Dato vacío" value={tx.blank} onChange={(v) => set("texts", "blank", v)} />
                      <TextField label="Columna Descripción" value={tx.colDescription} onChange={(v) => set("texts", "colDescription", v)} />
                      <TextField label="Columna Cantidad" value={tx.colQty} onChange={(v) => set("texts", "colQty", v)} />
                      <TextField label="Columna Precio unit." value={tx.colUnit} onChange={(v) => set("texts", "colUnit", v)} />
                      <TextField label="Columna Costo" value={tx.colCost} onChange={(v) => set("texts", "colCost", v)} />
                      <TextField label="Factura: DETALLE" value={tx.colDetail} onChange={(v) => set("texts", "colDetail", v)} />
                      <TextField label="Factura: TOTAL" value={tx.colTotal} onChange={(v) => set("texts", "colTotal", v)} />
                      <TextField label="Subtotal" value={tx.subtotal} onChange={(v) => set("texts", "subtotal", v)} />
                      <TextField label="Impuesto" value={tx.tax} onChange={(v) => set("texts", "tax", v)} />
                      <TextField label="Total" value={tx.total} onChange={(v) => set("texts", "total", v)} />
                    </div>
                    <TextField label="Título de notas (cotización)" value={tx.quoteDetails} onChange={(v) => set("texts", "quoteDetails", v)} />
                    <TextField label="Título de forma de pago (factura)" value={tx.paymentTitle} onChange={(v) => set("texts", "paymentTitle", v)} />
                  </>
                )}

                {sec.key === "elementos" && (
                  <>
                    <Toggle label="Logo" value={sh.logo} onChange={(v) => set("show", "logo", v)} />
                    <Toggle label="RUC, teléfono y e-mail" value={sh.issuerInfo} onChange={(v) => set("show", "issuerInfo", v)} />
                    <Toggle label="Columna Cantidad (cotización)" value={sh.qtyColumn} onChange={(v) => set("show", "qtyColumn", v)} />
                    <Toggle label="Columna Precio unit. (cotización)" value={sh.unitColumn} onChange={(v) => set("show", "unitColumn", v)} />
                    <Toggle label="Fila de impuesto (ITBMS)" value={sh.taxRow} onChange={(v) => set("show", "taxRow", v)} />
                    <Toggle label="Líneas amarillas" value={sh.accentLines} onChange={(v) => set("show", "accentLines", v)} />
                    <Toggle label="Dirección al pie" value={sh.footerAddress} onChange={(v) => set("show", "footerAddress", v)} />
                    <Toggle label="Número de página" value={sh.pageNumber} onChange={(v) => set("show", "pageNumber", v)} />
                  </>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* ---------------- Vista previa ---------------- */}
      <div className="lg:sticky lg:top-16 space-y-3">
        <div className="inline-flex rounded-sm border border-line bg-white p-0.5" role="tablist">
          {(["quote", "invoice"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={preview === k}
              onClick={() => setPreview(k)}
              className={`px-3 py-1.5 text-sm rounded-sm ${preview === k ? "bg-ink text-white" : "text-slate hover:text-ink"}`}
            >
              {k === "quote" ? "Cotización" : "Factura"}
            </button>
          ))}
        </div>
        <div className="bg-paper border border-line rounded-sm p-3 lg:max-h-[calc(100vh-9rem)] overflow-auto">
          {preview === "quote" ? (
            <DocumentTemplate {...quoteProps(sampleQuote)} company={company} design={design} />
          ) : (
            <DocumentTemplate {...invoiceProps(sampleInvoice)} company={company} design={design} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Datos de la vista previa ---------------- */

const SAMPLE_ITEMS = [
  {
    description:
      "Desarrollo de un diagnóstico de la presencia digital actual.\nIncluye:\n- Revisión de activos digitales y redes sociales.\n- Recomendaciones y próximos pasos.",
    quantity: 1,
    unit_price: 500,
  },
];

function quoteProps(q: Quote | null) {
  return {
    docLabel: "COTIZACIÓN" as const,
    number: q?.quote_number ?? "251",
    date: formatDateDMY(q?.created_at ?? new Date().toISOString()),
    clientName: q?.client_name ?? "Nombre del contacto",
    clientCompany: q ? q.client_company : "Empresa cliente",
    items: q?.items?.length ? q.items : SAMPLE_ITEMS,
    subtotal: num(q?.subtotal ?? 500),
    taxRate: num(q?.tax_rate ?? 0),
    taxAmount: num(q?.tax_amount ?? 0),
    total: num(q?.total ?? 500),
    notes: q?.notes ?? null,
    projectName: q?.project_name ?? "Nombre del proyecto",
    projectDescription: q?.project_description ?? null,
  };
}

function invoiceProps(i: Invoice | null) {
  return {
    docLabel: "FACTURA" as const,
    number: i?.invoice_number ?? "263",
    date: formatDateDMY(i?.created_at ?? new Date().toISOString()),
    clientName: i?.client_name ?? "Nombre del cliente",
    clientCompany: i?.client_company ?? null,
    items: i?.items?.length
      ? i.items
      : [{ description: "Gestión de contenido", quantity: 1, unit_price: 500 }],
    subtotal: num(i?.subtotal ?? 500),
    taxRate: num(i?.tax_rate ?? 0),
    taxAmount: num(i?.tax_amount ?? 0),
    total: num(i?.total ?? 500),
    notes: i?.notes ?? null,
    projectName: i?.project_name ?? "Mes y año",
    projectDescription: i?.project_description ?? null,
    paymentMethod: i?.payment_method ?? null,
  };
}

/* ---------------- Campos ---------------- */

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-11 shrink-0 cursor-pointer rounded-sm border border-line bg-white p-0.5"
        aria-label={label}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink leading-tight">{label}</p>
        {/* key={value}: se reinicia cuando el color cambia desde el selector o al restaurar */}
        <input
          key={value}
          className="mt-0.5 w-24 rounded-sm border border-line px-1.5 py-0.5 font-mono text-xs uppercase"
          defaultValue={value}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#([0-9a-fA-F]{6})$/.test(v)) onChange(v.toLowerCase());
          }}
          aria-label={`${label} (código hex)`}
        />
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 0.5,
  unit = "pt",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  unit?: string;
}) {
  return (
    <label className="block">
      <span className="field-label normal-case tracking-normal">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          step={step}
          min={0}
          className="field-input py-1.5 tabular-nums"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
        />
        {unit && <span className="text-xs text-slate w-5">{unit}</span>}
      </span>
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="field-label normal-case tracking-normal">{label}</span>
      <input className="field-input py-1.5" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-ink">{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#1D4ED8]"
      />
    </label>
  );
}
