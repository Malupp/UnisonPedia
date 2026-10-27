import type { Entry } from "./contracts";

// On-class weapon families, including the additional families of extra classes.
// This describes class traits, not a prohibition on equipping utility off-class gear.
export const CLASS_WEAPONS: Record<string, string[]> = Object.assign(
  Object.create(null),
  {
    Soldier: ["Sword", "Axe"],
    Lancer: ["Lance", "Scythe"],
    Archer: ["Bow", "Gun"],
    Mage: ["Staff"],
    Cleric: ["Book", "Relic"],
    Rook: ["Sword", "Book"],
    Berserker: ["Axe", "Scythe", "Gun", "Staff", "Relic"],
    "Treasure Hunter": ["Lance", "Bow", "Staff", "Dual Blade"],
    Ninja: ["Dual Blade", "Lance", "Scythe", "Staff"],
    Morpher: ["Sword", "Axe", "Bow", "Gun", "Book", "Relic"],
  },
);

export const WEAPON_LABELS: Record<string, string> = {
  Sword: "Spade",
  Axe: "Asce",
  Lance: "Lance",
  Scythe: "Falci",
  Bow: "Archi",
  Gun: "Pistole",
  Staff: "Bastoni",
  Book: "Libri",
  Relic: "Reliquie",
  "Dual Blade": "Doppie lame",
};

export function classWeaponLabel(classId: string | null): string {
  return (CLASS_WEAPONS[classId || ""] || [])
    .map((type) => WEAPON_LABELS[type] || type)
    .join(" · ");
}

export function isClassWeapon(
  entry: Pick<Entry, "kind" | "gearType">,
  classId?: string | null,
): boolean {
  const allowed = CLASS_WEAPONS[classId || ""];
  return (
    entry.kind !== "weapon" || !allowed || allowed.includes(entry.gearType)
  );
}
