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
export interface Goal {
  id: string;
  kind: "acquire" | "potential" | "element";
  label: string;
  mode: Mode;
  classId: string | null;
  buildId: string | null;
  copyId?: string;
  element?: string;
  gearKind?: "weapon" | "defence";
  target: number;
  itemIds: string[];
  metaVersion: string;
  createdAt: string;
  status: "active" | "archived";
}
export interface UserState {
  schemaVersion: 2;
  profile: Profile;
  copies: Copy[];
  builds: Build[];
  goals: Goal[];
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
  schemaVersion: 2,
  profile: { ...DEFAULT_PROFILE, elements: [] },
  copies: [],
  builds: [],
  goals: [],
});

export function goalIdentity(g:Goal):string {
 const target=g.kind==="potential"?[g.copyId,g.target]:g.kind==="element"?[g.gearKind,g.element,g.target]:[[...new Set(g.itemIds)].sort(),g.target];
 return JSON.stringify([g.kind,g.classId,normalizeMode(g.mode),g.buildId,...target]);
}
