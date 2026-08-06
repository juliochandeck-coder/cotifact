import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-8 max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-slate">404</p>
        <h1 className="font-display text-xl font-bold text-ink mt-2">
          Este documento no existe
        </h1>
        <p className="text-sm text-slate mt-2 mb-5">
          Puede que se haya eliminado, o que el enlace pertenezca a otra cuenta.
        </p>
        <Link href="/dashboard" className="btn-primary">
          Ir a cotizaciones
        </Link>
      </div>
    </div>
  );
}
