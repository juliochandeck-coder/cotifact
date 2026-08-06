"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      // No se revela si el correo existe o no: eso filtraria quien tiene cuenta.
      if (error.message.toLowerCase().includes("rate")) {
        setError("Demasiados intentos. Espera un minuto antes de volver a probar.");
        setLoading(false);
        return;
      }
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-block stamp text-ink text-sm mb-4">CotiFact</div>
          <h1 className="font-display text-2xl font-bold text-ink">Recuperar acceso</h1>
          <p className="text-sm text-slate mt-1">Te enviamos un enlace para crear una contraseña nueva.</p>
        </div>

        {sent ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-ink">
              Si existe una cuenta con <span className="font-medium break-words">{email}</span>,
              recibirás un correo en unos segundos con el enlace para restablecerla.
            </p>
            <p className="text-xs text-slate mt-3">
              Revisa también la carpeta de spam. El enlace vence en una hora.
            </p>
            <Link href="/login" className="btn-secondary w-full mt-4">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 card p-6">
            <div>
              <label className="field-label" htmlFor="email">Correo de tu cuenta</label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                autoFocus
                className="field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
              />
            </div>

            {error && <p role="alert" className="text-sm text-brick">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Enviando…" : "Enviar enlace"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-slate mt-4">
          <Link href="/login" className="text-brass font-medium hover:underline">
            Volver
          </Link>
        </p>
      </div>
    </div>
  );
}
