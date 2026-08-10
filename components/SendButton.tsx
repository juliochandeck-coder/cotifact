"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

export default function SendButton({
  kind,
  id,
  clientEmail,
  sentAt,
  locale = "es-PA",
}: {
  kind: "quote" | "invoice";
  id: string;
  clientEmail: string | null;
  sentAt: string | null;
  locale?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const hasEmail = !!clientEmail?.trim();

  async function handleSend() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, message }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo enviar.");
        setBusy(false);
        return;
      }

      setSent(true);
      setOpen(false);
      setBusy(false);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor de correo.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="no-print">
        <button
          onClick={() => (hasEmail ? setOpen(true) : setError("Este cliente no tiene correo registrado."))}
          className="btn-secondary"
          title={hasEmail ? `Enviar a ${clientEmail}` : "Falta el correo del cliente"}
        >
          {sent || sentAt ? "Reenviar" : "Enviar por correo"}
        </button>
        {(sentAt || sent) && !error && (
          <p className="text-xs text-slate mt-1">
            {sent ? "Enviado ahora" : `Enviado el ${formatDate(sentAt, locale)}`}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-brick mt-1 max-w-xs">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="no-print card p-4 w-full">
      <p className="text-sm text-ink mb-1">
        Enviar a <span className="font-medium">{clientEmail}</span>
      </p>
      <p className="text-xs text-slate mb-3">
        Se manda con tu logo y colores. Las respuestas llegan a tu correo.
      </p>

      <label className="field-label" htmlFor="msg">
        Mensaje (opcional)
      </label>
      <textarea
        id="msg"
        className="field-input min-h-20 mb-3"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Si lo dejas vacío se manda un texto estándar."
      />

      {error && (
        <p role="alert" className="text-sm text-brick mb-3">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="btn-secondary text-xs py-1.5">
          Cancelar
        </button>
        <button onClick={handleSend} disabled={busy} className="btn-primary text-xs py-1.5">
          {busy ? "Enviando…" : "Enviar ahora"}
        </button>
      </div>
    </div>
  );
}
