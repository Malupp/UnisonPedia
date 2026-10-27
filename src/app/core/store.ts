import { Injectable, signal, computed, inject, effect } from "@angular/core";
import {
  Entry,
  Item,
  UserState,
  emptyState,
  Profile,
} from "../domain/contracts";
import {
  createInventoryStore,
  newCopy,
  validateBackup,
} from "../domain/inventory";
import { AuthService } from "./auth";
import { cloudTransport } from "./cloud-sync";
import { PlayerSync, SyncSnapshot } from "../domain/sync";
import { mergeBackup } from "../domain/inventory";
import { normalizeSections } from "../domain/evaluation";
import { classWeaponLabel } from "../domain/class-weapons";
import { WeaponContextIndex, WeaponTalent } from "../domain/weapon-context";
@Injectable({ providedIn: "root" })
export class Store {
  entries = signal<Entry[]>([]);
  manifest = signal<any>(null);
  sources = signal<any[]>([]);
  chapters = signal<any[]>([]);
  glossary = signal<any[]>([]);
  classes = signal<any[]>([]);
  showAllWeapons = signal(false);
  weaponTypes = computed(() => classWeaponLabel(this.profile().classId));
  weaponClass = computed(() =>
    this.showAllWeapons() ? null : this.profile().classId,
  );
  weaponContext = signal<WeaponContextIndex | null>(null);
  weaponContextError = signal("");
  weaponTalents = computed(() => {
    const data = this.weaponContext(),
      result: Record<string, WeaponTalent> = {};
    if (data)
      for (const [id, key] of Object.entries(data.items))
        if (data.talents[key]) result[id] = data.talents[key];
    return result;
  });
  state = signal<UserState>(emptyState());
  ready = signal(false);
  loading = signal(true);
  error = signal("");
  notice = signal("");
  storageDenied = signal(false);
  compared = signal<string[]>([]);
  private details = new Map<string, Promise<Item>>();
  auth = inject(AuthService);
  sync = signal<SyncSnapshot>({
    owner: null,
    state: emptyState(),
    revision: 0,
    dirty: false,
    status: "loading",
    error: "",
    cacheError: false,
    remote: null,
  });
  private engine = new PlayerSync(
    cloudTransport(this.auth),
    (owner) =>
      createInventoryStore(indexedDB, "unisonpedia-v1", owner ?? "guest"),
    (snapshot) => {
      this.sync.set(snapshot);
      this.state.set(snapshot.state);
      this.ready.set(snapshot.status !== "loading");
      this.storageDenied.set(snapshot.cacheError);
    },
  );
  private activeOwner: string | null | undefined = undefined;
  syncLabel = computed(
    () =>
      ({
        loading: "Caricamento inventario…",
        local: "Salvato nel browser",
        saving: "Salvataggio online…",
        synced: "Salvato online",
        pending: this.sync().dirty
          ? "Modifiche in attesa di invio"
          : "Cloud da verificare",
        conflict: "Conflitto da risolvere",
      })[this.sync().status],
  );
  profile = computed(() => this.state().profile);
  constructor() {
    effect(() => {
      const session = this.auth.session();
      if (this.auth.loading()) return;
      const owner = session?.user.id ?? null;
      if (owner !== this.activeOwner) {
        this.activeOwner = owner;
        void this.engine.activate(owner);
      }
    });
    window.addEventListener("online", () => {
      void this.retrySync();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.activeOwner)
        void this.retrySync();
    });
    void this.initialize();
    void this.read("catalogue/weapon-context")
      .then((data: WeaponContextIndex) => {
        if (data.version !== 1 || !data.items || !data.talents)
          throw Error("Invalid talent index");
        this.weaponContext.set(data);
      })
      .catch(() =>
        this.weaponContextError.set("Indicazioni PvE/PvP non disponibili."),
      );
  }
  async initialize() {
    this.loading.set(true);
    this.error.set("");
    try {
      const [entries, manifest, sources, chapters, glossary, classes] =
        await Promise.all(
          [
            "catalogue/index",
            "manifest",
            "sources",
            "guide",
            "glossary",
            "classes",
          ].map((p) => this.read(p)),
        );
      this.entries.set(entries);
      this.manifest.set(manifest);
      this.sources.set(sources);
      this.chapters.set(chapters);
      this.glossary.set(glossary);
      this.classes.set(classes);
    } catch {
      this.error.set(
        "Non riesco a caricare il catalogo. Controlla la connessione e riprova.",
      );
    } finally {
      this.loading.set(false);
    }
  }
  async read(path: string) {
    const r = await fetch("data/" + path + ".json");
    if (!r.ok) throw new Error("Dati non disponibili");
    return r.json();
  }
  getDetail(id: string) {
    if (!this.details.has(id)) {
      const promise = (async () => {
        const entry = this.entries().find((e) => e.id === id);
        if (!entry) throw new Error("Oggetto non presente in questo snapshot");
        const r = await fetch(entry.detailPath);
        if (!r.ok)
          throw new Error(
            "Scheda non disponibile: apri la fonte ufficiale o riprova",
          );
        const item = (await r.json()) as Item;
        return { ...item, ...normalizeSections(item) };
      })();
      this.details.set(id, promise);
      promise.catch(() => this.details.delete(id));
    }
    return this.details.get(id)!;
  }
  update(change: (state: UserState) => UserState) {
    return this.engine
      .update(change)
      .then(() => {
        this.notice.set(this.syncLabel());
        return true;
      })
      .catch((e) => {
        this.notice.set(
          e instanceof Error ? e.message : "Modifica non riuscita",
        );
        return false;
      });
  }
  retrySync() {
    return this.engine
      .retry()
      .catch(() => this.notice.set("Sincronizzazione non riuscita. Riprova."));
  }
  resolveConflict(choice: "local" | "remote") {
    return this.engine.resolve(choice).catch((e) => this.notice.set(e.message));
  }
  async importGuest() {
    const owner = this.sync().owner;
    if (!owner) return false;
    try {
      const guest = await createInventoryStore(indexedDB).load();
      if (this.sync().owner !== owner) throw new Error("Account cambiato");
      return await this.update((s) =>
        mergeBackup(
          s,
          guest,
          !s.copies.length &&
            !s.builds.length &&
            !s.goals.length &&
            !s.profile.classId
            ? "replace"
            : "merge",
        ),
      );
    } catch {
      this.notice.set("Inventario ospite non disponibile");
      return false;
    }
  }
  async guestSummary() {
    const guest = await createInventoryStore(indexedDB).load();
    return {
      copies: guest.copies.length,
      builds: guest.builds.length,
      goals: guest.goals.length,
    };
  }
  setProfile(p: Partial<Profile>) {
    return this.update((s) => ({ ...s, profile: { ...s.profile, ...p } }));
  }
  addCopy(id: string) {
    return this.update((s) => ({
      ...s,
      copies: [...s.copies, newCopy(id)],
    })).then((success) => {
      if (success && !this.storageDenied())
        this.notice.set("Copia aggiunta · " + this.syncLabel());
    });
  }
  toggleCompare(id: string) {
    const ids = this.compared();
    if (ids.includes(id)) this.compared.set(ids.filter((x) => x !== id));
    else if (ids.length < 3) this.compared.set([...ids, id]);
    else this.notice.set("Puoi confrontare fino a tre oggetti");
  }
}
