"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    if (password.length < 8) {
      setError("Usa al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
      },
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("already") || message.includes("registered")) {
        setError("Ya existe una cuenta con este correo. Inicia sesión.");
      } else if (message.includes("rate")) {
        setError("Demasiados intentos. Espera un minuto antes de volver a probar.");
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-block stamp text-ink text-sm mb-4">CotiFact</div>
          <h1 className="font-title text-2xl font-bold text-ink">Crea tu cuenta</h1>
          <p className="text-sm text-slate mt-1">Un acceso, todas tus cotizaciones.</p>
        </div>

        {done ? (
          <div className="card p-6 shadow-sm text-center">
            <p className="text-sm text-ink">
              Te enviamos un correo a <span className="font-medium break-words">{email}</span>.
              Confirma tu cuenta desde ahí y ya podrás entrar.
            </p>
            <Link href="/login" className="btn-secondary w-full mt-4">
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 card p-6 shadow-sm">
            <div>
              <label className="field-label" htmlFor="email">Correo</label>
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

            <div>
              <div className="flex items-baseline justify-between">
                <label className="field-label" htmlFor="password">Contraseña</label>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-xs text-slate hover:text-ink mb-1"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                className="field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                aria-describedby="passwordHint"
              />
              <p
                id="passwordHint"
                className={`text-xs mt-1 ${tooShort ? "text-brass" : "text-slate"}`}
              >
                {tooShort
                  ? `Faltan ${8 - password.length} caracteres.`
                  : "Mínimo 8 caracteres."}
              </p>
            </div>

            <div aria-live="polite">
              {error && <p role="alert" className="text-sm text-brick">{error}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Creando…" : "Crear cuenta"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-slate mt-4">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-brass font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
