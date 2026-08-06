"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CompanySettings, CURRENCIES, DEFAULT_SETTINGS } from "@/types";
import { contrastOnWhite, isValidHex, num } from "@/lib/format";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export default function SettingsClient({ initial }: { initial: CompanySettings | null }) {
  const router = useRouter();
  const supabase = createClient();
  const base = initial ?? { ...DEFAULT_SETTINGS, user_id: "" };

  const [companyName, setCompanyName] = useState(base.company_name ?? "");
  const [companyEmail, setCompanyEmail] = useState(base.company_email ?? "");
  const [companyPhone, setCompanyPhone] = useState(base.company_phone ?? "");
  const [companyAddress, setCompanyAddress] = useState(base.company_address ?? "");
  const [taxId, setTaxId] = useState(base.tax_id ?? "");
  const [brandPrimary, setBrandPrimary] = useState(base.brand_primary);
  const [brandSecondary, setBrandSecondary] = useState(base.brand_secondary);
  const [currency, setCurrency] = useState(base.currency);
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(num(base.default_tax_rate));
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(num(base.payment_terms_days));
  const [followupDays, setFollowupDays] = useState<number>(num(base.followup_days) || 7);
  const [defaultNotes, setDefaultNotes] = useState(base.default_notes ?? "");

  const [logoUrl, setLogoUrl] = useState<string | null>(base.logo_url);
  const [logoPreview, setLogoPreview] = useState<string | null>(base.logo_url);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Libera la URL temporal del preview para no filtrar memoria al cambiar de logo
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const primaryValid = isValidHex(brandPrimary);
  const secondaryValid = isValidHex(brandSecondary);
  const lowContrast = primaryValid && contrastOnWhite(brandPrimary) < 3;

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Formato no válido. Usa PNG, JPG, WEBP o SVG.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(`El logo pesa ${(file.size / 1024 / 1024).toFixed(1)}MB. El máximo es 2MB.`);
      e.target.value = "";
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    setError(null);
    setRemoveLogo(false);
    setLogoFile(file);
    setLogoPreview(url);
  }

  function handleRemoveLogo() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (!primaryValid || !secondaryValid) {
      setError("Revisa los colores: deben ser un hex válido, por ejemplo #1A4D8F.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Tu sesión expiró. Vuelve a iniciar sesión.");
      setSaving(false);
      return;
    }

    let finalLogoUrl = removeLogo ? null : logoUrl;

    if (logoFile) {
      const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, logoFile, {
          upsert: true,
          contentType: logoFile.type,
          cacheControl: "3600",
        });

      if (uploadError) {
        setError("No se pudo subir el logo. " + uploadError.message);
        setSaving(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(path);
      finalLogoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
    }

    const selected = CURRENCIES.find((c) => c.code === currency);

    const { error: upsertError } = await supabase.from("company_settings").upsert(
      {
        user_id: user.id,
        company_name: companyName.trim() || null,
        company_email: companyEmail.trim() || null,
        company_phone: companyPhone.trim() || null,
        company_address: companyAddress.trim() || null,
        tax_id: taxId.trim() || null,
        logo_url: finalLogoUrl,
        brand_primary: brandPrimary,
        brand_secondary: brandSecondary,
        currency,
        locale: selected?.locale ?? "es-MX",
        default_tax_rate: defaultTaxRate,
        payment_terms_days: paymentTermsDays,
        followup_days: Math.min(180, Math.max(1, followupDays || 7)),
        default_notes: defaultNotes.trim() || null,
      },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      setError("No se pudo guardar. " + upsertError.message);
      setSaving(false);
      return;
    }

    setLogoUrl(finalLogoUrl);
    setLogoFile(null);
    setRemoveLogo(false);
    setSuccess(true);
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
          Empresa
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="companyName">Nombre de la empresa</label>
            <input id="companyName" className="field-input" value={companyName}
              onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="taxId">ID fiscal (RUC, NIT, RFC…)</label>
            <input id="taxId" className="field-input" value={taxId}
              onChange={(e) => setTaxId(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="companyEmail">Correo</label>
            <input id="companyEmail" type="email" inputMode="email" className="field-input"
              value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="companyPhone">Teléfono</label>
            <input id="companyPhone" type="tel" inputMode="tel" className="field-input"
              value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="companyAddress">Dirección</label>
            <input id="companyAddress" className="field-input" value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
          Logo
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="h-20 w-40 border border-dashed border-line rounded-sm flex items-center justify-center bg-paper shrink-0">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Vista previa del logo"
                className="max-h-16 max-w-[144px] object-contain" />
            ) : (
              <span className="text-xs text-slate">Sin logo</span>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="logo">Archivo</label>
            <input
              ref={fileInputRef}
              id="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoChange}
              className="text-sm text-slate file:mr-3 file:rounded-sm file:border file:border-ink/20
                         file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink
                         file:cursor-pointer hover:file:bg-ink/5"
            />
            <p className="text-xs text-slate mt-2">
              PNG, JPG, WEBP o SVG. Máximo 2MB. Se ve mejor un logo horizontal con fondo transparente.
            </p>
            {logoPreview && (
              <button type="button" onClick={handleRemoveLogo}
                className="btn-ghost text-xs px-0 mt-1 hover:text-brick">
                Quitar logo
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
            Colores de marca
          </h2>
          <p className="text-sm text-slate mt-1">
            Se aplican a la barra superior, el número de documento y el total.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="field-label" htmlFor="primary">Color primario</label>
            <div className="flex items-center gap-2">
              <input id="primary" type="color" value={primaryValid ? brandPrimary : "#14213D"}
                onChange={(e) => setBrandPrimary(e.target.value)}
                className="h-10 w-14 rounded-sm border border-line cursor-pointer shrink-0" />
              <input aria-label="Código hex del color primario"
                className={`field-input font-mono uppercase ${!primaryValid ? "border-brick" : ""}`}
                value={brandPrimary} onChange={(e) => setBrandPrimary(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="secondary">Color secundario</label>
            <div className="flex items-center gap-2">
              <input id="secondary" type="color" value={secondaryValid ? brandSecondary : "#A87C3F"}
                onChange={(e) => setBrandSecondary(e.target.value)}
                className="h-10 w-14 rounded-sm border border-line cursor-pointer shrink-0" />
              <input aria-label="Código hex del color secundario"
                className={`field-input font-mono uppercase ${!secondaryValid ? "border-brick" : ""}`}
                value={brandSecondary} onChange={(e) => setBrandSecondary(e.target.value)} />
            </div>
          </div>
        </div>

        {lowContrast && (
          <p className="text-sm text-brass" role="status">
            Este color primario es muy claro: el número y el total pueden costar de leer
            sobre el papel blanco de la cotización. Un tono más oscuro se imprime mejor.
          </p>
        )}

        {/* Vista previa: reproduce el encabezado real del documento */}
        <div className="border border-line rounded-sm overflow-hidden bg-white">
          <div className="h-2" style={{
            background: `linear-gradient(to right, ${primaryValid ? brandPrimary : "#14213D"}, ${secondaryValid ? brandSecondary : "#A87C3F"})`,
          }} />
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="" className="max-h-8 max-w-[96px] object-contain" />
              ) : null}
              <span className="font-display font-semibold text-ink text-sm truncate">
                {companyName || "Tu empresa"}
              </span>
            </div>
            <span className="font-mono text-lg font-semibold shrink-0"
              style={{ color: primaryValid ? brandPrimary : "#14213D" }}>
              COT-2026-0001
            </span>
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
          Valores por defecto
        </h2>
        <p className="text-sm text-slate -mt-2">
          Se rellenan solos en cada cotización nueva. Siempre se pueden cambiar documento por documento.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label" htmlFor="currency">Moneda</label>
            <select id="currency" className="field-input cursor-pointer" value={currency}
              onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="defaultTax">Impuesto por defecto (%)</label>
            <input id="defaultTax" type="number" min={0} max={100} step="any" inputMode="decimal"
              className="field-input tabular-nums" value={defaultTaxRate}
              onChange={(e) => setDefaultTaxRate(num(e.target.value))} />
          </div>
          <div>
            <label className="field-label" htmlFor="terms">Plazo de pago (días)</label>
            <input id="terms" type="number" min={0} max={365} step={1} inputMode="numeric"
              className="field-input tabular-nums" value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(num(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="defaultNotes">Notas por defecto</label>
          <textarea id="defaultNotes" className="field-input min-h-20" value={defaultNotes}
            onChange={(e) => setDefaultNotes(e.target.value)}
            placeholder="Condiciones, tiempos de entrega, datos bancarios…" />
        </div>
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
          Seguimiento
        </h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <label className="text-sm text-ink leading-relaxed" htmlFor="followupDays">
            Avísame de una cotización sin respuesta después de
          </label>
          <div className="flex items-center gap-2 shrink-0">
            <input
              id="followupDays"
              type="number"
              min={1}
              max={180}
              step={1}
              inputMode="numeric"
              className="field-input w-20 text-right tabular-nums"
              value={followupDays}
              onChange={(e) => setFollowupDays(num(e.target.value))}
            />
            <span className="text-sm text-ink">días</span>
          </div>
        </div>
        <p className="text-sm text-slate">
          Aparecerá en la pestaña <span className="font-medium text-ink">Seguimiento</span> con un
          mensaje de recordatorio listo para copiar. Si vendes servicios que se deciden rápido,
          bájalo a 3 o 4 días; si tus clientes tardan en aprobar presupuestos grandes, súbelo a 15
          o más. Por defecto son 7.
        </p>
        {followupDays >= 1 && followupDays <= 180 && (
          <p className="text-xs text-slate">
            Con este ajuste, una cotización enviada hoy te aparecería el{" "}
            <span className="font-mono text-ink">
              {new Date(Date.now() + followupDays * 86400000).toLocaleDateString(
                CURRENCIES.find((c) => c.code === currency)?.locale ?? "es-MX",
                { day: "2-digit", month: "long" }
              )}
            </span>
            .
          </p>
        )}
        {(followupDays < 1 || followupDays > 180) && (
          <p className="text-sm text-brass">Elige un número entre 1 y 180 días.</p>
        )}
      </section>

      <div aria-live="polite" className="min-h-5">
        {error && <p role="alert" className="text-sm text-brick">{error}</p>}
        {success && (
          <p className="text-sm text-forest">
            Guardado. Tus cotizaciones y facturas ya usan esta marca.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
