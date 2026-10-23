import { Injectable, signal, computed } from "@angular/core";
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
import { normalizeSections } from "../domain/evaluation";
@Injectable({ providedIn: "root" })
export class Store {
  entries = signal<Entry[]>([]);
  manifest = signal<any>(null);
  sources = signal<any[]>([]);
  chapters = signal<any[]>([]);
  glossary = signal<any[]>([]);
  classes = signal<any[]>([]);
  state = signal<UserState>(emptyState());
  ready = signal(false);
  loading = signal(true);
  error = signal("");
  notice = signal("");
  storageDenied = signal(false);
  compared = signal<string[]>([]);
  private details = new Map<string, Promise<Item>>();
  private queue = Promise.resolve();
  private storage: ReturnType<typeof createInventoryStore> | null = null;
  profile = computed(() => this.state().profile);
  constructor() {
    void this.initialize();
  }
  async initialize() {
    this.loading.set(true);
    this.error.set("");
    try {
      if (!this.ready()) {
        try {
          this.storage = createInventoryStore(indexedDB);
          this.state.set(await this.storage.load());
        } catch {
          this.storageDenied.set(true);
          this.notice.set(
            "Salvataggio locale non disponibile: la sessione resta in memoria. Esporta un backup.",
          );
        }
        this.ready.set(true);
      }
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
    this.queue = this.queue
      .then(async () => {
        const next = change(structuredClone(this.state()));
        const valid = validateBackup(next);
        if (!valid.ok)
          throw new Error(valid.errors.map((e) => e.message).join("; "));
        if (this.storage && !this.storageDenied()) {
          try {
            await this.storage.save(valid.data!);
          } catch {
            this.storageDenied.set(true);
            this.notice.set(
              "Salvataggio fallito: modifica conservata in sessione. Esporta il backup.",
            );
          }
        }
        this.state.set(valid.data!);
        if (!this.storageDenied()) this.notice.set("Salvato nel browser");
      })
      .catch((e) => this.notice.set(String(e.message || e)));
    return this.queue;
  }
  setProfile(p: Partial<Profile>) {
    return this.update((s) => ({ ...s, profile: { ...s.profile, ...p } }));
  }
  addCopy(id: string) {
    return this.update((s) => ({
      ...s,
      copies: [...s.copies, newCopy(id)],
    })).then(() => {
      if (!this.storageDenied())
        this.notice.set("Copia aggiunta e salvata nel browser");
    });
  }
  toggleCompare(id: string) {
    const ids = this.compared();
    if (ids.includes(id)) this.compared.set(ids.filter((x) => x !== id));
    else if (ids.length < 3) this.compared.set([...ids, id]);
    else this.notice.set("Puoi confrontare fino a tre oggetti");
  }
}
