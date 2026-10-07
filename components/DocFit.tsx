"use client";

import { useEffect, useRef, useState } from "react";

/**
 * En pantalla la hoja mide lo mismo que una carta (612 pt = 816 px). Si el
 * espacio disponible es menor (ventana angosta, teléfono), se reduce entera
 * con `zoom` para que se vea completa, sin cortes ni desplazamiento lateral.
 * Al imprimir el zoom se anula (ver globals.css) y la hoja usa el papel.
 */
const SHEET_PX = 816;

export default function DocFit({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setZoom(Math.min(1, el.clientWidth / SHEET_PX));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="doc-fit">
      <div className="doc-fit-inner" style={{ zoom }}>
        {children}
      </div>
    </div>
  );
}
