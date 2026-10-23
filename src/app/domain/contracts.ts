export type ActiveMode = "pve" | "pvp";
// Legacy backups and catalogue effects may still use the GvG alias.
export type Mode = ActiveMode | "gvg";
export const normalizeMode = (mode: Mode): ActiveMode =>
  mode === "gvg" ? "pvp" : mode;
export const modeLabel = (mode: Mode): string =>
  normalizeMode(mode) === "pvp" ? "PvP (GvG)" : "PvE";
export type Role = "damage" | "defence" | "support";
export type Kind = "weapon" | "defence" | "monster";
export interface SourceRef {
  id: string;
  url: string;
  declaredUpdated: string | null;
  fetchedAt: string;
  kind: "official" | "guide" | "editorial";
  edition: string | null;
}
export interface Entry {
  id: string;
  name: string;
  kind: Kind;
  gearType: string;
  rarity: "UR";
  element: string | null;
  cost: number;
  iconPath: string | null;
  detailPath: string;
  coverage: "complete" | "incomplete" | "unavailable";
  sourceRefs: SourceRef[];
}
export interface Section {
  kind: string;
  text: string;
  sourceRef?: SourceRef;
}
export type Axis = "damage" | "survival" | "support" | "synergy";
export interface Effect {
  family: string;
  rawText: string;
  axes: Partial<Record<Axis, number>>;
  potential: number;
  slot: "any" | "main" | "sub" | "opening" | "cast";
  modes: Mode[];
  stackGroup: string;
  demerit: boolean;
  condition: string | null;
  scaling: {
    element: string;
    pieces: number;
    gearType?: "weapon" | "defence";
  } | null;
  sourceRefs: SourceRef[];
}
export interface Item extends Entry {
  stats: {
    state: string;
    values: Record<string, number | null>;
    slots: { slot1: number | null; slot2: number | null };
  }[];
  skillLevelMax: number | null;
  infusionMax: number | null;
  potentialMax: number | null;
  sections: Section[];
  effects: Effect[];
  unknownEffects: { text: string; reason: string }[];
}
export interface Profile {
  classId: string | null;
  role: Role;
  mode: Mode;
  elements: string[];
  availableGems: number;
  reserveGems: number;
}
export interface Copy {
  copyId: string;
  itemId: string;
  skillLevel: number;
  infusions: number;
  potential: number;
  stat1: string;
  stat2: string;
  notes: string;
}
export interface Build {
  id: string;
  name: string;
  mode: Mode;
  slots: { copyId: string; slot: "main" | "sub" }[];
}
export interface UserState {
  schemaVersion: 1;
  profile: Profile;
  copies: Copy[];
  builds: Build[];
}
export interface Evaluation {
  status: "complete" | "insufficient-data";
  score: number | null;
  axes: Record<Axis, number>;
  rawAxes: Record<Axis, number>;
  contributions: {
    family: string;
    axes: Partial<Record<Axis, number>>;
    reason: string;
    sourceRefs: SourceRef[];
  }[];
  conditions: string[];
  missing: string[];
  version: string;
  scenario: string;
}
export const DEFAULT_PROFILE: Profile = {
  classId: null,
  role: "damage",
  mode: "pve",
  elements: [],
  availableGems: 0,
  reserveGems: 0,
};
export const emptyState = (): UserState => ({
  schemaVersion: 1,
  profile: { ...DEFAULT_PROFILE, elements: [] },
  copies: [],
  builds: [],
});
