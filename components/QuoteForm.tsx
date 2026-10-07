"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ItemRow from "@/components/ItemRow";
import { LineItem, Quote, CompanySettings, Client, Service } from "@/types";
import { computeTotals, formatMoney, num } from "@/lib/format";
import { lastUsedNumber } from "@/lib/documentNumber";

const blankItem: LineItem = { description: "", quantity: 1, unit_price: 0 };
/** Selecciona todo el texto al enfocar: el "0" inicial no estorba, se
 *  reemplaza en cuanto se empieza a escribir. */
function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.select();
}

type Props = {
  mode: "create" | "edit";
  quote?: Quote;
  settings: CompanySettings | null;
  clients: Client[];
  services: Service[];
};

export default function QuoteForm({ mode, quote, settings, clients, services }: Props) {
  const router = useRouter();
  const supabase = createClient();
  // Numeración manual: solo se muestra cuál fue la última como referencia.
  const [lastNumber, setLastNumber] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== "create") return;
    lastUsedNumber(supabase, "quote").then(setLastNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const currency = settings?.currency ?? "USD";
  const locale = settings?.locale ?? "es-PA";
  const money = (v: number) => formatMoney(v, currency, locale);

  const [quoteNumber, setQuoteNumber] = useState(quote?.quote_number ?? "");
  const [clientName, setClientName] = useState(quote?.client_name ?? "");
  const [clientCompany, setClientCompany] = useState(quote?.client_company ?? "");
  const [clientEmail, setClientEmail] = useState(quote?.client_email ?? "");
  const [clientPhone, setClientPhone] = useState(quote?.client_phone ?? "");
  const [validUntil, setValidUntil] = useState(quote?.valid_until?.slice(0, 10) ?? "");
  const [projectName, setProjectName] = useState(quote?.project_name ?? "");
  const [projectDescription, setProjectDescription] = useState(quote?.project_description ?? "");
  const [taxRate, setTaxRate] = useState<number>(
    quote ? num(quote.tax_rate) : num(settings?.default_tax_rate ?? 7)
  );
  const [notes, setNotes] = useState(quote?.notes ?? settings?.default_notes ?? "");
  const [items, setItems] = useState<LineItem[]>(
    quote?.items?.length ? quote.items : [{ ...blankItem }]
  );

  const [clientId, setClientId] = useState<string | null>(quote?.client_id ?? null);
  const [saveToDirectory, setSaveToDirectory] = useState(true);
  const [isRetainer, setIsRetainer] = useState(quote?.is_retainer ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickService, setPickService] = useState("");

  const { subtotal, taxAmount, total } = useMemo(
    () => computeTotals(items, taxRate),
    [items, taxRate]
  );

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  /** Al elegir un cliente guardado se rellenan sus datos de contacto. */
  function applyClient(name: string) {
    setClientName(name);
    const match = clients.find(
      (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (!match) {
      setClientId(null);
      return;
    }
    setClientId(match.id);
    setClientCompany(match.company ?? "");
    setClientEmail(match.email ?? "");
    setClientPhone(match.phone ?? "");
  }

  /** Inserta un servicio del catálogo como concepto, con su precio guardado. */
  function addFromCatalog(id: string) {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    setItems((prev) => {
      const line = { description: svc.name, quantity: 1, unit_price: num(svc.unit_price) };
      const onlyBlank =
        prev.length === 1 && !prev[0].description.trim() && !num(prev[0].unit_price);
      return onlyBlank ? [line] : [...prev, line];
    });
    setPickService("");
  }

  function addItem() {
    setItems((prev) => [...prev, { ...blankItem }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const cleanItems = items
      .map((it) => ({
        description: it.description.trim(),
        quantity: num(it.quantity),
        unit_price: num(it.unit_price),
      }))
      .filter((it) => it.description !== "");

    if (cleanItems.length === 0) {
      setError("Agrega al menos un concepto con descripción.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      client_id: clientId,
      client_name: clientName.trim(),
      client_company: clientCompany.trim() || null,
      client_email: clientEmail.trim() || null,
      client_phone: clientPhone.trim() || null,
      project_name: projectName.trim() || null,
      project_description: projectDescription.trim() || null,
      is_retainer: isRetainer,
      items: cleanItems,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      notes: notes.trim() || null,
      valid_until: validUntil || null,
    };

    if (mode === "edit" && quote) {
      const trimmedNumber = quoteNumber.trim();
      if (!trimmedNumber) {
        setError("El número de cotización no puede quedar vacío.");
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("quotes")
        .update({ ...payload, quote_number: trimmedNumber })
        .eq("id", quote.id);

      if (updateError) {
        // 23505 = ya existe otra cotizacion tuya con ese mismo numero
        const duplicate = updateError.code === "23505";
        setError(
          duplicate
            ? "Ya tienes otra cotización con ese número. Usa uno distinto."
            : "No se pudo guardar. " + updateError.message
        );
        setSaving(false);
        return;
      }

      router.push(`/quotes/${quote.id}`);
      router.refresh();
      return;
    }

    if (!quoteNumber.trim()) {
      setError("Escribe el número de cotización.");
      setSaving(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Tu sesión expiró. Vuelve a iniciar sesión.");
      setSaving(false);
      return;
    }

    // El directorio ya no se llena solo: se respeta la casilla.
    let resolvedClientId = clientId;
    if (!resolvedClientId && saveToDirectory && clientName.trim()) {
      const { data: newClient } = await supabase
        .from("clients")
        .insert({
          user_id: user.id,
          name: clientName.trim(),
          company: clientCompany.trim() || null,
          email: clientEmail.trim() || null,
          phone: clientPhone.trim() || null,
        })
        .select("id")
        .single();
      if (newClient) resolvedClientId = newClient.id;
    }

    const finalNumber = quoteNumber.trim();

    const { data, error: insertError } = await supabase
      .from("quotes")
      .insert({
        ...payload,
        client_id: resolvedClientId,
        user_id: user.id,
        quote_number: finalNumber,
        status: "pendiente",
      })
      .select("id")
      .single();

    if (insertError || !data) {
      const duplicate = insertError?.code === "23505";
      setError(
        duplicate
          ? "Ya tienes otra cotización con ese número. Usa uno distinto."
          : "No se pudo guardar la cotización. " + (insertError?.message ?? "")
      );
      setSaving(false);
      return;
    }

    // Retainer nuevo (no una actualizacion de fee, esas ya traen su grupo):
    // se apunta a si misma, asi queda como el origen de su propia cadena.
    if (isRetainer) {
      await supabase.from("quotes").update({ retainer_group_id: data.id }).eq("id", data.id);
    }

    router.push(`/quotes/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
          Documento
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="quoteNumber">Número de cotización</label>
            <input
              id="quoteNumber"
              className="field-input font-mono"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
              required
              placeholder={lastNumber ? `La última fue ${lastNumber}` : "Ej. 264"}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="validUntil">Válida hasta</label>
            <input
              id="validUntil"
              type="date"
              className="field-input"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>

        {mode === "create" && (
          <>
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={isRetainer}
                onChange={(e) => setIsRetainer(e.target.checked)}
                className="rounded border-line"
              />
              Es un retainer (se factura varias veces desde esta misma cotización)
            </label>
            <p className="text-xs text-slate -mt-2">
              Actívalo para clientes con fee mensual fijo. Vas a poder generar una factura cada
              mes desde esta cotización sin que te bloquee la regla de "una factura por
              cotización". Si el fee sube, usa "Actualizar fee" desde el detalle para crear la
              siguiente versión, enlazada a esta.
            </p>
          </>
        )}
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
          Cliente
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="clientName">
              Nombre del cliente *
            </label>
            <input
              id="clientName"
              required
              className="field-input"
              list="client-list"
              autoComplete="off"
              value={clientName}
              onChange={(e) => applyClient(e.target.value)}
              placeholder={clients.length ? "Escribe o elige uno guardado" : ""}
            />
            <datalist id="client-list">
              {clients.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.company ?? ""}
                </option>
              ))}
            </datalist>
            {clientId && (
              <p className="text-xs text-forest mt-1">Datos cargados del directorio.</p>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="clientCompany">Empresa</label>
            <input
              id="clientCompany"
              className="field-input"
              value={clientCompany}
              onChange={(e) => setClientCompany(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="clientEmail">Correo</label>
            <input
              id="clientEmail"
              type="email"
              inputMode="email"
              className="field-input"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="clientPhone">Teléfono</label>
            <input
              id="clientPhone"
              type="tel"
              inputMode="tel"
              className="field-input"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
            />
          </div>
        </div>

        {mode === "create" && !clientId && (
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={saveToDirectory}
              onChange={(e) => setSaveToDirectory(e.target.checked)}
              className="rounded border-line"
            />
            Guardar este cliente en el directorio
          </label>
        )}
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
          Proyecto <span className="normal-case font-normal text-slate">(opcional)</span>
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="projectName">Nombre del proyecto</label>
            <input
              id="projectName"
              className="field-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Ej. Rediseño de sitio web"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="projectDescription">Descripción</label>
            <input
              id="projectDescription"
              className="field-input"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-slate -mt-1">
          Se copia a la factura cuando apruebes esta cotización, y se puede editar ahí también.
        </p>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
            Conceptos
          </h2>
          {services.length > 0 && (
            <>
              <label className="sr-only" htmlFor="catalog">
                Insertar del catálogo
              </label>
              <select
                id="catalog"
                className="field-input w-auto text-xs py-1.5 min-h-8 cursor-pointer"
                value={pickService}
                onChange={(e) => addFromCatalog(e.target.value)}
              >
                <option value="">Del catálogo…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {money(num(s.unit_price))}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <ul className="space-y-4">
          {items.map((item, i) => (
            <ItemRow
              key={i}
              item={item}
              index={i}
              canRemove={items.length > 1}
              money={money}
              onChange={(patch) => updateItem(i, patch)}
              onRemove={() => removeItem(i)}
            />
          ))}
        </ul>

        <button
          type="button"
          onClick={addItem}
          className="btn-secondary text-xs py-1.5 mt-4"
        >
          + Agregar ítem
        </button>

        <div className="mt-6 flex justify-end">
          <dl className="w-full sm:w-64 space-y-2">
            <div className="flex items-center justify-between text-sm text-slate">
              <dt>Subtotal</dt>
              <dd className="font-mono text-ink tabular-nums">{money(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between text-sm text-slate gap-3">
              <dt>
                <label htmlFor="taxRate">Impuesto %</label>
              </dt>
              <dd>
                <input
                  id="taxRate"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  inputMode="decimal"
                  className="field-input w-24 text-right tabular-nums py-1.5"
                  value={taxRate}
                  onFocus={selectOnFocus}
                  onChange={(e) => setTaxRate(num(e.target.value))}
                />
              </dd>
            </div>
            <div className="flex items-center justify-between font-semibold text-ink border-t border-line pt-2">
              <dt>Total</dt>
              <dd className="font-mono tabular-nums">{money(total)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <label className="field-label" htmlFor="notes">
          Notas (condiciones, tiempos de entrega, forma de pago)
        </label>
        <textarea
          id="notes"
          className="field-input min-h-24"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>

      {error && (
        <p role="alert" className="text-sm text-brick">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <Link
          href={mode === "edit" && quote ? `/quotes/${quote.id}` : "/dashboard"}
          className="btn-secondary sm:w-auto"
        >
          Cancelar
        </Link>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving
            ? "Guardando…"
            : mode === "edit"
              ? "Guardar cambios"
              : "Generar cotización"}
        </button>
      </div>
    </form>
  );
}
