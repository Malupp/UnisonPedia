import { emptyState, UserState, Copy, normalizeMode } from "./contracts";
import { Validation } from "./validation";
export function validateBackup(value: unknown): Validation<UserState> {
  const v = value as any,
    errors: { path: string; code: string; message: string }[] = [];
  const fail = (path: string, message: string) =>
    errors.push({ path, code: "invalid", message });
  const n = (x: any, min = 0) =>
    Number.isSafeInteger(x) && x >= min && x <= 10000000;
  if (!v || v.schemaVersion !== 1)
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
    !(p.classId === null || typeof p.classId === "string") ||
    !Array.isArray(p.elements) ||
    !p.elements.every((e: any) => typeof e === "string") ||
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
        ids.has(c.copyId) ||
        typeof c.itemId !== "string" ||
        !c.itemId ||
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
        builds.has(b.id) ||
        typeof b.name !== "string" ||
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
  if (errors.length) return { ok: false, errors };
  const data: UserState = structuredClone(v);
  data.profile.mode = normalizeMode(data.profile.mode);
  for (const build of data.builds) build.mode = normalizeMode(build.mode);
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
  for (const b of checked.data!.builds) {
    let id = b.id,
      i = 1;
    while (bids.has(id)) id = b.id + "-import-" + i++;
    bids.add(id);
    result.builds.push({
      ...b,
      id,
      slots: b.slots.map((s) => ({ ...s, copyId: mapping.get(s.copyId)! })),
    });
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
export function createInventoryStore(
  factory: IDBFactory,
  name = "unisonpedia-v1",
) {
  async function open() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const r = factory.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("state");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () =>
        reject(new Error("Archivio occupato da un’altra scheda"));
    });
  }
  return {
    async load(): Promise<UserState> {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("state", "readonly"),
          r = tx.objectStore("state").get("user");
        let result: UserState = emptyState();
        r.onsuccess = () => {
          if (r.result) {
            const v = validateBackup(r.result);
            if (!v.ok) {
              reject(new Error("Dati salvati non validi"));
              return;
            }
            result = v.data!;
          }
        };
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      });
    },
    async save(state: UserState) {
      const v = validateBackup(state);
      if (!v.ok) throw new Error("Stato non valido");
      const db = await open();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(v.data, "user");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = tx.onerror = () => {
          db.close();
          reject(tx.error || new Error("Salvataggio interrotto"));
        };
      });
    },
  };
}
