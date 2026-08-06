"use client";

import { useCallback } from "react";

/**
 * El navegador usa el titulo de la pagina como nombre del archivo al
 * "Guardar como PDF". Se cambia justo antes de imprimir para que el archivo
 * salga como COT-2026-0001.pdf en vez de "Cotizador", y se restaura despues.
 */
export function usePrintDocument(filename: string) {
  return useCallback(() => {
    const previous = document.title;
    document.title = filename;

    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);

    window.print();

    // Respaldo: algunos navegadores no disparan afterprint de forma fiable.
    setTimeout(restore, 1500);
  }, [filename]);
}
