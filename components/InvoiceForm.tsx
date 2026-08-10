"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LineItem, Invoice, CompanySettings, Client } from "@/types";
import { computeTotals, formatMoney, num } from "@/lib/format";

const blankItem: LineItem = { description: "", quantity: 1, unit_price: 0 };
function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.select();
}

type Props = {
  mode: "create" | "edit";
  invoice?: Invoice;
  settings: CompanySettings | null;
  clients: Client[];
};

/**
 * Crear o editar una factura. Se sigue generando la mayoria desde una
 * cotizacion aprobada, pero algunos clientes se facturan sin cotizar nunca
 * (comision recurrente sobre presupuesto, por ejemplo) — de ahi el modo
 * "create" en blanco, sin quote_id.
 */
export default function InvoiceForm({ mode, invoice, settings, clients }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const currency = settings?.currency ?? "USD";
  const locale = settings?.locale ?? "es-PA";
  const money = (v: number) => formatMoney(v, currency, locale);

  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoice_number ?? "");
  const [clientId, setClientId] = useState<string | null>(invoice?.client_id ?? null);
  const [clientName, setClientName] = useState(invoice?.client_name ?? "");
  const [clientCompany, setClientCompany] = useState(invoice?.client_company ?? "");
  const [clientEmail, setClientEmail] = useState(invoice?.client_email ?? "");
  const [clientPhone, setClientPhone] = useState(invoice?.client_phone ?? "");
  const [dueDate, setDueDate] = useState(invoice?.due_date?.slice(0, 10) ?? "");
  const [projectName, setProjectName] = useState(invoice?.project_name ?? "");
  const [projectDescription, setProjectDescription] = useState(invoice?.project_description ?? "");
  const [paymentMethod, setPaymentMethod] = useState(invoice?.payment_method ?? "");
  const [taxRate, setTaxRate] = useState<number>(
    invoice ? num(invoice.tax_rate) : num(settings?.default_tax_rate ?? 7)
  );
  const [notes, setNotes] = useState(invoice?.notes ?? settings?.default_notes ?? "");
  const [items, setItems] = useState<LineItem[]>(
    invoice?.items?.length ? invoice.items : [{ ...blankItem }]
  );

  const [requiresDgi, setRequiresDgi] = useState(invoice?.requires_dgi ?? false);
  const [dgiNumber, setDgiNumber] = useState(invoice?.dgi_invoice_number ?? "");
  const [dgiDate, setDgiDate] = useState(invoice?.dgi_issued_at?.slice(0, 10) ?? "");

  const [saveToDirectory, setSaveToDirectory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { subtotal, taxAmount, total } = useMemo(
    () => computeTotals(items, taxRate),
    [items, taxRate]
  );

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { ...blankItem }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  /** Al elegir un cliente guardado se rellenan sus datos, incluida su
   *  preferencia de DGI — sin que eso cambie lo guardado en el directorio. */
  function applyClient(name: string) {
    setClientName(name);
    const match = clients.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!match) {
      setClientId(null);
      return;
    }
    setClientId(match.id);
    setClientCompany(match.company ?? "");
    setClientEmail(match.email ?? "");
    setClientPhone(match.phone ?? "");
    setRequiresDgi(match.requires_dgi_default);
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
    if (mode === "create" && !clientName.trim()) {
      setError("Escribe el nombre del cliente.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      client_name: clientName.trim(),
      client_company: clientCompany.trim() || null,
      client_email: clientEmail.trim() || null,
      client_phone: clientPhone.trim() || null,
      due_date: dueDate || null,
      project_name: projectName.trim() || null,
      project_description: projectDescription.trim() || null,
      payment_method: paymentMethod.trim() || null,
      items: cleanItems,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      notes: notes.trim() || null,
      requires_dgi: requiresDgi,
      dgi_invoice_number: dgiNumber.trim() || null,
      dgi_issued_at: dgiDate || null,
    };

    if (mode === "edit" && invoice) {
      const trimmedNumber = invoiceNumber.trim();
      if (!trimmedNumber) {
        setError("El número de factura no puede quedar vacío.");
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("invoices")
        .update({ ...payload, invoice_number: trimmedNumber })
        .eq("id", invoice.id);

      if (updateError) {
        const duplicate = updateError.code === "23505";
        setError(
          duplicate
            ? "Ya tienes otra factura con ese número. Usa uno distinto."
            : "No se pudo guardar. " + updateError.message
        );
        setSaving(false);
        return;
      }

      router.push(`/invoices/${invoice.id}`);
      router.refresh();
      return;
    }

    // Modo crear: factura suelta, sin cotizacion — para clientes que se
    // facturan directo (comision recurrente, por ejemplo).
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Tu sesión expiró. Vuelve a iniciar sesión.");
      setSaving(false);
      return;
    }

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
          requires_dgi_default: requiresDgi,
        })
        .select("id")
        .single();
      if (newClient) resolvedClientId = newClient.id;
    }

    let finalNumber = invoiceNumber.trim();
    if (!finalNumber) {
      const { data: generated, error: numberError } = await supabase.rpc(
        "next_document_number",
        { p_prefix: "INV" }
      );
      if (numberError || !generated) {
        setError("No se pudo asignar el número de factura. " + (numberError?.message ?? ""));
        setSaving(false);
        return;
      }
      finalNumber = generated;
    }

    const { data, error: insertError } = await supabase
      .from("invoices")
      .insert({
        ...payload,
        quote_id: null,
        client_id: resolvedClientId,
        user_id: user.id,
        invoice_number: finalNumber,
        status: "pendiente",
      })
      .select("id")
      .single();

    if (insertError || !data) {
      const duplicate = insertError?.code === "23505";
      setError(
        duplicate
          ? "Ya tienes otra factura con ese número. Usa uno distinto o déjalo vacío."
          : "No se pudo guardar la factura. " + (insertError?.message ?? "")
      );
      setSaving(false);
      return;
    }

    router.push(`/invoices/${data.id}`);
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
            <label className="field-label" htmlFor="invoiceNumber">Número de factura</label>
            <input
              id="invoiceNumber"
              className="field-input font-mono"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder={mode === "create" ? "Se genera automático si lo dejas vacío" : undefined}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="dueDate">Vence</label>
            <input
              id="dueDate"
              type="date"
              className="field-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
          Cliente
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="clientName">Nombre del cliente *</label>
            {mode === "create" ? (
              <>
                <input
                  id="clientName"
                  required
                  className="field-input"
                  list="invoice-client-list"
                  autoComplete="off"
                  value={clientName}
                  onChange={(e) => applyClient(e.target.value)}
                  placeholder={clients.length ? "Escribe o elige uno guardado" : ""}
                />
                <datalist id="invoice-client-list">
                  {clients.map((c) => (
                    <option key={c.id} value={c.name}>{c.company ?? ""}</option>
                  ))}
                </datalist>
                {clientId && <p className="text-xs text-forest mt-1">Datos cargados del directorio.</p>}
              </>
            ) : (
              <input
                id="clientName"
                required
                className="field-input"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="clientCompany">Empresa</label>
            <input id="clientCompany" className="field-input" value={clientCompany}
              onChange={(e) => setClientCompany(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="clientEmail">Correo</label>
            <input id="clientEmail" type="email" inputMode="email" className="field-input"
              value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="clientPhone">Teléfono</label>
            <input id="clientPhone" type="tel" inputMode="tel" className="field-input"
              value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
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
            <input id="projectName" className="field-input" value={projectName}
              onChange={(e) => setProjectName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="projectDescription">Descripción</label>
            <input id="projectDescription" className="field-input" value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
            Conceptos
          </h2>
        </div>

        <ul className="space-y-4 sm:space-y-3">
          {items.map((item, i) => {
            const lineTotal = num(item.quantity) * num(item.unit_price);
            return (
              <li
                key={i}
                className="rounded-sm border border-line p-3 sm:border-0 sm:p-0
                           sm:grid sm:grid-cols-12 sm:gap-2 sm:items-end"
              >
                <div className="sm:col-span-5 mb-3 sm:mb-0">
                  {i === 0 && <span className="field-label hidden sm:block">Descripción</span>}
                  <label className="field-label sm:hidden">Descripción</label>
                  <input className="field-input" value={item.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:contents">
                  <div className="sm:col-span-2">
                    {i === 0 && <span className="field-label hidden sm:block">Cant.</span>}
                    <label className="field-label sm:hidden">Cantidad</label>
                    <input type="number" min={0} step="any" inputMode="decimal"
                      className="field-input text-right tabular-nums" value={item.quantity}
                      onFocus={selectOnFocus}
                      onChange={(e) => updateItem(i, { quantity: num(e.target.value) })} />
                  </div>
                  <div className="sm:col-span-2">
                    {i === 0 && <span className="field-label hidden sm:block">Precio</span>}
                    <label className="field-label sm:hidden">Precio unitario</label>
                    <input type="number" min={0} step="any" inputMode="decimal"
                      className="field-input text-right tabular-nums" value={item.unit_price}
                      onFocus={selectOnFocus}
                      onChange={(e) => updateItem(i, { unit_price: num(e.target.value) })} />
                  </div>
                </div>
                <div className="flex items-center justify-between sm:col-span-3 sm:justify-end sm:gap-2 mt-3 sm:mt-0">
                  <div className="sm:text-right sm:flex-1 sm:pb-2">
                    {i === 0 && <span className="field-label hidden sm:block">Importe</span>}
                    <span className="sm:hidden text-xs uppercase tracking-wide text-slate mr-2">Importe</span>
                    <span className="font-mono text-sm text-ink tabular-nums">{money(lineTotal)}</span>
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)}
                      className="text-slate hover:text-brick text-sm px-2 sm:pb-2"
                      aria-label={`Eliminar concepto ${i + 1}`}>✕</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <button type="button" onClick={addItem} className="btn-secondary text-xs py-1.5 mt-4">
          + Agregar ítem
        </button>

        <div className="mt-6 flex justify-end">
          <dl className="w-full sm:w-64 space-y-2">
            <div className="flex items-center justify-between text-sm text-slate">
              <dt>Subtotal</dt>
              <dd className="font-mono text-ink tabular-nums">{money(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between text-sm text-slate gap-3">
              <dt><label htmlFor="taxRate">Impuesto %</label></dt>
              <dd>
                <input id="taxRate" type="number" min={0} max={100} step="any" inputMode="decimal"
                  className="field-input w-24 text-right tabular-nums py-1.5" value={taxRate}
                  onFocus={selectOnFocus} onChange={(e) => setTaxRate(num(e.target.value))} />
              </dd>
            </div>
            <div className="flex items-center justify-between font-semibold text-ink border-t border-line pt-2">
              <dt>Total</dt>
              <dd className="font-mono tabular-nums">{money(total)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={requiresDgi}
            onChange={(e) => setRequiresDgi(e.target.checked)}
            className="rounded border-line"
          />
          Este cliente pidió factura fiscal (DGI) para esta factura
        </label>

        {requiresDgi && (
          <div className="grid sm:grid-cols-2 gap-4 pl-6 border-l-2 border-line">
            <div>
              <label className="field-label" htmlFor="dgiNumber">Número de factura fiscal</label>
              <input id="dgiNumber" className="field-input font-mono" value={dgiNumber}
                onChange={(e) => setDgiNumber(e.target.value)}
                placeholder="Cuando la emitas en el facturador de la DGI" />
            </div>
            <div>
              <label className="field-label" htmlFor="dgiDate">Fecha de emisión</label>
              <input id="dgiDate" type="date" className="field-input" value={dgiDate}
                onChange={(e) => setDgiDate(e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <label className="field-label" htmlFor="paymentMethod">Método de pago</label>
          <input id="paymentMethod" className="field-input" value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            placeholder="Ej. Transferencia, Yappy, tarjeta…" />
        </div>
        <div>
          <label className="field-label" htmlFor="notes">Notas</label>
          <textarea id="notes" className="field-input min-h-24" value={notes}
            onChange={(e) => setNotes(e.target.value)} />
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-brick">{error}</p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <Link href={mode === "edit" && invoice ? `/invoices/${invoice.id}` : "/invoices"} className="btn-secondary sm:w-auto">
          Cancelar
        </Link>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Generar factura"}
        </button>
      </div>
    </form>
  );
}
