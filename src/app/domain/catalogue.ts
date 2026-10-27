import { Entry } from "./contracts";
import { isClassWeapon } from "./class-weapons";
export interface Filters {
  query: string;
  kind: string;
  element: string;
  minCost: number;
  maxCost: number;
  costs: number[];
}
export const defaultFilters: Filters = {
  query: "",
  kind: "",
  element: "",
  minCost: 0,
  maxCost: 999,
  costs: [],
};
export function filterCatalogue(
  entries: Entry[],
  f: Filters,
  classId?: string | null,
) {
  const tokens = f.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return entries.filter(
    (e) =>
      isClassWeapon(e, classId) &&
      tokens.every((t) =>
        (e.name + " " + e.gearType + " " + e.id).toLowerCase().includes(t),
      ) &&
      (!f.kind || e.kind === f.kind) &&
      (!f.element || e.element === f.element) &&
      e.cost >= f.minCost &&
      e.cost <= f.maxCost &&
      (!f.costs.length || f.costs.includes(e.cost)),
  );
}
export function encodeFilters(f: Filters) {
  const p = new URLSearchParams();
  if (f.costs.length)
    p.set("costs", [...f.costs].sort((a, b) => a - b).join(","));
  if (f.query) p.set("q", f.query);
  if (f.kind) p.set("kind", f.kind);
  if (f.element) p.set("element", f.element);
  if (f.minCost) p.set("min", String(f.minCost));
  if (f.maxCost !== 999) p.set("max", String(f.maxCost));
  return p.toString();
}
export function decodeFilters(q: string): Filters {
  const p = new URLSearchParams(q);
  const n = (key: string, def: number) => {
    const v = p.get(key);
    return v !== null && Number.isFinite(Number(v)) && Number(v) >= 0
      ? Number(v)
      : def;
  };
  return {
    query: p.get("q") || "",
    kind: ["weapon", "defence", "monster"].includes(p.get("kind") || "")
      ? p.get("kind")!
      : "",
    element: p.get("element") || "",
    minCost: n("min", 0),
    maxCost: n("max", 999),
    costs: [
      ...new Set(
        (p.get("costs") || "")
          .split(",")
          .filter(Boolean)
          .map(Number)
          .filter((n) => Number.isSafeInteger(n) && n >= 0),
      ),
    ].sort((a, b) => a - b),
  };
}

export const COST_OPTIONS = [
  5, 21, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
  42, 43, 44, 45, 46, 47, 48, 99,
];
