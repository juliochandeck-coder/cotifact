"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const code = searchParams.get("error");
    if (code === "enlace_vencido") return "Ese enlace ya venció. Pide uno nuevo.";
    if (code === "enlace_invalido") return "El enlace no es válido. Pide uno nuevo.";
    return null;
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      // Mensajes concretos en lugar de repetir el error crudo del servidor
      const message = error.message.toLowerCase();
      if (message.includes("not confirmed")) {
        setError("Tu cuenta aún no está confirmada. Revisa el correo que te enviamos.");
      } else if (message.includes("rate")) {
        setError("Demasiados intentos. Espera un minuto antes de volver a probar.");
      } else {
        setError("Correo o contraseña incorrectos.");
      }
      setLoading(false);
      return;
    }

    const next = searchParams.get("next");
    router.refresh();
    router.push(next && next.startsWith("/") ? next : "/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-block stamp text-ink text-sm mb-4">CotiFact</div>
          <h1 className="font-title text-2xl font-bold text-ink">Inicia sesión</h1>
          <p className="text-sm text-slate mt-1">Cotiza y factura en un mismo lugar.</p>
        </div>

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
              placeholder="Email"
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
              autoComplete="current-password"
              required
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Link href="/forgot-password" className="text-xs text-brass hover:underline mt-1.5 inline-block">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <div aria-live="polite">
            {error && <p role="alert" className="text-sm text-brick">{error}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="text-center text-sm text-slate mt-4">
          ¿No tienes cuenta?{" "}
          <Link href="/signup" className="text-brass font-medium hover:underline">
            Crear cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}
