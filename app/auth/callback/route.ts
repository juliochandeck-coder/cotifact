import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Punto de aterrizaje de los enlaces enviados por correo (confirmar cuenta,
 * restablecer contrasena, acceso por enlace magico tras pagar).
 * Cambia el codigo de un solo uso por una sesion real y redirige.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=enlace_invalido`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=enlace_vencido`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
