export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
      <div className="text-center">
        <div className="h-1 w-32 rounded-full bg-line overflow-hidden mx-auto">
          <div className="h-full w-1/3 bg-brass animate-[loading_1.2s_ease-in-out_infinite]" />
        </div>
        <p className="text-sm text-slate mt-3">Cargando…</p>
      </div>
      <style>{`@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
}
