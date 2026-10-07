"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CompanySettings,
  CURRENCIES,
  DEFAULT_SETTINGS,
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_BRAND_SECONDARY,
  FONT_PAIRS,
  FontPairKey,
} from "@/types";
import { contrastOnWhite, isValidHex, num } from "@/lib/format";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export default function SettingsClient({ initial }: { initial: CompanySettings | null }) {
  const router = useRouter();
  const supabase = createClient();
  const base = initial ?? { ...DEFAULT_SETTINGS, user_id: "" };

  const [username, setUsername] = useState(base.username ?? "");
  const [companyName, setCompanyName] = useState(base.company_name ?? "");
  const [companyEmail, setCompanyEmail] = useState(base.company_email ?? "");
  const [companyPhone, setCompanyPhone] = useState(base.company_phone ?? "");
  const [companyAddress, setCompanyAddress] = useState(base.company_address ?? "");
  const [taxId, setTaxId] = useState(base.tax_id ?? "");
  // Los colores son opcionales: campo vacio significa "usa el neutro por defecto".
  const [brandPrimary, setBrandPrimary] = useState(base.brand_primary ?? "");
  const [brandSecondary, setBrandSecondary] = useState(base.brand_secondary ?? "");
  const [fontPair, setFontPair] = useState<FontPairKey>((base.font_pair as FontPairKey) || "roboto");
  const [currency, setCurrency] = useState(base.currency);
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(num(base.default_tax_rate));
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(num(base.payment_terms_days));
  const [followupDays, setFollowupDays] = useState<number>(num(base.followup_days) || 7);
  const [defaultNotes, setDefaultNotes] = useState(base.default_notes ?? "");
  const [defaultPayment, setDefaultPayment] = useState(base.default_payment_method ?? "");

  const [logoUrl, setLogoUrl] = useState<string | null>(base.logo_url);
  const [logoPreview, setLogoPreview] = useState<string | null>(base.logo_url);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // Vacio cuenta como valido: sencillamente no se ha elegido ese color.
  const primaryValid = brandPrimary.trim() === "" || isValidHex(brandPrimary);
  const secondaryValid = brandSecondary.trim() === "" || isValidHex(brandSecondary);
  const previewPrimary = primaryValid && brandPrimary ? brandPrimary : DEFAULT_BRAND_PRIMARY;
  const previewSecondary = secondaryValid && brandSecondary ? brandSecondary : DEFAULT_BRAND_SECONDARY;
  const lowContrast = primaryValid && !!brandPrimary && contrastOnWhite(brandPrimary) < 3;

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
      setError("Revisa los colores: deben ser un hex válido, por ejemplo #1A4D8F, o déjalos vacíos.");
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
        username: username.trim() || null,
        company_name: companyName.trim() || null,
        company_email: companyEmail.trim() || null,
        company_phone: companyPhone.trim() || null,
        company_address: companyAddress.trim() || null,
        tax_id: taxId.trim() || null,
        logo_url: finalLogoUrl,
        brand_primary: brandPrimary.trim() || null,
        brand_secondary: brandSecondary.trim() || null,
        font_pair: fontPair,
        currency,
        locale: selected?.locale ?? "es-PA",
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

    // Se guarda aparte: si falta la columna (migration_v9.sql sin correr),
    // el resto de Ajustes se guarda igual y se avisa qué falta.
    const { error: paymentError } = await supabase
      .from("company_settings")
      .update({ default_payment_method: defaultPayment.trim() || null })
      .eq("user_id", user.id);

    if (paymentError) {
      setError(
        "Se guardó todo excepto la forma de pago. En Supabase → SQL Editor corre el archivo supabase/migration_v9.sql y vuelve a guardar."
      );
      setSaving(false);
      router.refresh();
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
          Cuenta
        </h2>
        <div>
          <label className="field-label" htmlFor="username">Nombre de usuario</label>
          <input id="username" className="field-input" value={username}
            onChange={(e) => setUsername(e.target.value)} />
        </div>
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
          Empresa
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="companyName">Nombre de la empresa</label>
            <input id="companyName" className="field-input" value={companyName}
              onChange={(e) => setCompanyName(e.target.value)} />
            <p className="text-xs text-slate mt-1">Aparece en el encabezado de tus documentos.</p>
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
            <textarea id="companyAddress" required className="field-input min-h-16" rows={2} value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder={"Calle, edificio, apartamento\nCorregimiento, ciudad, país"} />
            <p className="text-xs text-slate mt-1">Sale centrada al pie de cotizaciones y facturas. Usa Enter para partirla en dos líneas.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="defaultPayment">Forma de pago (sale en todas las facturas)</label>
            <textarea id="defaultPayment" className="field-input min-h-24" rows={5} required value={defaultPayment}
              onChange={(e) => setDefaultPayment(e.target.value)}
              placeholder={"ACH\nBanco General\nCuenta de Ahorros\nNombre del titular\nNúmero de cuenta"} />
            <p className="text-xs text-slate mt-1">La primera línea sale en negrita y el resto en cursiva. Puedes cambiarla en una factura puntual al editarla.</p>
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
            Opcionales — puedes dejarlos vacíos y usar los neutros por defecto. Se aplican al filo
            lateral, el número de documento y el total.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="field-label" htmlFor="primary">Color primario</label>
            <div className="flex items-center gap-2">
              <input id="primary" type="color" value={previewPrimary}
                onChange={(e) => setBrandPrimary(e.target.value)}
                className="h-10 w-14 rounded-sm border border-line cursor-pointer shrink-0" />
              <input aria-label="Código hex del color primario" placeholder="Sin elegir"
                className={`field-input font-mono uppercase ${!primaryValid ? "border-brick" : ""}`}
                value={brandPrimary} onChange={(e) => setBrandPrimary(e.target.value)} />
              {brandPrimary && (
                <button type="button" onClick={() => setBrandPrimary("")}
                  className="text-xs text-slate hover:text-brick shrink-0">Quitar</button>
              )}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="secondary">Color secundario</label>
            <div className="flex items-center gap-2">
              <input id="secondary" type="color" value={previewSecondary}
                onChange={(e) => setBrandSecondary(e.target.value)}
                className="h-10 w-14 rounded-sm border border-line cursor-pointer shrink-0" />
              <input aria-label="Código hex del color secundario" placeholder="Sin elegir"
                className={`field-input font-mono uppercase ${!secondaryValid ? "border-brick" : ""}`}
                value={brandSecondary} onChange={(e) => setBrandSecondary(e.target.value)} />
              {brandSecondary && (
                <button type="button" onClick={() => setBrandSecondary("")}
                  className="text-xs text-slate hover:text-brick shrink-0">Quitar</button>
              )}
            </div>
          </div>
        </div>

        {lowContrast && (
          <p className="text-sm text-brass" role="status">
            Este color primario es muy claro: el número y el total pueden costar de leer
            sobre el papel blanco de la cotización. Un tono más oscuro se imprime mejor.
          </p>
        )}

        {/* Vista previa: mismo diseño del documento real — filo solido, no degradado */}
        <div
          className="border border-line rounded-sm overflow-hidden bg-white"
          style={{ borderLeft: `4px solid ${previewPrimary}` }}
        >
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="" className="max-h-8 max-w-[96px] object-contain" />
              ) : null}
              <span className="font-display font-medium text-ink text-sm truncate">
                {companyName || "Tu empresa"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="inline-block w-1.5 h-1.5 rounded-[1px]"
                style={{ backgroundColor: previewSecondary }}
                aria-hidden="true"
              />
              <span className="font-mono text-lg font-semibold" style={{ color: previewPrimary }}>
                COT-2026-0001
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-display font-semibold text-ink text-sm uppercase tracking-wide">
            Tipografía
          </h2>
          <p className="text-sm text-slate mt-1">
            Elige el par de fuentes que se usa en tus cotizaciones y facturas.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {(Object.keys(FONT_PAIRS) as FontPairKey[]).map((key) => {
            const pair = FONT_PAIRS[key];
            const active = fontPair === key;
            return (
              <button
                type="button"
                key={key}
                onClick={() => setFontPair(key)}
                className={`text-left rounded-sm border p-3 transition-colors ${
                  active ? "border-primary ring-1 ring-primary" : "border-line hover:border-ink/30"
                }`}
              >
                <p style={{ fontFamily: pair.title }} className="text-lg font-bold text-ink leading-tight">
                  Título
                </p>
                <p style={{ fontFamily: pair.body }} className="text-sm text-slate mt-0.5">
                  Texto de cuerpo
                </p>
                <p className="text-xs text-slate mt-2">{pair.label}</p>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate">
          ¿Necesitas subir la fuente exacta de tu marca? Está en camino — por ahora, elige el par
          que más se le parezca.
        </p>
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
