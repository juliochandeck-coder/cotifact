"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-8 max-w-md text-center">
        <h1 className="font-title text-xl font-bold text-ink">Algo falló al cargar</h1>
        <p className="text-sm text-slate mt-2 mb-5">
          La conexión con el servidor se interrumpió. Vuelve a intentarlo; si continúa,
          revisa que las claves de Supabase estén configuradas.
        </p>
        <button onClick={reset} className="btn-primary">
          Reintentar
        </button>
      </div>
    </div>
  );
}
