import {
  Component,
  inject,
  signal,
  computed,
  viewChild,
  ElementRef,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Copy, UserState, normalizeMode, modeLabel } from "../domain/contracts";
import { validateBackup, mergeBackup, assignCopy } from "../domain/inventory";
@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<div class="page-heading with-action">
      <div>
        <span class="eyebrow">IL TUO PUNTO DI PARTENZA</span>
        <h1>Il tuo inventario.</h1>
        <p>Copie reali, potenziali reali. {{ s.syncLabel() }}.</p>
      </div>
      <a class="button primary" routerLink="/catalogue"
        >+ Aggiungi dal catalogo</a
      >
    </div>
    <div class="inventory-summary">
      <div class="panel">
        <span class="eyebrow">COPIE POSSEDUTE</span
        ><strong>{{ s.state().copies.length }}</strong>
      </div>
      <div class="panel">
        <span class="eyebrow">CONFIGURAZIONI</span
        ><strong>{{ s.state().builds.length }}</strong>
      </div>
      <div class="panel backup-actions">
        <h3>Porta con te il tuo set</h3>
        <p>Conserva una copia del tuo set. Con un account puoi ritrovarlo su altri dispositivi.</p>
        <div class="actions">
          <button (click)="exportBackup()" [disabled]="!s.ready()">
            Esporta backup</button
          ><label class="button"
            >Importa backup<input
              class="sr-only"
              type="file"
              accept=".json,application/json"
              (change)="readBackup($event)"
          /></label>
        </div>
      </div>
    </div>
    <section class="panel">
      <h2>Elementi principali</h2>
      <p class="muted">
        Un obiettivo di crescita; lo scaling reale usa i pezzi assegnati alla
        configurazione.
      </p>
      <div class="element-chips">
        @for (el of elements; track el) {
          <button
            (click)="toggleElement(el)"
            [attr.aria-pressed]="s.profile().elements.includes(el)"
            [class.selected]="s.profile().elements.includes(el)"
          >
            {{ el }}
          </button>
        }
      </div>
    </section>
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">{{ modeLabel(s.profile().mode) }}</span>
          <h2>La tua configurazione</h2>
        </div>
        <button (click)="newBuild()">+ Nuova configurazione</button>
      </div>
      @if (modeBuilds().length) {
        <label
          >Configurazione<select
            [value]="activeBuild().id"
            (change)="buildId.set(value($event))"
          >
            @for (b of modeBuilds(); track b.id) {
              <option [value]="b.id">{{ b.name }}</option>
            }
          </select></label
        >
        @if (activeBuild(); as build) {
          <div class="build-slots">
            @for (a of build.slots; track a.copyId) {
              <div>
                <span class="effect-tag">{{ a.slot }}</span
                ><a [routerLink]="['/item', copy(a.copyId)?.itemId]">{{
                  name(copy(a.copyId)?.itemId || "")
                }}</a
                ><button
                  class="icon-button"
                  (click)="unassign(a.copyId)"
                  aria-label="Rimuovi dallo slot"
                >
                  ×
                </button>
              </div>
            }
          </div>
          <div class="assign-row">
            <label
              >Copia<select #assignItem>
                <option value="">Scegli una copia</option>
                @for (c of availableCopies(); track c.copyId) {
                  <option [value]="c.copyId">
                    {{ name(c.itemId) }} · {{ c.copyId.slice(0, 6) }}
                  </option>
                }
              </select></label
            ><label
              >Slot<select #assignSlot>
                <option value="sub">Sub slot</option>
                <option value="main">Main slot</option>
              </select></label
            ><button (click)="assign(assignItem.value, assignSlot.value)">
              Assegna
            </button>
          </div>
        }
      } @else {
        <p class="muted">
          Crea una configurazione per verificare scaling e main/sub slot nella
          modalità selezionata.
        </p>
      }
    </section>
    @if (!s.state().copies.length) {
      <div class="empty-state">
        <span>▣</span>
        <h2>Un set tutto da costruire</h2>
        <p>Cerca gli oggetti che possiedi e aggiungi una copia dalla scheda.</p>
        <a class="button primary" routerLink="/catalogue"
          >Esplora il catalogo →</a
        >
      </div>
    } @else {
      <h2 class="section-title">
        Le tue copie <span class="muted">({{ s.state().copies.length }})</span>
      </h2>
      <div class="owned-list">
        @for (c of s.state().copies; track c.copyId) {
          <article class="owned-card">
            <div class="owned-title">
              <img
                [src]="entry(c.itemId)?.iconPath || 'assets/fallback.svg'"
                [alt]="name(c.itemId)"
                width="80"
                height="80"
              />
              <div>
                <span class="eyebrow"
                  >{{ entry(c.itemId)?.gearType || "ID da riconciliare" }} ·
                  COPIA {{ c.copyId.slice(0, 6) }}</span
                ><a [routerLink]="['/item', c.itemId]"
                  ><h3>{{ name(c.itemId) }}</h3></a
                >
              </div>
              <button
                class="icon-button danger"
                (click)="remove(c.copyId)"
                [attr.aria-label]="'Elimina copia ' + name(c.itemId)"
              >
                ×
              </button>
            </div>
            <div class="copy-fields">
              <label
                >Skill level<input
                  type="number"
                  min="1"
                  [value]="c.skillLevel"
                  (change)="edit(c, 'skillLevel', $event)" /></label
              ><label
                >Infusioni<input
                  type="number"
                  min="0"
                  [value]="c.infusions"
                  (change)="edit(c, 'infusions', $event)" /></label
              ><label
                >Hidden Potential<input
                  type="number"
                  min="0"
                  [value]="c.potential"
                  (change)="edit(c, 'potential', $event)" /></label
              ><label
                >Stats1<select
                  [value]="c.stat1"
                  (change)="edit(c, 'stat1', $event)"
                >
                  @for (stat of stats; track stat) {
                    <option>{{ stat }}</option>
                  }
                </select></label
              ><label
                >Stats2<select
                  [value]="c.stat2"
                  (change)="edit(c, 'stat2', $event)"
                >
                  @for (stat of stats; track stat) {
                    <option>{{ stat }}</option>
                  }
                </select></label
              ><label class="notes-field"
                >Note<input
                  [value]="c.notes"
                  (change)="edit(c, 'notes', $event)"
                  placeholder="Es. main slot PvE"
              /></label>
            </div>
          </article>
        }
      </div>
    }
    <dialog #backupDialog class="backup-dialog" (cancel)="pending.set(null)">
      @if (pending(); as backup) {
        <h2>Importa il tuo inventario</h2>
        <p>
          {{ backup.copies.length }} copie ·
          {{ backup.builds.length }} configurazioni. Gli ID sconosciuti vengono
          conservati.
        </p>
        <p>
          Unione: aggiunge le copie senza sovrascrivere le tue. Sostituzione:
          usa tutto il backup, compreso il profilo.
        </p>
        <label class="checkbox-row"
          ><input type="checkbox" #confirmReplace />Confermo la sostituzione dei
          dati attuali</label
        >
        <div class="actions">
          <button class="primary" (click)="importBackup('merge')">Unisci</button
          ><button
            [disabled]="!confirmReplace.checked"
            (click)="importBackup('replace')"
          >
            Sostituisci</button
          ><button (click)="closeDialog()">Annulla</button>
        </div>
      }
    </dialog>`,
})
export class InventoryComponent {
  s = inject(Store);
  modeLabel = modeLabel;
  elements = ["Fire", "Water", "Wind", "Light", "Dark", "Time", "Star"];
  stats = ["ATK", "MATK", "DEF", "MDEF"];
  buildId = signal("");
  pending = signal<UserState | null>(null);
  dialog = viewChild<ElementRef<HTMLDialogElement>>("backupDialog");
  modeBuilds = computed(() =>
    this.s.state().builds.filter(
      (b) => normalizeMode(b.mode) === normalizeMode(this.s.profile().mode),
    ),
  );
  activeBuild = computed(
    () =>
      this.modeBuilds().find((b) => b.id === this.buildId()) ||
      this.modeBuilds()[0],
  );
  availableCopies = computed(() =>
    this.s
      .state()
      .copies.filter(
        (c) => !this.activeBuild()?.slots.some((a) => a.copyId === c.copyId),
      ),
  );
  value(e: Event) {
    return (e.target as HTMLInputElement).value;
  }
  entry(id: string) {
    return this.s.entries().find((e) => e.id === id);
  }
  name(id: string) {
    return this.entry(id)?.name || "Oggetto da riconciliare · " + id;
  }
  copy(id: string) {
    return this.s.state().copies.find((c) => c.copyId === id);
  }
  toggleElement(el: string) {
    const current = this.s.profile().elements;
    this.s.setProfile({
      elements: current.includes(el)
        ? current.filter((x) => x !== el)
        : [...current, el],
    });
  }
  edit(c: Copy, key: keyof Copy, event: Event) {
    const raw = this.value(event),
      v = ["skillLevel", "infusions", "potential"].includes(key)
        ? Number(raw)
        : raw;
    this.s.update((s) => ({
      ...s,
      copies: s.copies.map((x) =>
        x.copyId === c.copyId ? { ...x, [key]: v } : x,
      ),
    }));
  }
  remove(id: string) {
    this.s.update((s) => ({
      ...s,
      copies: s.copies.filter((c) => c.copyId !== id),
      builds: s.builds.map((b) => ({
        ...b,
        slots: b.slots.filter((a) => a.copyId !== id),
      })),
    }));
  }
  newBuild() {
    const id = crypto.randomUUID();
    this.buildId.set(id);
    this.s.update((s) => ({
      ...s,
      builds: [
        ...s.builds,
        {
          id,
          name:
            "Set " + modeLabel(s.profile.mode) + " " + (s.builds.length + 1),
          mode: normalizeMode(s.profile.mode),
          slots: [],
        },
      ],
    }));
  }
  assign(copyId: string, slot: string) {
    const b = this.activeBuild();
    if (!b || !copyId) return;
    this.s.update((s) => {
      const r = assignCopy(s, {
        buildId: b.id,
        copyId,
        slot: slot as "main" | "sub",
      });
      if (!r.ok) throw new Error(r.errors[0].message);
      return r.data!;
    });
  }
  unassign(id: string) {
    const b = this.activeBuild();
    this.s.update((s) => ({
      ...s,
      builds: s.builds.map((x) =>
        x.id === b?.id
          ? { ...x, slots: x.slots.filter((a) => a.copyId !== id) }
          : x,
      ),
    }));
  }
  exportBackup() {
    const blob = new Blob(
        [
          JSON.stringify(
            { ...this.s.state(), exportedAt: new Date().toISOString() },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "unisonpedia-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async readBackup(e: Event) {
    const input = e.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Backup troppo grande (limite 5 MB)");
      const result = validateBackup(JSON.parse(await file.text()));
      if (!result.ok)
        throw new Error(result.errors.map((x) => x.message).join("; "));
      this.pending.set(result.data!);
      setTimeout(() => this.dialog()?.nativeElement.showModal());
    } catch (err) {
      this.s.notice.set((err as Error).message);
    }
    input.value = "";
  }
  async importBackup(mode: "merge" | "replace") {
    const incoming = this.pending();
    if (!incoming) return;
    await this.s.update((s) => mergeBackup(s, incoming, mode));
    this.closeDialog();
  }
  closeDialog() {
    this.dialog()?.nativeElement.close();
    this.pending.set(null);
  }
}
