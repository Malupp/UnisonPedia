export interface Validation<T> {
  ok: boolean;
  data?: T;
  errors: { path: string; code: string; message: string }[];
}
export function validateCatalogueEntry(value: unknown): Validation<any> {
  const v = value as any;
  const errors = [];
  for (const k of ["id", "name", "detailPath"])
    if (typeof v?.[k] !== "string" || !v[k])
      errors.push({ path: k, code: "required", message: "Campo necessario" });
  if (!Number.isInteger(v?.cost) || v.cost < 0)
    errors.push({
      path: "cost",
      code: "invalid",
      message: "Costo mancante o non valido",
    });
  if (!["weapon", "defence", "monster"].includes(v?.kind))
    errors.push({
      path: "kind",
      code: "invalid",
      message: "Categoria non valida",
    });
  return { ok: !errors.length, ...(!errors.length ? { data: v } : {}), errors };
}
