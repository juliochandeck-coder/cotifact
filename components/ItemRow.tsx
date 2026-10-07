"use client";

import { LineItem } from "@/types";
import { num } from "@/lib/format";

/**
 * Un concepto de cotización o factura en el formulario.
 * La descripción es un cuadro de texto de tamaño fijo (igual para todos los
 * conceptos, sin importar cuánto texto lleve): Enter crea un párrafo nuevo y
 * las líneas que empiezan con "- " salen como viñetas en el documento.
 */
function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.select();
}

export default function ItemRow({
  item,
  index,
  canRemove,
  money,
  onChange,
  onRemove,
}: {
  item: LineItem;
  index: number;
  canRemove: boolean;
  money: (v: number) => string;
  onChange: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
}) {
  const lineTotal = num(item.quantity) * num(item.unit_price);
  const id = `item-${index}`;

  return (
    <li className="rounded-sm border border-line p-3 sm:p-4 bg-white">
      <div className="flex items-center justify-between mb-1.5">
        <label className="field-label mb-0" htmlFor={`${id}-desc`}>
          Concepto {index + 1} — Descripción
        </label>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-slate hover:text-brick px-1"
            aria-label={`Eliminar concepto ${index + 1}`}
          >
            Eliminar
          </button>
        )}
      </div>

      <textarea
        id={`${id}-desc`}
        className="field-input h-44 resize-none overflow-y-auto leading-relaxed"
        value={item.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder={
          "Descripción del servicio o producto.\n\nEnter para un párrafo nuevo.\n- Empieza una línea con guion para hacer una viñeta"
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 items-end">
        <div>
          <label className="field-label" htmlFor={`${id}-qty`}>
            Cantidad
          </label>
          <input
            id={`${id}-qty`}
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            className="field-input text-right tabular-nums"
            value={item.quantity}
            onFocus={selectOnFocus}
            onChange={(e) => onChange({ quantity: num(e.target.value) })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`${id}-price`}>
            Precio unitario
          </label>
          <input
            id={`${id}-price`}
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            className="field-input text-right tabular-nums"
            value={item.unit_price}
            onFocus={selectOnFocus}
            onChange={(e) => onChange({ unit_price: num(e.target.value) })}
          />
        </div>
        <div className="col-span-2 sm:col-span-1 flex items-center justify-between sm:block sm:text-right sm:pb-2">
          <span className="field-label sm:mb-1">Importe</span>
          <span className="font-mono text-sm text-ink tabular-nums">{money(lineTotal)}</span>
        </div>
      </div>
    </li>
  );
}
