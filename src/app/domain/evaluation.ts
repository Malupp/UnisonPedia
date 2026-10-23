import {
  Item,
  Effect,
  Profile,
  Copy,
  Evaluation,
  Axis,
  UserState,
  normalizeMode,
} from "./contracts";
export const RULE_VERSION = "1.0.0-editorial";
export const CLASS_WEAPONS: Record<string, string[]> = {
  Soldier: ["Sword"],
  Lancer: ["Lance", "Scythe"],
  Archer: ["Bow", "Gun"],
  Mage: ["Staff"],
  Cleric: ["Book", "Relic"],
};
const rubrics: [RegExp, string, Partial<Record<Axis, number>>][] = [
  [
    /increases.*damage when using|damage dealt.*increase/i,
    "damage-amplification",
    { damage: 3 },
  ],
  [
    /Ability Power|\d+x (physical|magic) damage/i,
    "ability-power",
    { damage: 2 },
  ],
  [/concentration/i, "concentration", { damage: 2, synergy: 2 }],
  [
    /Applies Protection|damage.*nullif|Nullifies.*damage|Reduces.*damage taken/i,
    "protection",
    { survival: 3 },
  ],
  [/Concerto/i, "concerto", { survival: 2, support: 3, synergy: 3 }],
  [
    /Fills.*Unison gauge|Increases.*Unison gauge|Cost recovery|Recovers.*Cost/i,
    "resource",
    { support: 2, synergy: 2 },
  ],
  [
    /Increases.*all stats|Increases.*ATK|Increases.*MATK|Increases.*DEF|Increases.*MDEF|stat slot/i,
    "stats",
    { damage: 1, survival: 1 },
  ],
  [/buff limit/i, "buff-limit", { support: 2, synergy: 2 }],
  [
    /status ailment.*resistance|resistance.*status ailment/i,
    "status-resistance",
    { survival: 3, synergy: 2 },
  ],
  [
    /Removes.*status ailment|Removes.*debuff|Recovers.*HP|heals/i,
    "recovery",
    { survival: 2, support: 3 },
  ],
  [/elemental attack/i, "elemental-attack", { damage: 2, synergy: 2 }],
  [/accuracy/i, "accuracy", { damage: 2, synergy: 2 }],
  [
    /reflection.*reduc|reflected damage.*reduc/i,
    "reflection-reduction",
    { survival: 3 },
  ],
  [/guard/i, "guard", { survival: 2 }],
];
export interface EvalContext {
  profile: Profile;
  scenario: "maximum" | "personal";
  ownedCopy?: Partial<Copy>;
  slot?: string;
  elementCount?: Record<string, number>;
}
export function normalizeSections(item: Item) {
  const effects: Effect[] = [],
    unknownEffects: { text: string; reason: string; potential?: number }[] = [];
  for (const section of item.sections) {
    if (
      !/Effect|Skill$|Opening|Constant|Main Slot|Ability Unlock/i.test(
        section.kind,
      ) ||
      section.kind === "Skill Name" ||
      section.kind === "Restrictions"
    )
      continue;
    const potential = Number(section.kind.match(/Lv(\d+)/)?.[1] || 0),
      sourceRefs = section.sourceRef
        ? [section.sourceRef]
        : item.sourceRefs || [];
    const slot = /main slot/i.test(section.kind)
      ? "main"
      : /opening/i.test(section.kind)
        ? "opening"
        : "any";
    const matchScaling = section.text.match(
      /number of (Fire|Water|Wind|Light|Dark|Time|Star) elemental (Weapons|Helm\/Hat\/Armor\/Clothing type Gear pieces|Defensive Gear).*?pieces needed for maximum effect: (\d+)/is,
    );
    const scaling = matchScaling
      ? {
          element: matchScaling[1],
          pieces: Number(matchScaling[3]),
          gearType:
            matchScaling[2] === "Weapons"
              ? ("weapon" as const)
              : ("defence" as const),
        }
      : null;
    if (/scales with/i.test(section.text) && !scaling)
      unknownEffects.push({
        text: section.text,
        reason: "Categoria o requisito di scaling non ancora verificato",
        potential,
      });
    let metadata = false;
    for (const raw of section.text
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (/^\[Activation(?: Rate)?\]/i.test(raw)) {
        metadata = true;
        continue;
      }
      if (/^\[Effects?\]$/.test(raw) || raw === "-") continue;
      if (metadata) {
        if (/scales with/i.test(raw) || /^[A-Z+0-9]+$/.test(raw)) continue;
        if (/^When /i.test(raw)) {
          if (
            !/^When (?:a |an )?(?:(?:physical|magic|healing|recovery)(?: or (?:physical|magic))? (?:attack )?Ability is used|physical(?: or magic)? damage is taken|magic damage is taken)\.?$/i.test(
              raw,
            )
          )
            unknownEffects.push({
              text: raw,
              reason: "Condizione di attivazione non ancora verificata",
              potential,
            });
          continue;
        }
        metadata = false;
      }
      if (/Ability Power boosted by.*Skill level/i.test(raw)) continue;
      const named = raw.match(/Applies\s+([A-Z][A-Za-z'’-]*)\s+for\b/);
      const knownState = named && ["Protection", "Concerto"].includes(named[1]);
      const unsupported =
        (named && !knownState) ||
        /activates as.*skill when|Gear pieces.*Main Slot|(?:Reduces|Decreases).*Ability Power/i.test(
          raw,
        ) ||
        (!knownState &&
          /\b(?:when|if)\b/i.test(raw) &&
          !/Increases damage when using a (?:physical|magic)(?: or (?:physical|magic))? attack Ability by/i.test(
            raw,
          ));
      if (unsupported) {
        unknownEffects.push({
          text: raw,
          reason:
            "Stato composto, direzione o condizioni non ancora verificate",
          potential,
        });
        continue;
      }
      const body = raw
        .replace(/^\[Additional Unison Effect\]\s*/i, "")
        .replace(/^(?:-\s*)?Target:[^.]+\.\s*/i, "");
      const match = knownState
        ? rubrics.find(([, family]) => family === named![1].toLowerCase())
        : /buff limit/i.test(body)
          ? rubrics.find(([, family]) => family === "buff-limit")
          : rubrics.find(([re]) => re.test(body));
      if (!match) {
        unknownEffects.push({
          text: raw,
          reason: "Famiglia o condizioni non ancora verificate",
          potential,
        });
        continue;
      }
      const demerit =
        /(?:Decreases|Reduces)/i.test(body) &&
        /(?:yourself|all allies|resistance by -)/i.test(raw);
      effects.push({
        family: match[1],
        axes: demerit
          ? Object.fromEntries(
              Object.entries(match[2]).map(([axis, value]) => [axis, -value]),
            )
          : match[2],
        rawText: raw,
        potential,
        slot,
        modes: /Guild Battle only|PvP only/i.test(raw)
          ? ["pvp"]
          : ["pve", "pvp"],
        stackGroup: match[1],
        demerit,
        condition: scaling
          ? "Richiede " +
            scaling.pieces +
            " " +
            (scaling.gearType === "defence" ? "difensivi" : "armi") +
            " " +
            scaling.element
          : null,
        scaling,
        sourceRefs,
      });
    }
  }
  return { effects, unknownEffects };
}
export function resolveEffects(item: Item, ctx: EvalContext) {
  const active: Effect[] = [],
    inactive: { effect: Effect; reason: string }[] = [],
    unresolved: { text: string; reason: string }[] = [];
  const conditions: string[] = [];
  for (const e of item.effects) {
    if (
      !e.modes.some(
        (mode) => normalizeMode(mode) === normalizeMode(ctx.profile.mode),
      )
    ) {
      inactive.push({ effect: e, reason: "Modalità non applicabile" });
      continue;
    }
    if (
      ctx.scenario === "personal" &&
      e.potential > (ctx.ownedCopy?.potential ?? 0)
    ) {
      inactive.push({
        effect: e,
        reason: "Richiede potenziale " + e.potential,
      });
      continue;
    }
    if (
      e.slot === "main" &&
      ctx.slot !== "main" &&
      ctx.scenario === "personal"
    ) {
      inactive.push({ effect: e, reason: "Richiede main slot" });
      continue;
    }
    if (e.scaling) {
      const reason =
        "Scaling massimo: " +
        e.scaling.pieces +
        (e.scaling.gearType === "defence" ? " difensivi " : " armi ") +
        e.scaling.element;
      if (ctx.scenario === "maximum") conditions.push(reason);
      else if (
        (ctx.elementCount?.[
          e.scaling.gearType === "defence"
            ? e.scaling.element + ":defence"
            : e.scaling.element
        ] ?? 0) < e.scaling.pieces
      ) {
        unresolved.push({
          text: e.rawText,
          reason: "Scaling non soddisfatto: contributo da verificare",
        });
        continue;
      }
    }
    if (ctx.scenario === "maximum" && e.potential)
      conditions.push("Richiede Hidden Potential " + e.potential);
    if (ctx.scenario === "maximum" && e.slot === "main")
      conditions.push("Richiede main slot");
    active.push(e);
  }
  for (const u of item.unknownEffects as any[])
    if (
      ctx.scenario === "maximum" ||
      (u.potential ?? 0) <= (ctx.ownedCopy?.potential ?? 0)
    )
      unresolved.push(u);
  return { active, inactive, unresolved, conditions };
}
export function evaluateItem(item: Item, ctx: EvalContext): Evaluation {
  const resolved = resolveEffects(item, ctx);
  const missing = resolved.unresolved.map((u) => u.reason + ": " + u.text);
  if (!ctx.profile.classId) missing.unshift("Seleziona la classe nel profilo");
  const allowed = CLASS_WEAPONS[ctx.profile.classId || ""];
  const incompatible =
    item.kind === "weapon" &&
    allowed &&
    item.gearType &&
    !allowed.includes(item.gearType);
  const rawAxes = { damage: 0, survival: 0, support: 0, synergy: 0 },
    axes = { ...rawAxes },
    positive = new Map<string, number>(),
    negative = new Map<string, number>();
  const contributions: Evaluation["contributions"] = [];
  for (const e of incompatible ? [] : resolved.active) {
    contributions.push({
      family: e.family,
      axes: e.axes,
      reason: e.rawText,
      sourceRefs: e.sourceRefs,
    });
    for (const axis of Object.keys(rawAxes) as Axis[]) {
      const value = e.axes[axis] ?? 0;
      if (value < 0) {
        const k = e.family + "|" + e.rawText + "|" + axis;
        negative.set(k, value);
      } else {
        const k = e.family + "|" + axis;
        positive.set(k, Math.max(value, positive.get(k) || 0));
      }
    }
  }
  for (const [key, value] of [...positive, ...negative]) {
    const axis = key.split("|").at(-1) as Axis;
    rawAxes[axis] += value;
  }
  for (const a of Object.keys(axes) as Axis[])
    axes[a] = Math.max(0, Math.min(4, rawAxes[a]));
  const weights = {
    damage: [40, 15, 15, 30],
    defence: [15, 40, 20, 25],
    support: [10, 25, 40, 25],
  }[ctx.profile.role];
  const score =
    Object.values(axes).reduce((s, v, i) => s + v * weights[i], 0) / 4;
  return {
    status: missing.length ? "insufficient-data" : "complete",
    score: missing.length ? null : score,
    axes,
    rawAxes,
    contributions,
    conditions: [
      ...new Set(resolved.conditions),
      ...resolved.inactive.map((x) => x.reason),
      ...(incompatible
        ? ["Tipo arma non compatibile con la classe principale"]
        : []),
    ],
    missing,
    version: RULE_VERSION,
    scenario:
      ctx.scenario === "maximum" ? "Potenziale massimo" : "Copia attuale",
  };
}
export function assessTargetNeed(
  item: Item,
  state: UserState,
  catalogue?: Map<string, Item>,
) {
  const evaluation = evaluateItem(item, {
    profile: state.profile,
    scenario: "maximum",
  });
  let benefit =
    evaluation.score === null
      ? "unknown"
      : evaluation.score === 0
        ? "irrelevant"
        : state.copies.some((c) => c.itemId === item.id)
          ? "redundant"
          : "profile-fit";
  const requirements = [...evaluation.conditions];
  const build = state.builds.find(
    (b) =>
      normalizeMode(b.mode) === normalizeMode(state.profile.mode) &&
      b.slots.length,
  );
  if (build && benefit === "profile-fit") {
    if (!catalogue) {
      benefit = "unknown";
      requirements.push("Configurazione attuale non disponibile");
    } else {
      const current = evaluateConfiguredBuild(state, build.id, catalogue);
      if (current.score === null) {
        benefit = "unknown";
        requirements.push(
          "Configurazione attuale incompleta: confronto non verificabile",
        );
      } else {
        const benefits = evaluation.contributions.flatMap((c) =>
          Object.entries(c.axes)
            .filter(([, v]) => v > 0)
            .map(([axis, value]) => ({ family: c.family, axis, value })),
        );
        const covered =
          benefits.length > 0 &&
          benefits.every((b) =>
            current.contributions.some(
              (c) =>
                c.family === b.family &&
                ((c.axes as Record<string, number>)[b.axis] || 0) >= b.value,
            ),
          );
        if (covered) {
          benefit = "redundant";
          requirements.push(
            "I contributi del bersaglio sono già coperti nella configurazione attuale",
          );
        }
      }
    }
  }
  return { evaluation, benefit, delta: null, requirements };
}
export function evaluateReplacement(
  current: Item[],
  old: Item,
  replacement: Item,
  ctx: EvalContext,
) {
  const combined = (items: Item[]) => ({
    ...replacement,
    effects: items.flatMap((i) => i.effects),
    unknownEffects: items.flatMap((i) => i.unknownEffects),
  });
  const before = evaluateItem(combined(current), ctx),
    after = evaluateItem(
      combined(current.map((i) => (i.id === old.id ? replacement : i))),
      ctx,
    );
  return {
    before,
    after,
    delta:
      before.score === null || after.score === null
        ? null
        : after.score - before.score,
  };
}

export function evaluateConfiguredBuild(
  state: UserState,
  buildId: string,
  catalogue: Map<string, Item>,
): Evaluation {
  const build = state.builds.find((b) => b.id === buildId);
  if (!build) throw new Error("Configurazione inesistente");
  const counts: Record<string, number> = {};
  for (const slot of build.slots) {
    const copy = state.copies.find((c) => c.copyId === slot.copyId),
      item = copy ? catalogue.get(copy.itemId) : undefined;
    if (item?.element) {
      const key =
        item.kind === "weapon" ? item.element : item.element + ":" + item.kind;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  const effects: Effect[] = [],
    unknownEffects: { text: string; reason: string }[] = [],
    conditions: string[] = [];
  for (const assignment of build.slots) {
    const copy = state.copies.find((c) => c.copyId === assignment.copyId),
      item = copy ? catalogue.get(copy.itemId) : undefined;
    if (!copy || !item) {
      unknownEffects.push({
        text: assignment.copyId,
        reason: "Scheda della copia non disponibile",
      });
      continue;
    }
    const allowed = CLASS_WEAPONS[state.profile.classId || ""];
    if (item.kind === "weapon" && allowed && !allowed.includes(item.gearType)) {
      conditions.push(item.name + ": arma non compatibile con la classe");
      continue;
    }
    const r = resolveEffects(item, {
      profile: { ...state.profile, mode: build.mode },
      scenario: "personal",
      ownedCopy: copy,
      slot: assignment.slot,
      elementCount: counts,
    });
    effects.push(
      ...r.active.map((e) => ({
        ...e,
        potential: 0,
        slot: "any" as const,
        scaling: null,
      })),
    );
    unknownEffects.push(...r.unresolved);
    conditions.push(
      ...r.conditions,
      ...r.inactive.map((x) => item.name + ": " + x.reason),
    );
  }
  const aggregate = {
    id: "configured-build",
    name: build.name,
    kind: "monster",
    gearType: "Monster",
    effects,
    unknownEffects,
  } as Item;
  const result = evaluateItem(aggregate, {
    profile: { ...state.profile, mode: build.mode },
    scenario: "personal",
  });
  result.conditions = [...new Set([...result.conditions, ...conditions])];
  return result;
}
export function evaluateBuildReplacement(
  state: UserState,
  buildId: string,
  oldCopyId: string,
  newCopyId: string,
  catalogue: Map<string, Item>,
) {
  const build = state.builds.find((b) => b.id === buildId);
  if (
    !build ||
    !build.slots.some((s) => s.copyId === oldCopyId) ||
    !state.copies.some((c) => c.copyId === newCopyId) ||
    (oldCopyId !== newCopyId && build.slots.some((s) => s.copyId === newCopyId))
  )
    throw new Error("Sostituzione non valida");
  const next = structuredClone(state);
  next.builds.find((b) => b.id === buildId)!.slots = build.slots.map((s) =>
    s.copyId === oldCopyId ? { ...s, copyId: newCopyId } : s,
  );
  const before = evaluateConfiguredBuild(state, buildId, catalogue),
    after = evaluateConfiguredBuild(next, buildId, catalogue);
  return {
    before,
    after,
    delta:
      before.score === null || after.score === null
        ? null
        : after.score - before.score,
  };
}
