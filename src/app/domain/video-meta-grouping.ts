import type { VideoObservation } from "../core/video-meta";

interface FamilyIdentity { id: string; name: string; element?: string }
export interface VideoFamily<T extends VideoObservation> { id: string; name: string; variants: T[] }

// Only reviewed names belong here. A similar spelling is not evidence of shared mechanics.
const knownFamilies: Record<string, FamilyIdentity> = {};
const define = (id: string, name: string, variants: [string, string?][]) => {
  for (const [skill, element] of variants) knownFamilies[skill] = { id, name, element };
};
define("mandate", "Mandate", [["Mandate of Fire XL", "Fire"]]);
define("ravaging", "Ravaging", [["Ravaging Water XL", "Water"]]);
define("triumph", "Triumph", [["Light Triumph XL", "Light"], ["Fire Triumph XL", "Fire"], ["Dark Triumph XL", "Dark"]]);
define("essence", "Essence", [["Essence of Wind XL", "Wind"]]);
define("resolution", "Resolution", [["Fire Resolution XL", "Fire"], ["Wind Resolution XL", "Wind"]]);
define("obliterating", "Obliterating", [["Obliterating Water XL", "Water"], ["Obliterating Wind XL", "Wind"], ["Obliterating Dark XL", "Dark"]]);
define("mastery", "Mastery", [["Mastery Over Fire XL", "Fire"]]);
define("intercepting-hat", "Intercepting Hat", [["Intercepting Hat XL"]]);
define("obsidian", "Obsidian", [["Obsidian Star XL", "Star"], ["Obsidian Dark XL", "Dark"]]);
define("bloom", "Bloom", [["Time Bloom XL", "Time"], ["Wind Bloom XL", "Wind"], ["Star Bloom XL", "Star"]]);
define("guardian-tiger", "Guardian Tiger", [["Guardian Water Tiger XL", "Water"]]);
define("world-serpent", "World Serpent", [["World Light Serpent XL", "Light"]]);
define("fated-affection", "Fated Affection", [["Fated Affection XL"]]);
define("empyrean", "Empyrean", [["Empyrean of Wind XL", "Wind"], ["Empyrean of Star XL", "Star"]]);
define("unassailable", "Unassailable", [["Unassailable Wind XL", "Wind"]]);
define("guardian", "Guardian", [["Guardian Dark XL", "Dark"]]);
define("flickering", "Flickering", [["Flickering Time XL", "Time"]]);
define("burial", "Burial", [["Star Burial XL", "Star"]]);
define("onslaught", "Onslaught", [["Light Onslaught XL", "Light"]]);
define("graceful", "Graceful", [["Graceful Wind XL", "Wind"]]);

export function videoFamilyIdentity(row: VideoObservation): FamilyIdentity {
  if (row.category === "monster") return { id: "monster:" + row.id, name: row.name };
  const known = knownFamilies[row.name];
  const id = row.family?.trim() || known?.id;
  return {
    id: row.category + ":" + (id ? "family:" + id : "observation:" + row.id),
    name: row.familyName?.trim() || known?.name || row.name,
    element: row.element?.trim() || known?.element,
  };
}

export function groupVideoObservations<T extends VideoObservation>(rows: T[]): VideoFamily<T>[] {
  const groups = new Map<string, VideoFamily<T>>();
  for (const row of rows) {
    const family = videoFamilyIdentity(row);
    let group = groups.get(family.id);
    if (!group) {
      group = { id: family.id, name: family.name, variants: [] };
      groups.set(family.id, group);
    }
    group.variants.push(row);
  }
  return [...groups.values()];
}

export function filterVideoObservations<T extends VideoObservation & { items?: { name: string; id: string }[] }>(
  rows: T[], filters: { query: string; category: string; origin: string },
): T[] {
  const query = filters.query.trim().toLocaleLowerCase("it");
  return rows.filter(row => {
    const { category, origin } = filters;
    const matchesCategory = category === "all" || (category === "pending" ? row.status === "pending"
      : category === "setup" ? row.category === "opening" || row.category === "constant" : row.category === category);
    if (!matchesCategory || (origin !== "all" && row.origin !== origin)) return false;
    const family = videoFamilyIdentity(row);
    return !query || [row.name, family.name, family.element ?? "", ...row.skillNames, ...(row.items ?? []).flatMap(item => [item.name, item.id])]
      .some(value => value.toLocaleLowerCase("it").includes(query));
  });
}
