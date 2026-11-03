import type { Entry } from "./contracts";

const effectDescriptions: Record<string, string> = {
  "ability-power": "Aumenta la potenza delle abilità.",
  "damage-amplification": "Amplifica i danni inflitti dalle abilità.",
  concentration: "Aumenta la probabilità di attivazione degli effetti.",
  protection: "Protegge dai danni e dagli effetti negativi indicati.",
  concerto: "Offre al gruppo protezione e bonus condizionati.",
  resource: "Aiuta a recuperare Cost o a riempire la barra Unison.",
  stats: "Aumenta una o più statistiche.",
  "buff-limit": "Aumenta il limite raggiungibile dai potenziamenti.",
  "status-resistance": "Aumenta la resistenza agli status alterati.",
  recovery: "Cura HP o rimuove status e penalità.",
  "elemental-attack": "Potenzia gli attacchi elementali.",
  accuracy: "Migliora la precisione delle abilità.",
  "reflection-reduction": "Riduce i danni riflessi.",
  guard: "Aiuta a proteggere il gruppo dai danni.",
};

const families = (entry: Entry) => new Set(entry.effectFamilies ?? []);

export function describeEquipment(entry: Entry): string {
  const descriptions = [...families(entry)]
    .map((family) => effectDescriptions[family])
    .filter(Boolean)
    .slice(0, 2);
  return descriptions.length
    ? descriptions.join(" ")
    : "Consulta gli effetti e i requisiti nella scheda dell’equip.";
}

export function findSimilarEquipment(
  entries: Entry[],
  item: Entry,
  limit = 4,
): Entry[] {
  const itemFamilies = families(item);
  const itemSkills = new Set(
    (item.skillNames ?? []).map((skill) => skill.trim().toLowerCase()),
  );
  if (!itemFamilies.size && !itemSkills.size) return [];

  return entries
    .filter((candidate) => candidate.id !== item.id && candidate.kind === item.kind)
    .map((candidate) => {
      const candidateFamilies = families(candidate);
      const sharedFamilies = [...itemFamilies].filter((family) => candidateFamilies.has(family)).length;
      const sharedSkills = (candidate.skillNames ?? []).filter((skill) => itemSkills.has(skill.trim().toLowerCase())).length;
      const similar = sharedFamilies > 0 || sharedSkills > 0;
      const sameGearType = candidate.gearType === item.gearType;
      const sameElement = candidate.element === item.element;
      const score = sharedFamilies * 10 + sharedSkills * 8 + (sameGearType ? 2 : 0) + (sameElement ? 1 : 0);
      return { candidate, similar, score };
    })
    .filter((result) => result.similar)
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
