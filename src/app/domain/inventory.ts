import { emptyState, UserState, Copy, normalizeMode, goalIdentity } from "./contracts";
import { Validation } from "./validation";
export function validateBackup(value: unknown): Validation<UserState> {
  const v = value as any,
    errors: { path: string; code: string; message: string }[] = [];
  const fail = (path: string, message: string) =>
    errors.push({ path, code: "invalid", message });
  const n = (x: any, min = 0) =>
    Number.isSafeInteger(x) && x >= min && x <= 10000000;
  if (!v || ![1, 2].includes(v.schemaVersion))
    return {
      ok: false,
      errors: [
        {
          path: "schemaVersion",
          code: "unsupported",
          message: "Versione backup non supportata",
        },
      ],
    };
  const p = v.profile;
  if (
    !p ||
    !["damage", "defence", "support"].includes(p.role) ||
    !["pve", "gvg", "pvp"].includes(p.mode) ||
    !(p.classId === null || (typeof p.classId === "string" && p.classId.length <= 200)) ||
    !Array.isArray(p.elements) ||
    p.elements.length > 50 ||
    !p.elements.every((e: any) => typeof e === "string" && e.length <= 200) ||
    !n(p.availableGems) ||
    !n(p.reserveGems)
  )
    fail("profile", "Profilo non valido");
  if (!Array.isArray(v.copies) || !Array.isArray(v.builds))
    fail("copies/builds", "Liste mancanti");
  else {
    const ids = new Set<string>();
    for (const [i, c] of v.copies.entries()) {
      if (
        !c ||
        typeof c.copyId !== "string" ||
        !c.copyId ||
        c.copyId.length > 200 ||
        ids.has(c.copyId) ||
        typeof c.itemId !== "string" ||
        !c.itemId ||
        c.itemId.length > 200 ||
        !n(c.skillLevel, 1) ||
        !n(c.infusions) ||
        !n(c.potential) ||
        !["ATK", "MATK", "DEF", "MDEF"].includes(c.stat1) ||
        !["ATK", "MATK", "DEF", "MDEF"].includes(c.stat2) ||
        typeof c.notes !== "string" ||
        c.notes.length > 10000
      )
        fail("copies." + i, "Copia duplicata o non valida");
      else ids.add(c.copyId);
    }
    const builds = new Set();
    for (const [i, b] of v.builds.entries()) {
      if (
        !b ||
        typeof b.id !== "string" ||
        !b.id ||
        b.id.length > 200 ||
        builds.has(b.id) ||
        typeof b.name !== "string" ||
        b.name.length > 200 ||
        !["pve", "gvg", "pvp"].includes(b.mode) ||
        !Array.isArray(b.slots)
      ) {
        fail("builds." + i, "Configurazione non valida");
        continue;
      }
      builds.add(b.id);
      const assigned = new Set();
      for (const s of b.slots) {
        if (
          !s ||
          typeof s.copyId !== "string" ||
          !ids.has(s.copyId) ||
          assigned.has(s.copyId) ||
          !["main", "sub"].includes(s.slot)
        )
          fail("builds." + i, "Riferimento copia assente o duplicato");
        if (s) assigned.add(s.copyId);
      }
    }
  }
  const goals = v.schemaVersion === 1 ? [] : v.goals;
  if (!Array.isArray(goals)) fail("goals", "Obiettivi mancanti");
  else {
    const ids = new Set<string>();
    for (const [i, g] of goals.entries()) {
      if (!g || typeof g.id !== "string" || !g.id || g.id.length > 500 || ids.has(g.id) ||
        !["acquire", "potential", "element"].includes(g.kind) ||
        typeof g.label !== "string" || !g.label || g.label.length > 500 ||
        !["pve", "pvp", "gvg"].includes(g.mode) ||
        !(g.classId === null || (typeof g.classId === "string" && g.classId.length <= 200)) ||
        !(g.buildId === null || (typeof g.buildId === "string" && g.buildId.length <= 200)) ||
        !n(g.target, 1) || !Array.isArray(g.itemIds) ||
        !g.itemIds.every((id: unknown) => typeof id === "string" && id.length > 0 && id.length <= 200) ||
        !["active", "archived"].includes(g.status) ||
        typeof g.metaVersion !== "string" || g.metaVersion.length > 200 ||
        typeof g.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(g.createdAt) || !Number.isFinite(Date.parse(g.createdAt)) ||
        (g.kind === "acquire" && (!g.itemIds.length || g.target !== 1)) ||
        (g.kind === "potential" && (typeof g.copyId !== "string" || !g.copyId || g.copyId.length > 200)) ||
        (g.kind === "element" && (!g.buildId || !["weapon", "defence"].includes(g.gearKind) || !["Fire","Water","Wind","Light","Dark","Time","Star"].includes(g.element)))
      ) fail("goals." + i, "Obiettivo non valido");
      else ids.add(g.id);
    }
  }
  if (Array.isArray(v.copies) && v.copies.length > 20000) fail("copies", "Troppe copie");
  if (Array.isArray(v.builds) && v.builds.length > 1000) fail("builds", "Troppe configurazioni");
  if (Array.isArray(goals) && goals.length > 2000) fail("goals", "Troppi obiettivi");
  if (new TextEncoder().encode(JSON.stringify(v)).length > 5 * 1024 * 1024) fail("state", "Archivio troppo grande (limite 5 MB)");
  if (errors.length) return { ok: false, errors };
  const data: UserState = structuredClone({schemaVersion: 2, profile: v.profile, copies: v.copies, builds: v.builds, goals});
  data.profile.mode = normalizeMode(data.profile.mode);
  for (const build of data.builds) build.mode = normalizeMode(build.mode);
  for (const goal of data.goals) goal.mode = normalizeMode(goal.mode);
  return { ok: true, data, errors: [] };
}
export function mergeBackup(
  current: UserState,
  incoming: UserState,
  mode: "merge" | "replace",
): UserState {
  const checked = validateBackup(incoming);
  if (!checked.ok)
    throw new Error(checked.errors.map((e) => e.message).join("; "));
  if (mode === "replace") return checked.data!;
  const existing = validateBackup(current);
  if (!existing.ok)
    throw new Error(existing.errors.map((e) => e.message).join("; "));
  const result = existing.data!;
  const mapping = new Map<string, string>();
  const ids = new Set(result.copies.map((c) => c.copyId));
  for (const c of checked.data!.copies) {
    let id = c.copyId;
    let i = 1;
    while (ids.has(id)) id = c.copyId + "-import-" + i++;
    ids.add(id);
    mapping.set(c.copyId, id);
    result.copies.push({ ...c, copyId: id });
  }
  const bids = new Set(result.builds.map((b) => b.id));
  const buildMapping = new Map<string, string>();
  for (const b of checked.data!.builds) {
    let id = b.id,
      i = 1;
    while (bids.has(id)) id = b.id + "-import-" + i++;
    bids.add(id);
    buildMapping.set(b.id, id);
    result.builds.push({
      ...b,
      id,
      slots: b.slots.map((s) => ({ ...s, copyId: mapping.get(s.copyId)! })),
    });
  }
  const goalIds = new Set(result.goals.map(g => g.id));
  const missingCopyRefs = new Map<string,string>(), missingBuildRefs = new Map<string,string>();
  const remapRef = (ref:string, known:Map<string,string>, existing:Set<string>, missing:Map<string,string>) => {
    if (known.has(ref)) return known.get(ref)!;
    if (missing.has(ref)) return missing.get(ref)!;
    let safe=ref, index=1;
    while(existing.has(safe)) safe=ref+"-removed-import-"+index++;
    missing.set(ref,safe);return safe;
  };
  for (const g of checked.data!.goals) {
    let id = g.id, i = 1;
    while (goalIds.has(id)) id = g.id + "-import-" + i++;
    goalIds.add(id);
    const goal = {...g, id, copyId: g.copyId ? remapRef(g.copyId,mapping,ids,missingCopyRefs) : undefined,
      buildId: g.buildId ? remapRef(g.buildId,buildMapping,bids,missingBuildRefs) : null};
    if(goal.status === "active" && result.goals.some(existing=>existing.status==="active"&&goalIdentity(existing)===goalIdentity(goal)))goal.status="archived";
    result.goals.push(goal);
  }
  return result;
}
export function assignCopy(
  state: UserState,
  {
    buildId,
    copyId,
    slot,
  }: { buildId: string; copyId: string; slot: "main" | "sub" },
): Validation<UserState> {
  const next = structuredClone(state),
    b = next.builds.find((b) => b.id === buildId);
  if (
    !b ||
    !next.copies.some((c) => c.copyId === copyId) ||
    b.slots.some((s) => s.copyId === copyId)
  )
    return {
      ok: false,
      errors: [
        {
          path: "slots",
          code: "duplicate",
          message: "Copia già assegnata o inesistente",
        },
      ],
    };
  b.slots.push({ copyId, slot });
  return validateBackup(next);
}
export function newCopy(itemId: string): Copy {
  return {
    copyId: crypto.randomUUID(),
    itemId,
    skillLevel: 1,
    infusions: 0,
    potential: 0,
    stat1: "ATK",
    stat2: "MATK",
    notes: "",
  };
}
export interface CachedPlayerState { state: UserState; revision: number; dirty: boolean }
export function createInventoryStore(factory: IDBFactory, name = "unisonpedia-v1", scope = "guest") {
  const key = scope === "guest" ? "user" : "account:" + scope;
  async function open() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const r = factory.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("state");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error("Archivio occupato da un’altra scheda"));
    });
  }
  async function loadRecord(): Promise<CachedPlayerState> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("state", "readonly");
      const r = tx.objectStore("state").get(key);
      let result: CachedPlayerState = {state: emptyState(), revision: 0, dirty: false};
      r.onsuccess = () => {
        if (!r.result) return;
        const raw = r.result.state ? r.result : {state:r.result, revision:0, dirty:false};
        const v = validateBackup(raw.state);
        if (!v.ok || !Number.isSafeInteger(raw.revision) || raw.revision < 0 || typeof raw.dirty !== "boolean") {
          tx.abort(); return;
        }
        result = {state:v.data!, revision:raw.revision, dirty:raw.dirty};
      };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error("Dati salvati non validi")); };
    });
  }
  async function saveRecord(record: CachedPlayerState) {
    const v = validateBackup(record.state);
    if (!v.ok || !Number.isSafeInteger(record.revision) || record.revision < 0 || typeof record.dirty !== "boolean") throw new Error("Stato non valido");
    const db = await open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put({...record,state:v.data!}, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error("Salvataggio interrotto")); };
    });
  }
  return { loadRecord, saveRecord, async load() { return (await loadRecord()).state; },
    async save(state: UserState) { await saveRecord({state,revision:0,dirty:false}); } };
}
