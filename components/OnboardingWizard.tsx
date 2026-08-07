"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES } from "@/types";
import { contrastOnWhite, isValidHex, num } from "@/lib/format";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

/**
 * Tres pasos, no mas. Un solopreneur no llena formularios largos antes de ver
 * valor: cada paso se puede saltar y todo se edita despues en Ajustes.
 */
export default function OnboardingWizard() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState<number>(7);

  const [primary, setPrimary] = useState("#14213D");
  const [secondary, setSecondary] = useState("#A87C3F");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const lowContrast = isValidHex(primary) && contrastOnWhite(primary) < 3;

  function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      setError("Formato no válido. Usa PNG, JPG, WEBP o SVG.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_LOGO_BYTES) {
      setError("El logo pesa más de 2MB.");
      e.target.value = "";
      return;
    }
    setError(null);
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  }

  async function finish(skipRest = false) {
    if (saving) return;
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Tu sesión expiró. Vuelve a iniciar sesión.");
      setSaving(false);
      return;
    }

    let logoUrl: string | null = null;
    if (logoFile && !skipRest) {
      const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("logos")
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type, cacheControl: "3600" });
      if (!upErr) {
        const { data } = supabase.storage.from("logos").getPublicUrl(path);
        logoUrl = `${data.publicUrl}?v=${Date.now()}`;
      }
    }

    const selected = CURRENCIES.find((c) => c.code === currency);

    const { error: saveErr } = await supabase.from("company_settings").upsert(
      {
        user_id: user.id,
        company_name: name.trim() || null,
        company_email: email.trim() || null,
        company_phone: phone.trim() || null,
        tax_id: taxId.trim() || null,
        currency,
        locale: selected?.locale ?? "es-PA",
        default_tax_rate: taxRate,
        brand_primary: isValidHex(primary) ? primary : "#14213D",
        brand_secondary: isValidHex(secondary) ? secondary : "#A87C3F",
        ...(logoUrl ? { logo_url: logoUrl } : {}),
        onboarded_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (saveErr) {
      setError("No se pudo guardar. " + saveErr.message);
      setSaving(false);
      return;
    }

    router.push("/quotes/new");
    router.refresh();
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full ${n <= step ? "bg-ink" : "bg-line"}`}
              aria-hidden="true"
            />
          ))}
        </div>
        <p className="text-xs uppercase tracking-wide text-slate">Paso {step} de 3</p>
        <h1 className="font-title text-2xl font-bold text-ink mt-1">
          {step === 1 && "¿Cómo se llama tu negocio?"}
          {step === 2 && "Tu marca en los documentos"}
          {step === 3 && "Moneda e impuesto"}
        </h1>
        <p className="text-sm text-slate mt-1">
          {step === 1 && "Esto aparece en el encabezado de tus cotizaciones y facturas."}
          {step === 2 && "Opcional. Puedes hacerlo después desde Ajustes."}
          {step === 3 && "Se rellenan solos en cada cotización nueva."}
        </p>
      </div>

      <div className="card p-6 space-y-4">
        {step === 1 && (
          <>
            <div>
              <label className="field-label" htmlFor="on-name">Nombre del negocio *</label>
              <input
                id="on-name"
                autoFocus
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Estudio Lumen"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label" htmlFor="on-mail">Correo</label>
                <input id="on-mail" type="email" className="field-input" value={email}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="field-label" htmlFor="on-tel">Teléfono</label>
                <input id="on-tel" type="tel" className="field-input" value={phone}
                  onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="on-tax">ID fiscal (RUC, NIT…)</label>
              <input id="on-tax" className="field-input" value={taxId}
                onChange={(e) => setTaxId(e.target.value)} />
              <p className="text-xs text-slate mt-1">
                Opcional. Aparece bajo el nombre de tu negocio en los documentos.
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center gap-5 flex-wrap">
              <div className="h-20 w-40 border border-dashed border-line rounded-sm grid place-items-center bg-paper shrink-0">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="" className="max-h-16 max-w-[144px] object-contain" />
                ) : (
                  <span className="text-xs text-slate">Sin logo</span>
                )}
              </div>
              <div>
                <label className="field-label" htmlFor="on-logo">Logo</label>
                <input id="on-logo" type="file" onChange={pickLogo}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="text-sm text-slate file:mr-3 file:rounded-sm file:border file:border-ink/20
                             file:bg-white file:px-4 file:py-2 file:text-sm file:text-ink file:cursor-pointer" />
                <p className="text-xs text-slate mt-2">PNG, JPG, WEBP o SVG. Máximo 2MB.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="field-label" htmlFor="on-c1">Color principal</label>
                <div className="flex items-center gap-2">
                  <input id="on-c1" type="color" value={isValidHex(primary) ? primary : "#14213D"}
                    onChange={(e) => setPrimary(e.target.value)}
                    className="h-10 w-14 rounded-sm border border-line cursor-pointer shrink-0" />
                  <input className="field-input font-mono uppercase" value={primary}
                    onChange={(e) => setPrimary(e.target.value)} aria-label="Hex principal" />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="on-c2">Color secundario</label>
                <div className="flex items-center gap-2">
                  <input id="on-c2" type="color" value={isValidHex(secondary) ? secondary : "#A87C3F"}
                    onChange={(e) => setSecondary(e.target.value)}
                    className="h-10 w-14 rounded-sm border border-line cursor-pointer shrink-0" />
                  <input className="field-input font-mono uppercase" value={secondary}
                    onChange={(e) => setSecondary(e.target.value)} aria-label="Hex secundario" />
                </div>
              </div>
            </div>

            {lowContrast && (
              <p className="text-sm text-brass">
                Ese color principal es muy claro: el número y el total pueden costar de leer impresos.
              </p>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <label className="field-label" htmlFor="on-cur">Moneda</label>
              <select id="on-cur" className="field-input cursor-pointer" value={currency}
                onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="on-rate">Impuesto por defecto (%)</label>
              <input id="on-rate" type="number" min={0} max={100} step="any" inputMode="decimal"
                className="field-input tabular-nums w-32 text-right" value={taxRate}
                onChange={(e) => setTaxRate(num(e.target.value))} />
              <p className="text-xs text-slate mt-1">
                En Panamá el ITBMS general es 7%. Si no aplicas impuesto, pon 0.
              </p>
            </div>
          </>
        )}

        {error && <p role="alert" className="text-sm text-brick">{error}</p>}
      </div>

      <div className="flex items-center justify-between gap-3 mt-6">
        <button
          onClick={() => (step === 1 ? finish(true) : setStep(step - 1))}
          className="btn-ghost text-sm"
          disabled={saving}
        >
          {step === 1 ? "Saltar por ahora" : "Atrás"}
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={step === 1 && !name.trim()}
            className="btn-primary"
          >
            Continuar
          </button>
        ) : (
          <button onClick={() => finish()} disabled={saving} className="btn-primary">
            {saving ? "Guardando…" : "Crear mi primera cotización"}
          </button>
        )}
      </div>
    </div>
  );
}
