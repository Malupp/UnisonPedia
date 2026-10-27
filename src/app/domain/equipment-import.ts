import type { Copy, Entry } from "./contracts";
import { newCopy } from "./inventory";

export interface EquipmentSelection {
  itemId: string;
  quantity: number;
  skillLevel: number;
  infusions: number;
  potential: number;
  stat1?: Copy["stat1"];
  stat2?: Copy["stat2"];
}

export const MAX_IMPORT_COPIES = 200;

export function prepareEquipmentBatch(
  rows: readonly EquipmentSelection[],
  entries: readonly Entry[],
): Copy[] {
  const known = new Set(entries.map((entry) => entry.id));
  const stats = ["ATK", "MATK", "DEF", "MDEF"];
  if (!rows.length) throw new Error("Seleziona almeno un oggetto.");
  let total = 0;
  for (const row of rows) {
    if (!known.has(row.itemId))
      throw new Error(
        "Un oggetto selezionato non è più disponibile nel catalogo.",
      );
    if (
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1 ||
      row.quantity > MAX_IMPORT_COPIES
    )
      throw new Error("Inserisci una quantità intera valida.");
    for (const [value, minimum] of [
      [row.skillLevel, 1],
      [row.infusions, 0],
      [row.potential, 0],
    ]) {
      if (!Number.isSafeInteger(value) || value < minimum || value > 99)
        throw new Error(
          "Controlla skill level, infusioni e potenziale: usa numeri interi validi.",
        );
    }
    if (
      (row.stat1 && !stats.includes(row.stat1)) ||
      (row.stat2 && !stats.includes(row.stat2))
    )
      throw new Error("Seleziona statistiche valide.");
    total += row.quantity;
    if (total > MAX_IMPORT_COPIES)
      throw new Error("Puoi aggiungere al massimo 200 copie per volta.");
  }
  return rows.flatMap((row) =>
    Array.from({ length: row.quantity }, () => ({
      ...newCopy(row.itemId),
      skillLevel: row.skillLevel,
      infusions: row.infusions,
      potential: row.potential,
      stat1: row.stat1 || "ATK",
      stat2: row.stat2 || "MATK",
    })),
  );
}
