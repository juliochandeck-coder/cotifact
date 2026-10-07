"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pantalla: la hoja mide lo mismo que una carta (612 pt = 816 px). Si el
 * espacio disponible es menor (ventana angosta, teléfono), se reduce entera
 * con `zoom` para que se vea completa, sin cortes.
 *
 * Impresión: el documento SIEMPRE cabe en una sola página. Justo antes de
 * imprimir se mide el contenido real y, si es más alto que el área útil de
 * la hoja carta, se calcula `--print-zoom` para reducirlo lo justo.
 */
const SHEET_PX = 816; // 612 pt
const PT = 96 / 72; // px por punto
const PRINT_AREA_PX = 690 * PT; // alto útil de la carta con los márgenes de @page

export default function DocFit({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  // Ajuste a pantalla
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setZoom(Math.min(1, el.clientWidth / SHEET_PX));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Una sola página al imprimir
  useEffect(() => {
    const before = () => {
      const inner = innerRef.current;
      const doc = inner?.querySelector<HTMLElement>(".doc");
      if (!inner || !doc) return;

      // Se mide siempre con el ancho de la hoja carta, haya o no estilos de impresión ya aplicados.
      inner.style.removeProperty("--print-zoom");
      const previousZoom = inner.style.zoom;
      inner.style.zoom = "1";
      doc.classList.add("doc--measure");
      const cs = getComputedStyle(doc);
      const content =
        doc.scrollHeight - parseFloat(cs.paddingTop || "0") - parseFloat(cs.paddingBottom || "0");
      doc.classList.remove("doc--measure");
      inner.style.zoom = previousZoom;

      const fit = content > 0 ? Math.min(1, (PRINT_AREA_PX / content) * 0.985) : 1;
      inner.style.setProperty("--print-zoom", fit.toFixed(4));
    };
    const after = () => innerRef.current?.style.removeProperty("--print-zoom");

    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  return (
    <div ref={ref} className="doc-fit">
      <div ref={innerRef} className="doc-fit-inner" style={{ zoom }}>
        {children}
      </div>
    </div>
  );
}
