"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Al llegar desde el correo, Supabase deja una sesion de recuperacion activa.
  // Si no existe, el enlace vencio o ya se uso.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setValidLink(!!data.session);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (password.length < 8) {
      setError("Usa al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("No se pudo actualizar. " + error.message);
      setSaving(false);
      return;
    }

    setDone(true);
    setSaving(false);
    setTimeout(() => {
      router.refresh();
      router.push("/dashboard");
    }, 1400);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-block stamp text-ink text-sm mb-4">CotiFact</div>
          <h1 className="font-title text-2xl font-bold text-ink">Nueva contraseña</h1>
        </div>

        {!ready ? (
          <div className="card p-6 text-center text-sm text-slate">Verificando enlace…</div>
        ) : !validLink ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-ink">Este enlace ya venció o fue usado.</p>
            <p className="text-xs text-slate mt-2 mb-4">
              Los enlaces duran una hora y sirven una sola vez. Pide uno nuevo.
            </p>
            <Link href="/forgot-password" className="btn-primary w-full">
              Pedir enlace nuevo
            </Link>
          </div>
        ) : done ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-forest font-medium">Contraseña actualizada</p>
            <p className="text-xs text-slate mt-2">Entrando a tu cuenta…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 card p-6">
            <div>
              <div className="flex items-baseline justify-between">
                <label className="field-label" htmlFor="pw">Contraseña nueva</label>
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="text-xs text-slate hover:text-ink mb-1"
                >
                  {show ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <input
                id="pw"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                autoFocus
                className="field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
              <p className={`text-xs mt-1 ${tooShort ? "text-brass" : "text-slate"}`}>
                {tooShort ? `Faltan ${8 - password.length} caracteres.` : "Mínimo 8 caracteres."}
              </p>
            </div>

            <div>
              <label className="field-label" htmlFor="pw2">Repite la contraseña</label>
              <input
                id="pw2"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                className={`field-input ${mismatch ? "border-brick" : ""}`}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {mismatch && <p className="text-xs text-brick mt-1">No coinciden.</p>}
            </div>

            {error && <p role="alert" className="text-sm text-brick">{error}</p>}

            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? "Guardando…" : "Guardar y entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
