"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, num } from "@/lib/format";
import { Client, Service, CompanySettings } from "@/types";

type Tab = "clients" | "services";

const emptyClient = { name: "", company: "", email: "", phone: "", tax_id: "", address: "", requires_dgi_default: false };

export default function DirectoryClient({
  initialClients,
  initialServices,
  company,
}: {
  initialClients: Client[];
  initialServices: Service[];
  company: CompanySettings | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("clients");
  const [clients, setClients] = useState(initialClients);
  const [services, setServices] = useState(initialServices);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currency = company?.currency ?? "USD";
  const locale = company?.locale ?? "es-PA";

  const [cForm, setCForm] = useState({ ...emptyClient });
  const [cEditing, setCEditing] = useState<string | null>(null);
  const [cOpen, setCOpen] = useState(false);

  const [sForm, setSForm] = useState({ name: "", unit_price: "" });
  const [sEditing, setSEditing] = useState<string | null>(null);

  async function saveClient() {
    if (!cForm.name.trim()) {
      setError("El nombre del cliente es obligatorio.");
      return;
    }
    setBusy(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Tu sesión expiró.");
      setBusy(false);
      return;
    }

    const payload = {
      name: cForm.name.trim(),
      company: cForm.company.trim() || null,
      email: cForm.email.trim() || null,
      phone: cForm.phone.trim() || null,
      tax_id: cForm.tax_id.trim() || null,
      address: cForm.address.trim() || null,
      requires_dgi_default: cForm.requires_dgi_default,
    };

    if (cEditing) {
      const { data, error } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", cEditing)
        .select()
        .single();
      if (error || !data) {
        setError(dupMsg(error?.code, "cliente"));
        setBusy(false);
        return;
      }
      setClients((p) => p.map((c) => (c.id === cEditing ? (data as Client) : c)).sort(byName));
    } else {
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...payload, user_id: user.id })
        .select()
        .single();
      if (error || !data) {
        setError(dupMsg(error?.code, "cliente"));
        setBusy(false);
        return;
      }
      setClients((p) => [...p, data as Client].sort(byName));
    }

    setCForm({ ...emptyClient });
    setCEditing(null);
    setCOpen(false);
    setBusy(false);
    router.refresh();
  }

  async function deleteClient(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name} del directorio? Sus cotizaciones no se borran.`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) {
      setError("No se pudo eliminar. " + error.message);
      return;
    }
    setClients((p) => p.filter((c) => c.id !== id));
    router.refresh();
  }

  async function saveService() {
    if (!sForm.name.trim()) {
      setError("El nombre del servicio es obligatorio.");
      return;
    }
    setBusy(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Tu sesión expiró.");
      setBusy(false);
      return;
    }

    const payload = { name: sForm.name.trim(), unit_price: num(sForm.unit_price) };

    if (sEditing) {
      const { data, error } = await supabase
        .from("services")
        .update(payload)
        .eq("id", sEditing)
        .select()
        .single();
      if (error || !data) {
        setError(dupMsg(error?.code, "servicio"));
        setBusy(false);
        return;
      }
      setServices((p) => p.map((s) => (s.id === sEditing ? (data as Service) : s)).sort(byName));
    } else {
      const { data, error } = await supabase
        .from("services")
        .insert({ ...payload, user_id: user.id })
        .select()
        .single();
      if (error || !data) {
        setError(dupMsg(error?.code, "servicio"));
        setBusy(false);
        return;
      }
      setServices((p) => [...p, data as Service].sort(byName));
    }

    setSForm({ name: "", unit_price: "" });
    setSEditing(null);
    setBusy(false);
    router.refresh();
  }

  async function deleteService(id: string, name: string) {
    if (!confirm(`¿Eliminar "${name}" del catálogo?`)) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      setError("No se pudo eliminar. " + error.message);
      return;
    }
    setServices((p) => p.filter((s) => s.id !== id));
    router.refresh();
  }

  return (
    <div>
      <div className="flex gap-1 mb-5 border-b border-line">
        <TabBtn active={tab === "clients"} onClick={() => setTab("clients")}>
          Clientes ({clients.length})
        </TabBtn>
        <TabBtn active={tab === "services"} onClick={() => setTab("services")}>
          Servicios ({services.length})
        </TabBtn>
      </div>

      {error && (
        <p role="alert" className="text-sm text-brick mb-4">
          {error}
        </p>
      )}

      {tab === "clients" ? (
        <div>
          {!cOpen ? (
            <button
              onClick={() => {
                setCForm({ ...emptyClient });
                setCEditing(null);
                setCOpen(true);
              }}
              className="btn-primary mb-4"
            >
              + Agregar cliente
            </button>
          ) : (
            <div className="card p-5 mb-4">
              <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide mb-4">
                {cEditing ? "Editar cliente" : "Nuevo cliente"}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Nombre *" value={cForm.name} onChange={(v) => setCForm({ ...cForm, name: v })} />
                <Field label="Empresa" value={cForm.company} onChange={(v) => setCForm({ ...cForm, company: v })} />
                <Field label="Correo" type="email" value={cForm.email} onChange={(v) => setCForm({ ...cForm, email: v })} />
                <Field label="Teléfono" type="tel" value={cForm.phone} onChange={(v) => setCForm({ ...cForm, phone: v })} />
                <Field label="ID fiscal (RUC, NIT, RFC…)" value={cForm.tax_id} onChange={(v) => setCForm({ ...cForm, tax_id: v })} />
                <Field label="Dirección" value={cForm.address} onChange={(v) => setCForm({ ...cForm, address: v })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink cursor-pointer mt-3">
                <input
                  type="checkbox"
                  checked={cForm.requires_dgi_default}
                  onChange={(e) => setCForm({ ...cForm, requires_dgi_default: e.target.checked })}
                  className="rounded border-line"
                />
                Este cliente siempre pide factura fiscal (DGI)
              </label>
              <p className="text-xs text-slate mt-1">
                Cada factura nueva para este cliente traerá esa casilla ya marcada — la puedes
                cambiar en cada factura sin que afecte lo guardado aquí.
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setCOpen(false)} className="btn-secondary text-xs py-1.5">
                  Cancelar
                </button>
                <button onClick={saveClient} disabled={busy} className="btn-primary text-xs py-1.5">
                  {busy ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          )}

          {clients.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="font-display font-semibold text-ink">Todavía no hay clientes</p>
              <p className="text-sm text-slate mt-1">
                Se agregan solos cada vez que cotizas a alguien nuevo.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {clients.map((c) => (
                <li key={c.id} className="card p-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-ink">{c.name}</p>
                    {c.company && <p className="text-sm text-slate">{c.company}</p>}
                    <p className="text-xs text-slate mt-0.5">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setCForm({
                          name: c.name,
                          company: c.company ?? "",
                          email: c.email ?? "",
                          phone: c.phone ?? "",
                          tax_id: c.tax_id ?? "",
                          address: c.address ?? "",
                          requires_dgi_default: c.requires_dgi_default,
                        });
                        setCEditing(c.id);
                        setCOpen(true);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="btn-ghost text-xs py-1.5"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteClient(c.id, c.name)}
                      className="btn-ghost text-xs py-1.5 hover:text-brick"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div>
          <div className="card p-5 mb-4">
            <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide mb-1">
              {sEditing ? "Editar servicio" : "Agregar al catálogo"}
            </h2>
            <p className="text-xs text-slate mb-4">
              Con el precio guardado dejas de improvisar cuánto cobrar cada vez.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="field-label" htmlFor="svc-name">
                  Servicio o producto
                </label>
                <input
                  id="svc-name"
                  className="field-input"
                  value={sForm.name}
                  onChange={(e) => setSForm({ ...sForm, name: e.target.value })}
                  placeholder="Identidad de marca completa"
                />
              </div>
              <div className="sm:w-40">
                <label className="field-label" htmlFor="svc-price">
                  Precio
                </label>
                <input
                  id="svc-price"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  className="field-input text-right tabular-nums"
                  value={sForm.unit_price}
                  onChange={(e) => setSForm({ ...sForm, unit_price: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                {sEditing && (
                  <button
                    onClick={() => {
                      setSEditing(null);
                      setSForm({ name: "", unit_price: "" });
                    }}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                )}
                <button onClick={saveService} disabled={busy} className="btn-primary">
                  {busy ? "…" : sEditing ? "Guardar" : "Agregar"}
                </button>
              </div>
            </div>
          </div>

          {services.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="font-display font-semibold text-ink">Catálogo vacío</p>
              <p className="text-sm text-slate mt-1">
                Agrega lo que vendes con más frecuencia y lo insertas en un clic al cotizar.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {services.map((s) => (
                <li key={s.id} className="card p-4 flex items-center justify-between gap-3">
                  <p className="text-ink min-w-0 truncate">{s.name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-sm text-ink tabular-nums">
                      {formatMoney(s.unit_price, currency, locale)}
                    </span>
                    <button
                      onClick={() => {
                        setSForm({ name: s.name, unit_price: String(num(s.unit_price)) });
                        setSEditing(s.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="btn-ghost text-xs py-1.5"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteService(s.id, s.name)}
                      className="btn-ghost text-xs py-1.5 hover:text-brick"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, "es");
}

function dupMsg(code: string | undefined, what: string) {
  return code === "23505"
    ? `Ya tienes un ${what} con ese nombre.`
    : `No se pudo guardar el ${what}.`;
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active ? "border-ink text-ink" : "border-transparent text-slate hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type={type}
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
