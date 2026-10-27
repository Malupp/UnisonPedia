import {
  Component,
  inject,
  signal,
  computed,
  DestroyRef,
  effect,
} from "@angular/core";
import { ReactiveFormsModule, FormGroup, FormControl } from "@angular/forms";
import { Router, ActivatedRoute, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Store } from "../core/store";
import { ItemCardComponent } from "../shared/card";
import { VideoSummaryComponent } from "../shared/video-summary";
import {
  filterCatalogue,
  decodeFilters,
  defaultFilters,
  Filters,
  COST_OPTIONS,
} from "../domain/catalogue";
import { sortWeaponTalents } from "../domain/weapon-context";
import { WeaponContextFilterComponent } from "../shared/weapon-context-filter";
@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ItemCardComponent,
    VideoSummaryComponent,
    WeaponContextFilterComponent,
  ],
  template: `<section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">
          <span class="status-dot"></span> LA CONOSCENZA FA LA DIFFERENZA
        </div>
        <h1>Il tuo prossimo<br /><em>upgrade</em> inizia qui.</h1>
        <p>
          Trova l’equip giusto, capisci gli effetti<br class="desktop-only" />
          e scegli dove investire le tue gemme.
        </p>
        <a class="button primary" routerLink="/spawns"
          >Valuta una spawn <span aria-hidden="true">↗</span></a
        ><a class="text-link" routerLink="/guide">Inizia dalla guida →</a>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="orbit orbit-one"></div>
        <div class="orbit orbit-two"></div>
        <span class="art-caption">BUILD WITH PURPOSE</span>
        @for (e of heroItems(); track e.id; let i = $index) {
          <img
            [src]="e.iconPath"
            [class]="'floating-art art-' + i"
            width="170"
            height="170"
            alt=""
          />
        }
        <span class="art-spark">✦</span>
      </div>
    </section>
    <div class="stats-strip">
      <div>
        <strong>{{
          s.manifest()?.counts?.weapon?.toLocaleString("it-IT") || "—"
        }}</strong
        ><span>Armi</span>
      </div>
      <div>
        <strong>{{
          s.manifest()?.counts?.defence?.toLocaleString("it-IT") || "—"
        }}</strong
        ><span>Difensivi</span>
      </div>
      <div>
        <strong>{{
          s.manifest()?.counts?.monster?.toLocaleString("it-IT") || "—"
        }}</strong
        ><span>Mostri</span>
      </div>
      <div class="stats-note">
        <span class="status-dot"></span
        ><span
          >Equipaggiamenti e mostri · WW<br /><small
            >Snapshot: nessun aggiornamento in tempo reale</small
          ></span
        >
      </div>
    </div>
    <app-video-summary />
    <section class="catalogue-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">TUTTO IL TUO ARSENALE</span>
          <h2>Esplora il catalogo</h2>
        </div>
        <button class="text-link" (click)="recent()">
          Costi 45–46 <span aria-hidden="true">↗</span>
        </button>
      </div>
      <app-weapon-context-filter />
      <form [formGroup]="form" class="filter-bar">
        <label class="search-field"
          ><span class="sr-only">Cerca nel catalogo</span
          ><span aria-hidden="true">⌕</span
          ><input
            formControlName="query"
            placeholder="Cerca nome, skill type o ID…" /></label
        ><label
          ><span class="sr-only">Categoria</span
          ><select formControlName="kind">
            <option value="">Tutte le categorie</option>
            <option value="weapon">Armi</option>
            <option value="defence">Difensivi</option>
            <option value="monster">Mostri</option>
          </select></label
        ><label
          ><span class="sr-only">Elemento</span
          ><select formControlName="element">
            <option value="">Tutti gli elementi</option>
            @for (el of elements; track el) {
              <option [value]="el">{{ el }}</option>
            }
          </select></label
        >
        <details class="cost-dropdown">
          <summary>
            <span>Cost</span><span>{{ costLabel() }}</span>
          </summary>
          <div class="cost-options-panel">
            <div class="section-heading">
              <strong>Scegli i costi</strong
              ><button type="button" class="text-link" (click)="clearCosts()">
                Tutti i costi
              </button>
            </div>
            <div
              class="cost-options"
              role="group"
              aria-label="Costi degli oggetti"
            >
              @for (cost of costOptions; track cost) {
                <label
                  ><input
                    type="checkbox"
                    [checked]="form.controls.costs.value.includes(cost)"
                    (change)="toggleCost(cost, $event)"
                  />
                  COST {{ cost }}</label
                >
              }
            </div>
          </div>
        </details>
      </form>
      <div class="results-bar">
        <span
          >{{ filtered().length.toLocaleString("it-IT") }} oggetti
          <span class="muted"
            >· UR · {{ s.profile().mode.toUpperCase() }}</span
          ></span
        ><button class="text-link" (click)="reset()">Azzera filtri</button>
      </div>
      @if (s.loading()) {
        <div class="empty-state" role="status">Caricamento del catalogo…</div>
      } @else if (!filtered().length) {
        <div class="empty-state">
          <span>⌕</span>
          <h3>Nessun oggetto trovato</h3>
          <p>Prova un nome più breve o rimuovi un filtro.</p>
        </div>
      } @else {
        <div class="item-grid">
          @for (e of shown(); track e.id) {
            <app-item-card [item]="e" />
          }
        </div>
        <div class="pagination">
          <button (click)="page.set(page() - 1)" [disabled]="page() === 0">
            ← Precedente</button
          ><span>Pagina {{ page() + 1 }} di {{ pages() }}</span
          ><button
            (click)="page.set(page() + 1)"
            [disabled]="page() + 1 >= pages()"
          >
            Successiva →
          </button>
        </div>
      }
    </section>
    @if (s.compared().length) {
      <div class="compare-tray">
        <span>{{ s.compared().length }} / 3 oggetti selezionati</span
        ><a
          class="button primary"
          routerLink="/compare"
          [queryParams]="{ ids: s.compared().join(',') }"
          >Confronta →</a
        ><button class="text-link" (click)="s.compared.set([])">Svuota</button>
      </div>
    }`,
})
export class CatalogueComponent {
  s = inject(Store);
  router = inject(Router);
  route = inject(ActivatedRoute);
  destroy = inject(DestroyRef);
  costOptions = COST_OPTIONS;
  elements = ["Fire", "Water", "Wind", "Light", "Dark", "Time", "Star", "None"];
  filters = signal<Filters>(defaultFilters);
  page = signal(0);
  form = new FormGroup({
    query: new FormControl("", { nonNullable: true }),
    kind: new FormControl("", { nonNullable: true }),
    element: new FormControl("", { nonNullable: true }),
    minCost: new FormControl(0, { nonNullable: true }),
    maxCost: new FormControl(999, { nonNullable: true }),
    costs: new FormControl<number[]>([], { nonNullable: true }),
  });
  filtered = computed(() =>
    sortWeaponTalents(
      filterCatalogue(this.s.entries(), this.filters(), this.s.weaponClass()),
      this.s.weaponTalents(),
      this.s.profile().mode,
    ),
  );
  shown = computed(() =>
    this.filtered().slice(this.page() * 48, this.page() * 48 + 48),
  );
  pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / 48)));
  heroItems = computed(() => {
    const ids = ["1190923", "1669807", "4415381"];
    return ids
      .map((id) => this.s.entries().find((e) => e.id === id))
      .filter((e) => !!e);
  });
  constructor() {
    effect(() => {
      this.s.weaponClass();
      this.s.profile().mode;
      this.page.set(0);
    });
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((p) => {
        const f = decodeFilters(
          p.keys
            .map(
              (k) =>
                encodeURIComponent(k) +
                "=" +
                encodeURIComponent(p.get(k) || ""),
            )
            .join("&"),
        );
        this.filters.set(f);
        this.form.setValue(f, { emitEvent: false });
        this.page.set(0);
      });
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        const f = this.form.getRawValue();
        this.filters.set(f);
        this.page.set(0);
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {
            costs: f.costs.length ? f.costs.join(",") : null,
            q: f.query || null,
            kind: f.kind || null,
            element: f.element || null,
            min: f.minCost || null,
            max: f.maxCost === 999 ? null : f.maxCost,
          },
          replaceUrl: true,
        });
      });
  }
  costLabel = computed(() => {
    const f = this.filters();
    if (f.costs.length)
      return f.costs.length > 3
        ? f.costs.length + " selezionati"
        : f.costs.join(", ");
    return f.minCost || f.maxCost !== 999
      ? f.minCost + "–" + f.maxCost
      : "Tutti";
  });
  toggleCost(cost: number, event: Event) {
    const selected = new Set(this.form.controls.costs.value);
    if ((event.target as HTMLInputElement).checked) selected.add(cost);
    else selected.delete(cost);
    this.form.patchValue({
      costs: [...selected].sort((a, b) => a - b),
      minCost: 0,
      maxCost: 999,
    });
  }
  clearCosts() {
    this.form.patchValue({ costs: [], minCost: 0, maxCost: 999 });
  }
  recent() {
    this.form.patchValue({ minCost: 0, maxCost: 999, costs: [45, 46] });
  }
  reset() {
    this.form.setValue(defaultFilters);
  }
}
