import { Profile, SourceRef } from "./contracts";
export interface Reward {
  kind: "fixed" | "categorical" | "unknown";
  outcomes: {
    probability: number;
    value: { itemIds: string[]; medals: number };
  }[];
}
export interface Step {
  id: string;
  costGems: number;
  drawCount: number;
  outcomeModel: {
    kind: "joint" | "independent" | "unknown";
    joint: Reward | null;
    draws: Reward | null;
    medals: Reward | null;
    independenceSource: SourceRef | null;
  };
  guarantees: { drawIndex: number; distribution: Reward }[];
  pity: {
    threshold: number;
    distribution: Reward;
    resetOnTarget: boolean;
  } | null;
}
export interface Banner {
  id: string;
  revision: number;
  name: string;
  edition: string;
  verifiedAt: string;
  startsAt: string | null;
  endsAt: string | null;
  availability: string;
  sourceRefs: SourceRef[];
  targetItemIds: string[];
  steps: Step[];
  repeatFrom: number | null;
  maxCycles: number | null;
  exchange: {
    targetItemId: string;
    medalsRequired: number;
    exchangeLimit: number;
  } | null;
  boxModel: unknown;
}
export interface Progress {
  ownedMedals: number;
  stepIndex: number;
  cycleIndex: number;
  pityCount: number;
}
const integer = (n: unknown, min = 0) =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= 10000000;
const object = (v: any) => !!v && typeof v === "object" && !Array.isArray(v);
const nonempty = (v: any) => typeof v === "string" && !!v.trim();
const date = (v: any) => nonempty(v) && Number.isFinite(Date.parse(v));
function validSource(v: any) {
  return (
    object(v) &&
    nonempty(v.id) &&
    typeof v.url === "string" &&
    (/^https?:\/\//.test(v.url) ||
      (v.id === "user-scenario" && v.url === "" && v.kind === "editorial")) &&
    ["official", "guide", "editorial"].includes(v.kind) &&
    date(v.fetchedAt) &&
    (v.declaredUpdated === null || date(v.declaredUpdated)) &&
    (v.edition === null || nonempty(v.edition))
  );
}
function distributionErrors(d: any, label: string, required = false): string[] {
  if (d === null && !required) return [];
  if (
    !object(d) ||
    !["fixed", "categorical", "unknown"].includes(d.kind) ||
    !Array.isArray(d.outcomes)
  )
    return [label + ": distribuzione non valida"];
  if (d.kind === "unknown")
    return d.outcomes.length
      ? [label + ": esiti di distribuzione sconosciuta"]
      : [];
  if (!d.outcomes.length) return [label + ": esiti mancanti"];
  const errors: string[] = [];
  let sum = 0;
  for (const o of d.outcomes) {
    if (
      !object(o) ||
      typeof o.probability !== "number" ||
      !Number.isFinite(o.probability) ||
      o.probability < 0 ||
      o.probability > 1 ||
      !object(o.value) ||
      !Array.isArray(o.value.itemIds) ||
      !o.value.itemIds.every(nonempty) ||
      !integer(o.value.medals)
    ) {
      errors.push(label + ": esito non valido");
      continue;
    }
    sum += o.probability;
  }
  if (
    Math.abs(sum - 1) > 1e-9 ||
    (d.kind === "fixed" && (d.outcomes.length !== 1 || sum !== 1))
  )
    errors.push(label + ": probabilità non sommano a 1");
  return errors;
}
export function validateBanner(v: any) {
  const errors: string[] = [];
  if (!object(v)) return { ok: false, errors: ["Record non valido"] };
  if (
    !nonempty(v.id) ||
    !nonempty(v.name) ||
    !integer(v.revision, 1) ||
    !nonempty(v.edition) ||
    !date(v.verifiedAt) ||
    !nonempty(v.availability)
  )
    errors.push("Identità, revisione o verifica non valida");
  if (
    !Array.isArray(v.sourceRefs) ||
    !v.sourceRefs.length ||
    !v.sourceRefs.every(validSource)
  )
    errors.push("Fonti mancanti o non valide");
  if (
    !Array.isArray(v.targetItemIds) ||
    !v.targetItemIds.length ||
    !v.targetItemIds.every(nonempty)
  )
    errors.push("Bersagli mancanti o non validi");
  for (const key of ["startsAt", "endsAt"])
    if (v[key] !== null && !date(v[key]))
      errors.push("Data di disponibilità non valida");
  if (!Array.isArray(v.steps) || !v.steps.length || v.steps.length > 100)
    errors.push("Step mancanti o troppi");
  else
    for (const s of v.steps) {
      if (!object(s)) {
        errors.push("Step non valido");
        continue;
      }
      if (
        !nonempty(s.id) ||
        !integer(s.costGems) ||
        !integer(s.drawCount, 1) ||
        s.drawCount > 1000
      )
        errors.push("Costo o draw dello step non valido");
      const m = s.outcomeModel;
      if (!object(m) || !["joint", "independent", "unknown"].includes(m.kind)) {
        errors.push("Modello dello step mancante");
        continue;
      }
      if (m.kind === "independent" && !validSource(m.independenceSource))
        errors.push("Fonte dell’indipendenza mancante o non valida");
      if (m.kind === "joint" && (s.guarantees?.length || s.pity))
        errors.push(
          "Il modello joint deve già includere garanzie e pity nei suoi esiti",
        );
      errors.push(
        ...distributionErrors(m.joint, "joint", m.kind === "joint"),
        ...distributionErrors(m.draws, "draw", m.kind === "independent"),
        ...distributionErrors(m.medals, "medaglie"),
      );
      if (!Array.isArray(s.guarantees)) errors.push("Garanzie non valide");
      else {
        const indices = new Set();
        for (const g of s.guarantees) {
          if (!object(g)) {
            errors.push("Garanzia non valida");
            continue;
          }
          if (
            !integer(g.drawIndex) ||
            g.drawIndex >= s.drawCount ||
            indices.has(g.drawIndex)
          )
            errors.push("Draw di garanzia duplicato o fuori intervallo");
          indices.add(g.drawIndex);
          errors.push(...distributionErrors(g.distribution, "garanzia", true));
        }
      }
      if (s.pity !== null) {
        if (!object(s.pity)) errors.push("Pity non valido");
        else {
          if (
            !integer(s.pity.threshold, 1) ||
            typeof s.pity.resetOnTarget !== "boolean"
          )
            errors.push("Soglia pity non valida");
          errors.push(...distributionErrors(s.pity.distribution, "pity", true));
        }
      }
    }
  if (
    v.repeatFrom !== null &&
    (!integer(v.repeatFrom) ||
      !Array.isArray(v.steps) ||
      v.repeatFrom >= v.steps.length)
  )
    errors.push("Reset step non valido");
  if (v.maxCycles !== null && !integer(v.maxCycles, 1))
    errors.push("Numero cicli non valido");
  if (
    v.exchange !== null &&
    (!object(v.exchange) ||
      !integer(v.exchange.medalsRequired, 1) ||
      !integer(v.exchange.exchangeLimit, 1) ||
      !Array.isArray(v.targetItemIds) ||
      !v.targetItemIds.includes(v.exchange.targetItemId))
  )
    errors.push("Scambio non valido");
  return {
    ok: !errors.length,
    data: errors.length ? undefined : (v as Banner),
    errors,
  };
}
export function bannerAvailability(
  b: Banner,
  { edition = "WW", now = new Date().toISOString() } = {},
) {
  if (b.edition !== edition) return "wrong-edition";
  const timed = (s: string | null) =>
    !!s && /T.*(Z|[+-]\d{2}:\d{2})$/.test(s) && Number.isFinite(Date.parse(s));
  if (
    !timed(b.startsAt) ||
    !timed(b.endsAt) ||
    Date.parse(b.endsAt!) <= Date.parse(b.startsAt!)
  )
    return "unknown";
  const t = Date.parse(now);
  if (t >= Date.parse(b.endsAt!)) return "expired";
  return t >= Date.parse(b.startsAt!) ? "active" : "unknown";
}
function checkProgress(p: Progress, b: Banner) {
  if (
    !integer(p.ownedMedals) ||
    !integer(p.stepIndex) ||
    p.stepIndex >= b.steps.length ||
    !integer(p.cycleIndex) ||
    !integer(p.pityCount)
  )
    throw new Error("Avanzamento non valido");
}
function nextStep(b: Banner, p: Progress) {
  p.stepIndex++;
  if (p.stepIndex >= b.steps.length) {
    p.cycleIndex++;
    if (
      b.repeatFrom === null ||
      (b.maxCycles !== null && p.cycleIndex >= b.maxCycles)
    )
      return false;
    p.stepIndex = b.repeatFrom;
  }
  return true;
}
function unresolvedReward(
  d: Reward | null,
  medals: number,
  id: string,
  exchange: Banner["exchange"],
) {
  if (!d || d.kind === "unknown") return { target: false, medals };
  const failures = d.outcomes
    .filter((o) => o.probability > 0)
    .filter(
      (o) =>
        !o.value.itemIds.includes(id) &&
        !(
          exchange?.targetItemId === id &&
          medals + o.value.medals >= exchange.medalsRequired
        ),
    );
  return failures.length
    ? {
        target: false,
        medals: Math.min(...failures.map((o) => medals + o.value.medals)),
      }
    : { target: true, medals };
}
export function analyseGuaranteedTarget(
  b: Banner,
  opts: Progress & { targetItemId: string },
) {
  const valid = validateBanner(b);
  if (!valid.ok) throw new Error(valid.errors.join("; "));
  checkProgress(opts, b);
  const p = { ...opts };
  const milestones: {
    stepId: string;
    additionalGems: number;
    guaranteedTarget: boolean;
  }[] = [];
  let total = 0,
    medals = p.ownedMedals;
  if (
    b.exchange?.targetItemId === opts.targetItemId &&
    medals >= b.exchange.medalsRequired
  )
    return { reachable: true, additionalGems: 0, milestones };
  for (let attempt = 0; attempt < 2000; attempt++) {
    const s = b.steps[p.stepIndex],
      m = s.outcomeModel;
    total += s.costGems;
    let target = false;
    if (m.kind === "joint") {
      ({ target, medals } = unresolvedReward(
        m.joint,
        medals,
        opts.targetItemId,
        b.exchange,
      ));
    } else {
      ({ target, medals } = unresolvedReward(
        m.medals,
        medals,
        opts.targetItemId,
        b.exchange,
      ));
      for (let i = 0; i < s.drawCount; i++) {
        p.pityCount++;
        const guarantee = s.guarantees.find((g) => g.drawIndex === i);
        const d =
          s.pity && p.pityCount >= s.pity.threshold
            ? s.pity.distribution
            : guarantee?.distribution || m.draws;
        if (!target)
          ({ target, medals } = unresolvedReward(
            d,
            medals,
            opts.targetItemId,
            b.exchange,
          ));
        if (s.pity && p.pityCount >= s.pity.threshold) p.pityCount = 0;
      }
    }
    if (
      b.exchange?.targetItemId === opts.targetItemId &&
      medals >= b.exchange.medalsRequired
    )
      target = true;
    milestones.push({
      stepId: s.id,
      additionalGems: total,
      guaranteedTarget: target,
    });
    if (target) return { reachable: true, additionalGems: total, milestones };
    if (!nextStep(b, p)) break;
  }
  return { reachable: false, additionalGems: null, milestones };
}
export function independentSuccessProbability({
  probabilityPerUnit: p,
  units: n,
}: {
  probabilityPerUnit: number;
  units: number;
}) {
  if (!Number.isFinite(p) || p < 0 || p > 1 || !integer(n))
    throw new Error("Probabilità o numero di tentativi non valido");
  return n === 0 ? 0 : p === 1 ? 1 : 1 - Math.pow(1 - p, n);
}
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sample(d: Reward | null, random: () => number) {
  if (!d || d.kind === "unknown")
    throw new Error("Probabilità o esiti mancanti");
  const r = random();
  let sum = 0;
  for (const o of d.outcomes) {
    sum += o.probability;
    if (r < sum) return o.value;
  }
  return d.outcomes.at(-1)!.value;
}
export function simulateTarget(
  b: Banner,
  opts: Progress & {
    targetItemId: string;
    budgetGems: number;
    trials?: number;
    seed?: number;
    maxAttempts?: number;
  },
) {
  const valid = validateBanner(b);
  if (!valid.ok) throw new Error(valid.errors.join("; "));
  checkProgress(opts, b);
  if (b.boxModel)
    throw new Error(
      "Modello box non verificato: inserire una distribuzione completa",
    );
  const trials = opts.trials ?? 10000,
    maxAttempts = opts.maxAttempts ?? 2000;
  if (
    !integer(trials, 1) ||
    trials > 100000 ||
    !integer(maxAttempts, 1) ||
    maxAttempts > 2000 ||
    !integer(opts.budgetGems)
  )
    throw new Error("Limiti simulazione non validi");
  const random = rng(opts.seed ?? 42),
    costs: number[] = [],
    milestones = new Map<number, string>();
  let within = 0;
  for (let trial = 0; trial < trials; trial++) {
    const p = { ...opts };
    let cost = 0,
      medals = p.ownedMedals,
      done =
        b.exchange?.targetItemId === opts.targetItemId &&
        medals >= b.exchange.medalsRequired;
    for (let attempt = 0; attempt < maxAttempts && !done; attempt++) {
      const s = b.steps[p.stepIndex],
        m = s.outcomeModel;
      cost += s.costGems;
      if (cost <= opts.budgetGems) milestones.set(cost, s.id);
      let items: string[] = [];
      if (m.kind === "joint") {
        const r = sample(m.joint, random);
        items = r.itemIds;
        medals += r.medals;
      } else {
        if (m.kind !== "independent")
          throw new Error("Esiti dello step sconosciuti");
        const r = sample(m.medals, random);
        items.push(...r.itemIds);
        medals += r.medals;
        for (let i = 0; i < s.drawCount; i++) {
          p.pityCount++;
          const g = s.guarantees.find((g) => g.drawIndex === i);
          const distribution =
            s.pity && p.pityCount >= s.pity.threshold
              ? s.pity.distribution
              : g?.distribution || m.draws;
          const draw = sample(distribution, random);
          items.push(...draw.itemIds);
          medals += draw.medals;
          if (
            s.pity &&
            (p.pityCount >= s.pity.threshold ||
              (s.pity.resetOnTarget &&
                draw.itemIds.includes(opts.targetItemId)))
          )
            p.pityCount = 0;
        }
      }
      done =
        items.includes(opts.targetItemId) ||
        (b.exchange?.targetItemId === opts.targetItemId &&
          medals >= b.exchange.medalsRequired);
      if (!done && !nextStep(b, p)) break;
    }
    if (done) {
      costs.push(cost);
      if (cost <= opts.budgetGems) within++;
    }
  }
  costs.sort((a, b) => a - b);
  const completed = costs.length,
    mean = completed ? costs.reduce((s, c) => s + c, 0) / completed : null;
  const quantile = (p: number) =>
    completed / trials >= p
      ? costs[Math.max(0, Math.ceil(trials * p) - 1)]
      : null;
  return {
    trials,
    completed,
    completionFraction: completed / trials,
    successWithinBudget: within / trials,
    meanAdditionalGems: completed === trials ? mean : null,
    meanCompletedAdditionalGems: mean,
    medianAdditionalGems: quantile(0.5),
    p80AdditionalGems: quantile(0.8),
    p95AdditionalGems: quantile(0.95),
    censored: completed < trials,
    assumptionLabels: [
      "Modello inserito e seed riproducibile; stop alla prima acquisizione",
      "Pity conteggiato per draw",
    ],
    costByMilestone: [...milestones]
      .sort((a, b) => a[0] - b[0])
      .map(([cost, stepId]) => ({
        stepId,
        additionalGems: cost,
        successProbability: costs.filter((c) => c <= cost).length / trials,
      })),
  };
}
export function buildBenchmark(records: any[], target: any) {
  let matches = records.filter(
    (r) =>
      r.edition === target.edition &&
      r.metric === target.metric &&
      r.potentialLevel === target.potentialLevel &&
      Number.isFinite(r.additionalGems),
  );
  const exact = matches.filter((r) => r.targetItemId === target.targetItemId);
  matches = exact.length
    ? exact
    : matches.filter(
        (r) =>
          r.kind === target.kind &&
          r.role === target.role &&
          r.element === target.element &&
          JSON.stringify(r.effectFamilies || []) ===
            JSON.stringify(target.effectFamilies || []),
      );
  const n = matches.length,
    values = matches.map((r) => r.additionalGems).sort((a, b) => a - b);
  return {
    status: n > 1 ? "available" : n ? "single-reference" : "unavailable",
    median: n
      ? n % 2
        ? values[(n - 1) / 2]
        : (values[n / 2 - 1] + values[n / 2]) / 2
      : null,
    mean: n ? values.reduce((s, v) => s + v, 0) / n : null,
    records: matches,
    comparisonLabel: exact.length
      ? "Stesso bersaglio, metrica e potenziale"
      : "Stesso ruolo, elemento e famiglie di effetti",
  };
}
export function recommendSpawn(input: any) {
  const {
    banner: b,
    profile,
    guaranteed: g,
    simulation: s,
    targetAssessment: t,
  } = input;
  if (
    !profile ||
    !integer(profile.availableGems) ||
    !integer(profile.reserveGems) ||
    (input.risk?.enabled &&
      (!integer(input.risk.budgetCap) ||
        !Number.isFinite(input.risk.successThreshold) ||
        input.risk.successThreshold <= 0 ||
        input.risk.successThreshold >= 1))
  )
    throw new Error("Budget o soglia di rischio non validi");
  const spendableGems = Math.max(
    0,
    profile.availableGems - profile.reserveGems,
  );
  const missing: string[] = [],
    reasonCodes: string[] = [];
  let verdict = "save",
    limit: number | null = 0,
    stopStepId: string | null = null;
  const availability = input.custom
    ? "custom"
    : bannerAvailability(b, { edition: "WW", now: input.now });
  if (!["active", "custom"].includes(availability)) {
    missing.push("Disponibilità WW non verificata o banner scaduto");
  }
  if (!t || t.evaluation?.status !== "complete" || t.benefit === "unknown")
    missing.push("Utilità del bersaglio non verificata");
  if (missing.length) {
    verdict = "insufficient-data";
    limit = null;
  } else if (["redundant", "irrelevant"].includes(t.benefit)) {
    reasonCodes.push("Il bersaglio non risolve una necessità nuova del set");
  } else {
    const dominates = (input.alternatives || []).some(
      (a: any) =>
        a.availability === "active" &&
        a.metric === "guaranteed" &&
        a.score >= t.evaluation.score &&
        a.additionalGems <= g.additionalGems &&
        (a.score > t.evaluation.score || a.additionalGems < g.additionalGems),
    );
    if (dominates)
      reasonCodes.push(
        "Alternativa attiva almeno altrettanto utile e meno costosa",
      );
    else if (g.reachable && g.additionalGems <= spendableGems) {
      verdict = "recommended";
      limit = g.additionalGems;
      stopStepId =
        g.milestones?.find((m: any) => m.guaranteedTarget)?.stepId || null;
      reasonCodes.push("Primo traguardo garantito utile entro il budget");
    } else if (
      input.usefulFirstStep &&
      input.usefulFirstStep.additionalGems <= spendableGems
    ) {
      verdict = "step-only";
      limit = input.usefulFirstStep.additionalGems;
      stopStepId = input.usefulFirstStep.stepId;
      reasonCodes.push(
        "Solo il primo premio garantito è giustificato dal budget",
      );
    } else if (input.risk?.enabled && s) {
      const cap = Math.min(spendableGems, input.risk.budgetCap);
      const milestone = s.costByMilestone.find(
        (m: any) =>
          m.additionalGems <= cap &&
          m.successProbability >= input.risk.successThreshold,
      );
      if (milestone) {
        verdict = "risk-attempt";
        limit = milestone.additionalGems;
        stopStepId = milestone.stepId;
        reasonCodes.push(
          "Soglia di successo scelta raggiunta; resta rischio di fallimento",
        );
      } else
        reasonCodes.push(
          "Soglia di successo non raggiunta entro il tetto scelto",
        );
    } else
      reasonCodes.push(
        g.reachable
          ? "Garanzia oltre il budget spendibile"
          : "Nessuna garanzia raggiungibile: politica prudente",
      );
  }
  if (limit !== null && limit > spendableGems)
    throw new Error("Limite oltre budget");
  return {
    verdict,
    limitAdditionalGems: limit,
    stopStepId,
    spendableGems,
    expectedRemainingGems:
      limit === null ? null : profile.availableGems - limit,
    targetItemId: input.targetItemId || b.targetItemIds[0],
    reasonCodes,
    costs: {
      guaranteed: g.additionalGems,
      mean: s?.meanAdditionalGems ?? null,
      conditionalMean: s?.meanCompletedAdditionalGems ?? null,
      median: s?.medianAdditionalGems ?? null,
      p80: s?.p80AdditionalGems ?? null,
      p95: s?.p95AdditionalGems ?? null,
    },
    risks: {
      successWithinBudget: s?.successWithinBudget ?? null,
      completionFraction: s?.completionFraction ?? null,
      censored: s?.censored ?? false,
    },
    benchmark: input.benchmark || { status: "unavailable" },
    missing,
    sourceRefs: b.sourceRefs,
    custom: !!input.custom,
  };
}
export const verdictLabels: Record<string, string> = {
  recommended: "Consigliata per il tuo obiettivo",
  "step-only": "Conviene solo fino a questo step",
  "risk-attempt": "Tentativo a rischio",
  save: "Risparmia per questo obiettivo",
  "insufficient-data": "Dati insufficienti",
};
export function explainSpawn(
  a: any,
  {
    profile,
    itemNames,
  }: { profile: Profile; itemNames: Record<string, string> },
) {
  const n = (v: number) =>
    new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(v);
  const target = itemNames[a.targetItemId] || "il bersaglio scelto";
  const limit = a.limitAdditionalGems;
  const summary =
    limit === null
      ? "Dati insufficienti per consigliare una spesa su " + target + "."
      : limit === 0
        ? "Risparmia: il limite consigliato è 0 gemme per " + target + "."
        : verdictLabels[a.verdict] +
          ": fino a " +
          n(limit) +
          " gemme aggiuntive per " +
          target +
          ". Fermati appena lo ottieni, oppure al limite.";
  return {
    summary,
    sections: [
      {
        id: "profile",
        title: "Per chi",
        text:
          (profile.classId || "Classe da scegliere") +
          " · " +
          profile.mode.toUpperCase() +
          " · ruolo " +
          { damage: "danno", defence: "difesa", support: "supporto" }[
            profile.role
          ] +
          ". " +
          (a.custom
            ? "Scenario personalizzato: utilità e condizioni dichiarate da te."
            : "Valutazione per il profilo selezionato."),
      },
      {
        id: "cost",
        title: "Costo e confronto",
        text:
          "Garanzia: " +
          (a.costs.guaranteed === null
            ? "non determinabile"
            : n(a.costs.guaranteed) + " gemme") +
          ". Media: " +
          (a.costs.mean === null
            ? "non disponibile"
            : n(a.costs.mean) + " gemme") +
          ". " +
          (a.benchmark.status === "unavailable"
            ? "Benchmark storico comparabile non disponibile."
            : "Riferimento " +
              a.benchmark.status +
              ": " +
              n(a.benchmark.median) +
              " gemme."),
      },
      {
        id: "budget",
        title: "Punto di arresto",
        text:
          "Budget spendibile " +
          n(a.spendableGems) +
          " gemme, riserva " +
          n(profile.reserveGems) +
          ". " +
          (limit === null
            ? "Completa i dati prima di scegliere una spesa."
            : "Saldo al limite " +
              n(a.expectedRemainingGems) +
              " gemme. Il costo già sostenuto non giustifica altre spawn."),
      },
      {
        id: "reason",
        title: "Perché",
        text:
          [...a.reasonCodes, ...a.missing].join(". ") +
          (a.risks.successWithinBudget !== null
            ? " Probabilità entro il budget: " +
              n(a.risks.successWithinBudget * 100) +
              "%."
            : "") +
          (a.risks.censored
            ? " Alcune prove non completano: la media globale resta sconosciuta."
            : ""),
      },
    ],
    sourceRefs: a.sourceRefs,
  };
}
