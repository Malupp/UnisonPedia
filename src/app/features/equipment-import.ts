import {
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { Copy } from "../domain/contracts";
import { defaultFilters, filterCatalogue } from "../domain/catalogue";
import {
  EquipmentSelection,
  MAX_IMPORT_COPIES,
  prepareEquipmentBatch,
} from "../domain/equipment-import";
import { ScreenshotImportComponent } from "./screenshot-import";

@Component({
  standalone: true,
  imports: [RouterLink, ScreenshotImportComponent],
  styleUrl: "./equipment-import.css",
  template: `<header class="page-heading">
      <span class="eyebrow">IL TUO SET, PIÙ VELOCEMENTE</span>
      <h1>Carica equipaggiamento</h1>
      <p>
        Cerca e seleziona più oggetti, oppure parti dalle icone di uno
        screenshot. Rivedi quantità e livelli, poi aggiungi tutto insieme
        all’inventario.
      </p>
      <a class="text-link" routerLink="/inventory">← Torna all’inventario</a>
    </header>
    <div class="import-tabs" role="group" aria-label="Metodo di caricamento">
      <button
        [class.primary]="mode() === 'search'"
        [attr.aria-pressed]="mode() === 'search'"
        (click)="mode.set('search')"
      >
        Cerca e aggiungi</button
      ><button
        [class.primary]="mode() === 'screenshot'"
        [attr.aria-pressed]="mode() === 'screenshot'"
        (click)="mode.set('screenshot')"
      >
        Da screenshot
      </button>
    </div>
    @if (error()) {
      <p class="message error" role="alert">{{ error() }}</p>
    }
    @if (success()) {
      <div class="message" role="status">
        {{ success() }}
        <a class="text-link" routerLink="/inventory">Apri inventario →</a>
      </div>
    }
    <div class="quick-import-layout">
      <section class="panel import-source" aria-label="Scegli equipaggiamenti">
        @if (mode() === "search") {
          <h2>Seleziona dal catalogo</h2>
          <div class="quick-import-filters">
            <label
              >Cerca equipaggiamento<input
                type="search"
                [value]="query()"
                (input)="query.set(value($event)); limit.set(30)"
                placeholder="Nome, tipo o ID…" /></label
            ><label
              >Tipo<select
                [value]="kind()"
                (change)="kind.set(value($event)); limit.set(30)"
              >
                <option value="">Tutti</option>
                <option value="weapon">Armi</option>
                <option value="defence">Difensivi</option>
                <option value="monster">Mostri</option>
              </select></label
            ><label
              >Elemento<select
                [value]="element()"
                (change)="element.set(value($event)); limit.set(30)"
              >
                <option value="">Tutti</option>
                @for (el of elements; track el) {
                  <option [value]="el">{{ el }}</option>
                }
              </select></label
            >
          </div>
          <p class="import-result-count" role="status">
            {{ filtered().length }} oggetti ·
            {{ selection().length }} selezionati
          </p>
          <div class="quick-import-results">
            @for (item of filtered().slice(0, limit()); track item.id) {
              <label class="quick-import-result"
                ><input
                  type="checkbox"
                  [checked]="selectedIds().has(item.id)"
                  [disabled]="saving()"
                  (change)="toggle(item.id, $any($event.target).checked)"
                  [attr.aria-label]="'Seleziona ' + item.name"
                /><img
                  [src]="item.iconPath || 'assets/fallback.svg'"
                  (error)="fallback($event)"
                  alt=""
                  width="52"
                  height="52"
                  loading="lazy"
                /><span
                  ><strong>{{ item.name }}</strong
                  ><small
                    >{{ item.gearType }} · {{ item.element }} · Cost
                    {{ item.cost }}
                    @if (owned().get(item.id)) {
                      · Già possedute: {{ owned().get(item.id) }}
                    }
                  </small></span
                ></label
              >
            } @empty {
              <p>
                Nessun risultato. Prova un nome più breve o cambia i filtri.
              </p>
            }
          </div>
          @if (filtered().length > limit()) {
            <button class="import-more" (click)="limit.update(more)">
              Mostra altri 30
            </button>
          }
        } @else {
          <app-screenshot-import
            [entries]="s.entries()"
            [disabled]="saving()"
            (pick)="add($event)"
          />
        }
      </section>
      <aside
        class="panel import-selection"
        aria-label="Equipaggiamenti da aggiungere"
      >
        <div class="section-heading">
          <h2>La tua selezione</h2>
          @if (selection().length) {
            <button
              class="text-link"
              [disabled]="saving()"
              (click)="selection.set([])"
            >
              Azzera
            </button>
          }
        </div>
        <p>{{ total() }} / {{ maximum }} copie · {{ s.syncLabel() }}</p>
        @for (row of selection(); track row.itemId) {
          <article class="import-pick">
            <div class="import-pick-heading">
              <img
                [src]="
                  entryMap().get(row.itemId)?.iconPath || 'assets/fallback.svg'
                "
                (error)="fallback($event)"
                alt=""
                width="38"
                height="38"
              /><strong>{{ entryMap().get(row.itemId)?.name }}</strong
              ><button
                class="text-link"
                [disabled]="saving()"
                (click)="remove(row.itemId)"
                [attr.aria-label]="
                  'Rimuovi dalla selezione ' + entryMap().get(row.itemId)?.name
                "
              >
                ×
              </button>
            </div>
            <label class="import-quantity"
              >Quantità<input
                type="number"
                min="1"
                [max]="maximum"
                step="1"
                [value]="row.quantity"
                [disabled]="saving()"
                (change)="edit(row.itemId, 'quantity', $event)"
                [attr.aria-label]="
                  'Quantità ' + entryMap().get(row.itemId)?.name
                "
            /></label>
            <details>
              <summary>Livelli e statistiche</summary>
              <div class="import-copy-fields">
                <label
                  >Skill level<input
                    type="number"
                    min="1"
                    max="99"
                    [value]="row.skillLevel"
                    [disabled]="saving()"
                    (change)="edit(row.itemId, 'skillLevel', $event)" /></label
                ><label
                  >Infusioni<input
                    type="number"
                    min="0"
                    max="99"
                    [value]="row.infusions"
                    [disabled]="saving()"
                    (change)="edit(row.itemId, 'infusions', $event)" /></label
                ><label
                  >Potenziale<input
                    type="number"
                    min="0"
                    max="99"
                    [value]="row.potential"
                    [disabled]="saving()"
                    (change)="edit(row.itemId, 'potential', $event)" /></label
                ><label
                  >Stats 1<select
                    [value]="row.stat1"
                    [disabled]="saving()"
                    (change)="edit(row.itemId, 'stat1', $event)"
                  >
                    @for (stat of stats; track stat) {
                      <option [value]="stat" [selected]="stat === row.stat1">
                        {{ stat }}
                      </option>
                    }
                  </select></label
                ><label
                  >Stats 2<select
                    [value]="row.stat2"
                    [disabled]="saving()"
                    (change)="edit(row.itemId, 'stat2', $event)"
                  >
                    @for (stat of stats; track stat) {
                      <option [value]="stat" [selected]="stat === row.stat2">
                        {{ stat }}
                      </option>
                    }
                  </select></label
                >
              </div>
            </details>
          </article>
        } @empty {
          <p class="muted">
            Seleziona gli oggetti che possiedi. Nessuna copia viene salvata
            prima della conferma.
          </p>
        }
        <p class="import-defaults">
          Le nuove copie partono da skill 1, infusioni 0 e potenziale 0. Apri
          “Livelli e statistiche” per impostare i valori reali.
        </p>
        <button
          class="primary import-confirm"
          [disabled]="!s.ready() || saving() || !selection().length"
          (click)="review()"
        >
          Rivedi e aggiungi {{ total() }} copie
        </button>
      </aside>
    </div>
    <dialog
      #reviewDialog
      class="quick-import-dialog"
      aria-labelledby="quick-import-title"
      (cancel)="pending.set(null)"
    >
      <h2 id="quick-import-title">Conferma il caricamento</h2>
      <p>
        Stai per aggiungere {{ pending()?.length || 0 }} copie all’inventario.
        Le copie già presenti e le configurazioni vengono conservate.
      </p>
      <p>
        Gli oggetti già posseduti vengono aggiunti come nuove copie. Controlla
        le quantità prima di confermare.
      </p>
      <div class="actions">
        <button
          class="primary"
          [disabled]="saving() || !s.ready()"
          (click)="confirm()"
        >
          {{ saving() ? "Salvataggio…" : "Conferma aggiunta" }}</button
        ><button [disabled]="saving()" (click)="closeReview()">
          Torna alla selezione
        </button>
      </div>
    </dialog>`,
})
export class EquipmentImportComponent {
  s = inject(Store);
  mode = signal<"search" | "screenshot">("search");
  query = signal("");
  kind = signal("");
  element = signal("");
  limit = signal(30);
  selection = signal<EquipmentSelection[]>([]);
  pending = signal<Copy[] | null>(null);
  error = signal("");
  success = signal("");
  saving = signal(false);
  maximum = MAX_IMPORT_COPIES;
  elements = ["Fire", "Water", "Wind", "Light", "Dark", "Time", "Star"];
  stats = ["ATK", "MATK", "DEF", "MDEF"];
  dialog = viewChild.required<ElementRef<HTMLDialogElement>>("reviewDialog");
  entryMap = computed(
    () => new Map(this.s.entries().map((entry) => [entry.id, entry])),
  );
  selectedIds = computed(
    () => new Set(this.selection().map((row) => row.itemId)),
  );
  filtered = computed(() =>
    filterCatalogue(this.s.entries(), {
      ...defaultFilters,
      query: this.query(),
      kind: this.kind(),
      element: this.element(),
    }),
  );
  total = computed(() =>
    this.selection().reduce(
      (sum, row) => sum + (Number.isFinite(row.quantity) ? row.quantity : 0),
      0,
    ),
  );
  owned = computed(() => {
    const counts = new Map<string, number>();
    for (const copy of this.s.state().copies)
      counts.set(copy.itemId, (counts.get(copy.itemId) || 0) + 1);
    return counts;
  });
  more = (limit: number) => limit + 30;
  value(event: Event) {
    return (event.target as HTMLInputElement).value;
  }
  add(itemId: string) {
    if (this.saving() || !this.entryMap().has(itemId)) return;
    this.error.set("");
    this.success.set("");
    this.selection.update((rows) =>
      rows.some((row) => row.itemId === itemId)
        ? rows.map((row) =>
            row.itemId === itemId
              ? { ...row, quantity: row.quantity + 1 }
              : row,
          )
        : [
            ...rows,
            {
              itemId,
              quantity: 1,
              skillLevel: 1,
              infusions: 0,
              potential: 0,
              stat1: "ATK",
              stat2: "MATK",
            },
          ],
    );
  }
  toggle(itemId: string, checked: boolean) {
    if (checked && !this.selectedIds().has(itemId)) this.add(itemId);
    else if (!checked) this.remove(itemId);
  }
  remove(itemId: string) {
    this.selection.update((rows) =>
      rows.filter((row) => row.itemId !== itemId),
    );
  }
  edit(itemId: string, key: keyof EquipmentSelection, event: Event) {
    const raw = this.value(event);
    const value = key === "stat1" || key === "stat2" ? raw : Number(raw);
    this.selection.update((rows) =>
      rows.map((row) =>
        row.itemId === itemId ? { ...row, [key]: value } : row,
      ),
    );
  }
  private reviewedOwner: string | null | undefined;
  review() {
    if (!this.s.ready() || this.saving()) return;
    this.error.set("");
    try {
      this.reviewedOwner = this.s.sync().owner;
      this.pending.set(
        prepareEquipmentBatch(this.selection(), this.s.entries()),
      );
      this.dialog().nativeElement.showModal();
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : "Controlla la selezione.",
      );
    }
  }
  closeReview() {
    this.dialog().nativeElement.close();
    this.pending.set(null);
  }
  async confirm() {
    const copies = this.pending();
    if (!copies?.length || this.saving()) return;
    const owner = this.reviewedOwner;
    if (!this.s.ready() || owner !== this.s.sync().owner) {
      this.error.set(
        "L’account è cambiato o è in caricamento. Rivedi la selezione prima di confermare.",
      );
      this.closeReview();
      return;
    }
    this.saving.set(true);
    try {
      const success = await this.s.update((state) => {
        if (owner !== this.s.sync().owner)
          throw Error("Account cambiato: rivedi la selezione.");
        return { ...state, copies: [...state.copies, ...copies] };
      });
      if (owner !== this.s.sync().owner) {
        this.error.set(
          "L’account è cambiato durante il salvataggio. Controlla l’inventario del profilo precedente prima di ripetere l’aggiunta.",
        );
        this.closeReview();
        return;
      }
      if (success) {
        this.selection.set([]);
        this.success.set(
          copies.length + " copie aggiunte · " + this.s.syncLabel(),
        );
        this.closeReview();
      } else {
        this.error.set(
          this.s.notice() ||
            "Salvataggio non riuscito. La selezione è conservata.",
        );
        this.closeReview();
      }
    } finally {
      this.saving.set(false);
    }
  }
  fallback(event: Event) {
    const image = event.target as HTMLImageElement;
    if (!image.dataset["fallback"]) {
      image.dataset["fallback"] = "1";
      image.src = "assets/fallback.svg";
    }
  }
}
