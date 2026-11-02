import type { Entry, Mode, SourceRef } from './contracts';
import { normalizeMode } from './contracts';
import { isClassWeapon } from './class-weapons';

export type RankingCategory = 'weapon' | 'defence' | 'healing' | 'opening' | 'constant';
export interface RankingVariant {
  skillName: string;
  itemIds: string[];
  requirements: string[];
  rawEffect: string;
  source: SourceRef;
  allowedClasses?: string[];
}
export interface RankingFamily {
  id: string;
  name: string;
  category: RankingCategory;
  priority: { pve: number; pvp: number };
  effects: string[];
  advice: { pve: string; pvp: string };
  authorRank: number | null;
  variants: RankingVariant[];
  additionalSources?: { label: string; url: string; kind: string }[];
}
export interface RankingGuide {
  version: number;
  reviewedAt: string;
  catalogueAsOf: string;
  authorGuide: string;
  methodology: string;
  notes: string[];
  families: RankingFamily[];
}
export interface RankedVariant extends RankingVariant { items: Entry[] }
export interface RankedFamily extends Omit<RankingFamily, 'variants'> {
  position: number;
  variants: RankedVariant[];
}
export interface RankingFilters {
  mode: Mode;
  classId: string | null;
  category: RankingCategory;
  query: string;
  includeOtherWeapons?: boolean;
}

export function rankedFamilies(
  guide: RankingGuide | null | undefined,
  entries: Entry[],
  filters: RankingFilters,
): RankedFamily[] {
  const catalogue = new Map(entries.map(entry => [entry.id, entry]));
  const mode = normalizeMode(filters.mode);
  const normalize = (value: string) => value.toLocaleLowerCase('it').replace(/’/g, "'");
  const query = normalize(filters.query.trim());
  // Establish the full contextual order before searching, so a match keeps its position.
  const ranked = (guide?.families ?? [])
    .filter(family => family.category === filters.category)
    .map(family => ({
      ...family,
      variants: family.variants
      .filter(variant => !filters.classId || !variant.allowedClasses?.length || variant.allowedClasses.includes(filters.classId))
      .map(variant => {
        const items = variant.itemIds.map(id => catalogue.get(id))
          .filter((entry): entry is Entry => !!entry && isClassWeapon(entry, filters.includeOtherWeapons ? null : filters.classId));
        return { ...variant, itemIds: items.map(item => item.id), items };
      }).filter(variant => variant.items.length > 0),
    }))
    .filter(family => family.variants.length > 0)
    .sort((a, b) => a.priority[mode] - b.priority[mode] || a.name.localeCompare(b.name, 'it'))
    .map((family, index) => ({ ...family, position: index + 1 }));
  if (!query) return ranked;
  const matches = (text: string) => normalize(text).includes(query);
  const identityMatches = ranked.filter(family => matches(family.name) || family.variants.some(variant =>
    matches(variant.skillName) || variant.items.some(item => matches(item.id) || matches(item.name))));
  const candidates = identityMatches.length ? identityMatches : ranked;
  return candidates.map(family => {
    if (matches(family.name) || (!identityMatches.length && [...family.effects, family.advice[mode]].some(matches))) return family;
    const variants = family.variants.map(variant => {
      if ([variant.skillName, ...variant.requirements].some(matches)) return variant;
      const items = variant.items.filter(item => [item.id, item.name].some(matches));
      return { ...variant, itemIds: items.map(item => item.id), items };
    }).filter(variant => variant.items.length > 0);
    return { ...family, variants };
  }).filter(family => family.variants.length > 0);
}


/** Keep the original effects verbatim; activation remains with requirements. */
export function originalEffectText(rawEffect: string): string {
  return rawEffect.replace(/^\s*\[Effects?\]\s*/i, '')
    .split(/\r?\n\s*\[Activation(?: Category| Rate)?\]/i)[0].trim();
}
