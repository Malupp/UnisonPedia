import type { Entry, Mode, Section } from "./contracts";
import { normalizeMode } from "./contracts";

export type TalentAffinity = "pve" | "pvp" | "both" | "unknown";
export interface WeaponTalent {
  name: string;
  affinity: TalentAffinity;
  exclusive: boolean;
  reasons: string[];
  condition: string | null;
}
export interface WeaponContextIndex {
  version: 1;
  talents: Record<string, WeaponTalent>;
  items: Record<string, string>;
}

/** Editorial orientation inferred from the actual proc, never from item type/name. */
export function classifyWeaponTalent(item: {
  sections: Pick<Section, "kind" | "text">[];
}): WeaponTalent {
  const name =
    item.sections.find((s) => s.kind === "Skill Name")?.text ||
    "Talento da verificare";
  const text = item.sections
    .filter((s) => s.kind === "Effect")
    .map((s) => s.text)
    .join("\n")
    .trim();
  const condition =
    item.sections
      .filter((s) => s.kind === "Restrictions")
      .map((s) => s.text)
      .join("\n") ||
    text
      .split("\n")
      .filter((line) =>
        /scales with|Only activates|If your Class|Activates during/i.test(line),
      )
      .join(" ") ||
    null;
  const result: WeaponTalent = {
    name,
    affinity: "unknown",
    exclusive: false,
    reasons: [],
    condition,
  };
  if (!text) {
    result.reasons.push("La descrizione del talento non è disponibile.");
    return result;
  }
  if (/Activates during Crystal Assaults/i.test(text)) {
    const guild = /Guild Battles/i.test(text),
      altar = /Crystal of the Sacred Altar/i.test(text);
    result.affinity =
      guild && altar ? "both" : guild ? "pvp" : altar ? "pve" : "unknown";
    result.reasons.push(
      "Talento per Crystal Assault: controlla i contenuti indicati nella condizione di attivazione.",
    );
    return result;
  }
  const restriction = item.sections
    .filter((s) => s.kind === "Restrictions")
    .map((s) => s.text)
    .join("\n");
  const explicit = (
    restriction +
    "\n" +
    text.replace(/^\[Effects?\]\s*/i, "")
  ).trim();
  if (/^(?:PvP|Guild Battle|Colosseum) only\b/i.test(explicit)) {
    result.affinity = "pvp";
    result.exclusive = true;
    result.reasons.push("La descrizione limita il talento al PvP indicato.");
    return result;
  }
  if (/^(?:PvE|Quests?) only\b/i.test(explicit)) {
    result.affinity = "pve";
    result.exclusive = true;
    result.reasons.push(
      "La descrizione limita il talento alle quest indicate.",
    );
    return result;
  }
  if (
    /Applies (?:Pulverize|Penetrate)\b|permits piercing through (?:invulnerability|damage)/i.test(
      text,
    )
  ) {
    result.affinity = "pvp";
    result.reasons.push(
      /Pulverize|invulnerability/i.test(text)
        ? "Preferenza PvP contro invulnerabilità e annullamento. Utile anche in PvE quando il boss usa queste protezioni."
        : "Preferenza PvP contro riduzione del danno e riflesso. Utile anche in PvE contro le stesse difese.",
    );
  }
  if (
    /Increases (?:physical|magic|healing|recovery)|Increases damage when|Recovers \d+ Cost|Fills Unison gauge|HP recovery|healing Ability|cooldown/i.test(
      text,
    )
  ) {
    if (result.affinity === "unknown") result.affinity = "both";
    if (
      /Increases damage when|Increases (?:physical|magic).*Ability Power/i.test(
        text,
      )
    )
      result.reasons.push(
        "Danno e Ability Power possono servire in entrambe le modalità.",
      );
    if (/Recovers \d+ Cost|Fills Unison gauge|cooldown/i.test(text))
      result.reasons.push(
        "Cost, Unison o cooldown aiutano a mantenere il ciclo delle abilità.",
      );
    if (/healing|recovery/i.test(text))
      result.reasons.push(
        "Il bonus di cura va abbinato a un’abilità di cura compatibile.",
      );
  }
  if (!result.reasons.length)
    result.reasons.push(
      "Non ci sono indicazioni sufficienti per attribuire una preferenza PvE/PvP.",
    );
  return result;
}

export function talentPriority(
  talent:
    | (Pick<WeaponTalent, "affinity"> &
        Partial<Pick<WeaponTalent, "exclusive">>)
    | undefined,
  mode: Mode,
): number {
  if (!talent || talent.affinity === "unknown") return 2;
  if (talent.affinity === normalizeMode(mode)) return 0;
  // A conditional preference is still broadly useful in the other mode.
  if (talent.affinity === "both" || !talent.exclusive) return 1;
  return 3;
}

/** Retain non-weapons in place and all weapons, sorting only their relative order. */
export function sortWeaponTalents<T extends Pick<Entry, "id" | "kind">>(
  entries: T[],
  talents: Record<
    string,
    Pick<WeaponTalent, "affinity"> & Partial<Pick<WeaponTalent, "exclusive">>
  >,
  mode: Mode,
): T[] {
  const weapons = entries
    .filter((e) => e.kind === "weapon")
    .sort(
      (a, b) =>
        talentPriority(talents[a.id], mode) -
        talentPriority(talents[b.id], mode),
    );
  let index = 0;
  return entries.map((entry) =>
    entry.kind === "weapon" ? weapons[index++] : entry,
  );
}

export function talentLabel(talent: WeaponTalent): string {
  if (talent.affinity === "unknown") return "Modalità da verificare";
  if (talent.affinity === "both") return "PvE / PvP";
  return (
    (talent.exclusive ? "Solo " : "Prevalenza ") +
    (talent.affinity === "pve" ? "PvE" : "PvP")
  );
}
