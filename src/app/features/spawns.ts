import {
  Component,
  inject,
  signal,
  computed,
  effect,
  DestroyRef,
  untracked,
} from "@angular/core";
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from "@angular/forms";
import { RouterLink } from "@angular/router";
import { debounceTime, tap } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Store } from "../core/store";
import { normalizeMode } from "../domain/contracts";
import { SpawnWorkerController } from "../core/spawn-worker";
import {
  Banner,
  validateBanner,
  verdictLabels,
  bannerAvailability,
} from "../domain/spawn";
import { assessTargetNeed } from "../domain/evaluation";
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `<div class="page-heading">
      <span class="eyebrow">LE GEMME HANNO UN OBIETTIVO</span>
      <h1>Questa spawn fa per te?</h1>
      <p>
        Beneficio, costo e punto di arresto. Una scelta motivata, prima di
        spendere.
      </p>
    </div>
    <section class="panel coverage-panel">
      <span class="status-dot"></span>
      <div>
        <h3>Registro WW: condizioni attuali da verificare</h3>
        <p>
          Non è ancora disponibile un banner attivo con condizioni complete. Puoi
          analizzare le condizioni di una nuova spawn con il configuratore o
          importare un record JSON verificato.
        </p>
      </div>
      <a routerLink="/guide/gemme" class="text-link">Leggi i criteri ↗</a>
    </section>
    <section class="panel">
      <div class="section-heading">
        <h2>Banner registrati</h2>
        <label
          >Disponibilità<select
            [value]="bannerFilter()"
            (change)="setBannerFilter($event)"
          >
            <option value="all">Tutti</option>
            <option value="active">Attivi WW</option>
            <option value="expired">Storici</option>
            <option value="unknown">Da verificare</option>
          </select></label
        >
      </div>
      @if (!registered().length) {
        <p class="muted">
          Nessun banner con questa disponibilità nello snapshot.
        </p>
      }
      <div class="guide-cards">
        @for (b of registered(); track b.id + "-" + b.revision) {
          <article class="guide-card">
            <span class="eyebrow"
              >{{ availability(b) }} · {{ b.edition }} · REV.
              {{ b.revision }}</span
            >
            <h3>{{ b.name }}</h3>
            <p>Condizioni verificate: {{ b.verifiedAt.slice(0, 10) }}</p>
            <button (click)="selectRegistered(b)">Seleziona banner</button>
          </article>
        }
      </div>
    </section>
    <div class="spawn-layout">
      <section class="panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">SCENARIO PERSONALIZZATO</span>
            <h2>Imposta la tua spawn</h2>
          </div>
          <span class="effect-tag">NON È UN BANNER LIVE</span>
        </div>
        <form [formGroup]="form" (ngSubmit)="analyze()">
          <div class="form-grid">
            <label class="full-width"
              >Nome del bersaglio<input
                formControlName="targetName"
                placeholder="Nome ufficiale dell’oggetto" /></label
            ><label
              >Gemme disponibili<input
                type="number"
                min="0"
                formControlName="availableGems" /></label
            ><label
              >Riserva da conservare<input
                type="number"
                min="0"
                formControlName="reserveGems" /></label
            ><label
              >Costo di ogni spawn<input
                type="number"
                min="1"
                formControlName="costGems" /></label
            ><label
              >Prima spawn scontata<input
                type="number"
                min="0"
                formControlName="firstCost" /></label
            ><label
              >Draw per spawn<input
                type="number"
                min="1"
                max="100"
                formControlName="drawCount" /></label
            ><label
              >Tasso bersaglio per draw (%)<input
                type="number"
                min="0"
                max="100"
                step=".01"
                formControlName="rate"
                placeholder="Lascia vuoto se non noto"
              /><small>Solo tasso costante e draw indipendenti.</small></label
            ><label
              >Garanzia diretta dopo spawn<input
                type="number"
                min="0"
                formControlName="guaranteeAfter"
              /><small>0 = nessuna garanzia del bersaglio.</small></label
            ><label
              >Medaglie garantite per spawn<input
                type="number"
                min="0"
                formControlName="medalsPerSpawn" /></label
            ><label
              >Medaglie per lo scambio<input
                type="number"
                min="0"
                formControlName="exchangeMedals" /></label
            ><label
              >Medaglie già possedute<input
                type="number"
                min="0"
                formControlName="ownedMedals"
            /></label>
          </div>
          <label class="checkbox-row"
            ><input type="checkbox" formControlName="useful" />Il bersaglio
            risolve una mia necessità</label
          >
          <p class="muted small">
            Nel configuratore l’utilità è una tua ipotesi esplicita. Il voto del
            catalogo usa invece effetti e condizioni verificabili.
          </p>
          <div class="risk-box">
            <label class="checkbox-row"
              ><input type="checkbox" formControlName="risk" />Valuta un
              tentativo a rischio</label
            >
            @if (form.controls.risk.value) {
              <div class="form-grid">
                <label
                  >Tetto del tentativo<input
                    type="number"
                    min="0"
                    formControlName="riskCap" /></label
                ><label
                  >Soglia di successo (%)<input
                    type="number"
                    min="1"
                    max="99"
                    formControlName="threshold"
                /></label>
              </div>
              <p class="muted small">
                La soglia è una preferenza, non una certezza. Il limite resta
                entro il budget meno la riserva.
              </p>
            }
          </div>
          @if (error()) {
            <p class="message error" role="alert">{{ error() }}</p>
          }
          <div class="actions">
            <button class="primary" type="submit" [disabled]="form.invalid">
              Analizza scenario <span aria-hidden="true">↗</span>
            </button>
            @if (busy()) {
              <button type="button" (click)="cancel()">Annulla analisi</button
              ><span role="status">10.000 prove, seed 42…</span>
            }
          </div>
        </form>
      </section>
      <aside>
        <section class="panel spawn-result">
          @if (result(); as r) {
            <span class="eyebrow">IL TUO PUNTO DI ARRESTO</span>
            <h2
              data-testid="spawn-verdict"
              [attr.data-verdict]="r.advice.verdict"
            >
              {{ labels[r.advice.verdict] }}
            </h2>
            <div class="spend-limit" data-testid="spawn-limit">
              {{
                r.advice.limitAdditionalGems === null
                  ? "—"
                  : r.advice.limitAdditionalGems
              }}<span>gemme aggiuntive</span>
            </div>
            <p class="result-summary" data-testid="spawn-explanation">
              {{ r.explanation.summary }}
            </p>
            <div class="budget-meter">
              <span>Riserva {{ form.controls.reserveGems.value }}</span
              ><span>Spendibile {{ r.advice.spendableGems }}</span>
            </div>
            <div class="cost-metrics">
              <div>
                <span>Garanzia</span
                ><strong>{{ format(r.advice.costs.guaranteed) }}</strong>
              </div>
              <div>
                <span>Media globale</span
                ><strong>{{ format(r.advice.costs.mean) }}</strong>
              </div>
              <div>
                <span>Mediana</span
                ><strong>{{ format(r.advice.costs.median) }}</strong>
              </div>
              <div>
                <span>Percentile 80</span
                ><strong>{{ format(r.advice.costs.p80) }}</strong>
              </div>
            </div>
            @if (r.simulation) {
              <p class="muted small">
                Successo entro il budget:
                {{ (r.simulation.successWithinBudget * 100).toFixed(1) }}% ·
                {{ r.simulation.trials }} prove
              </p>
              @if (r.simulation.censored) {
                <p class="message warning">
                  Alcune prove non completano entro l’orizzonte. Media dei soli
                  completamenti:
                  {{ format(r.simulation.meanCompletedAdditionalGems) }}; non è
                  una media globale.
                </p>
              }
            }
            @if (r.simulationError) {
              <p class="muted small">
                Stima casuale non disponibile: {{ r.simulationError }}. Una
                garanzia documentata resta calcolabile.
              </p>
            }
            @for (section of r.explanation.sections; track section.id) {
              <details>
                <summary>{{ section.title }}</summary>
                <p>{{ section.text }}</p>
              </details>
            }
            <p class="muted small">
              Scenario impostato dall’utente. Fermati al bersaglio o al limite;
              il voto non invita ad acquistare gemme.
            </p>
          } @else {
            <span class="result-icon" aria-hidden="true">◇</span>
            <h2>Prima il piano.<br />Poi la spawn.</h2>
            <p>
              Compila le condizioni per vedere quanto puoi spendere e perché
              fermarti.
            </p>
            <div class="mini-steps">
              <div><span>01</span>Scegli un bersaglio utile</div>
              <div><span>02</span>Proteggi la tua riserva</div>
              <div><span>03</span>Fissa un limite, rispettalo</div>
            </div>
          }
        </section>
      </aside>
    </div>
    <section class="panel">
      <h2>Condizioni avanzate e nuove spawn</h2>
      <p>
        Il formato JSON supporta step, scambi, correlazioni, garanzie per draw e
        pity. Importando un record puoi legarlo al catalogo; disponibilità,
        utilità e probabilità vengono controllate separatamente.
      </p>
      <div class="actions">
        <label class="button"
          >Importa record banner<input
            class="sr-only"
            type="file"
            accept=".json,application/json"
            (change)="importBanner($event)" /></label
        ><button (click)="exportScenario()">Esporta scenario JSON</button>
      </div>
      @if (imported(); as b) {
        <div class="message">
          Record {{ b.name }} · revisione {{ b.revision }} ·
          {{ availability(b) }}.
        </div>
        <label
          >Bersaglio del record<select #recordTarget (change)="cancel()">
            @for (id of b.targetItemIds; track id) {
              <option [value]="id">{{ itemName(id) }}</option>
            }
          </select></label
        ><button class="primary" (click)="analyzeImported(recordTarget.value)">
          Analizza record verificato
        </button>
      }
    </section>
    <section class="panel">
      <h2>Riferimenti storici</h2>
      <p>
        Un ordine di grandezza delle guide non è una media verificata per ogni
        nuovo banner.
      </p>
      @for (note of registry()?.historicalNotes || []; track note.name) {
        <div class="source-list">
          <h3>{{ note.name }}</h3>
          <p>{{ note.text }}</p>
        </div>
      }
</section>`,
})
export class SpawnsComponent {
  s = inject(Store);
  destroy = inject(DestroyRef);
  controller = new SpawnWorkerController();
  labels = verdictLabels;
  registry = signal<any>(null);
  bannerFilter = signal("all");
  registered = computed(() =>
    (this.registry()?.records || []).filter(
      (b: Banner) =>
        this.bannerFilter() === "all" ||
        bannerAvailability(b) === this.bannerFilter(),
    ),
  );
  setBannerFilter(e: Event) {
    this.bannerFilter.set((e.target as HTMLSelectElement).value);
  }
  selectRegistered(b: Banner) {
    const v = validateBanner(b);
    if (!v.ok) {
      this.error.set(v.errors.join("; "));
      return;
    }
    this.cancel();
    this.analyzed = false;
    this.imported.set(b);
  }
  result = signal<any>(null);
  busy = signal(false);
  error = signal("");
  imported = signal<Banner | null>(null);
  epoch = 0;
  analyzed = false;
  activeAnalysis:
    | { kind: "custom" }
    | { kind: "imported"; targetItemId: string }
    | null = null;
  profileKey = "";
  restored = false;
  form = new FormGroup({
    targetName: new FormControl("", { nonNullable: true }),
    availableGems: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    reserveGems: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    costGems: new FormControl(30, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    firstCost: new FormControl(15, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    drawCount: new FormControl(10, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100)],
    }),
    rate: new FormControl<number | null>(null, {
      validators: [Validators.min(0), Validators.max(100)],
    }),
    guaranteeAfter: new FormControl(0, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(0),
        Validators.max(2000),
      ],
    }),
    medalsPerSpawn: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    exchangeMedals: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    ownedMedals: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    useful: new FormControl(false, { nonNullable: true }),
    risk: new FormControl(false, { nonNullable: true }),
    riskCap: new FormControl(100, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    threshold: new FormControl(80, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(99)],
    }),
  });
  constructor() {
    void this.s
      .read("banners")
      .then((v) => this.registry.set(v))
      .catch(() => {});
    effect(() => {
      if (this.s.ready() && !this.restored) {
        this.restored = true;
        this.form.patchValue(
          {
            availableGems: this.s.profile().availableGems,
            reserveGems: this.s.profile().reserveGems,
          },
          { emitEvent: false },
        );
      }
    });
    effect(() => {
      const state = this.s.state();
      const key = JSON.stringify([
        state.profile.classId,
        state.profile.role,
        state.profile.mode,
        state.profile.elements,
        state.copies,
        state.builds,
      ]);
      if (key !== this.profileKey) {
        this.profileKey = key;
        untracked(() => {
          if (this.activeAnalysis) {
            this.invalidate();
            void this.rerun();
          }
        });
      }
    });
    this.form.valueChanges
      .pipe(
        tap(() => this.invalidate()),
        debounceTime(300),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe(() => {
        if (this.form.valid) void this.rerun();
      });
    this.destroy.onDestroy(() => this.controller.cancel());
  }
  historicalUrl() {
    return this.s.sources().find((s) => s.id === "published")?.url;
  }
  format(n: number | null) {
    return n === null
      ? "Non disponibile"
      : new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(n) +
          " gemme";
  }
  itemName(id: string) {
    return this.s.entries().find((e) => e.id === id)?.name || id;
  }
  availability(b: Banner) {
    return bannerAvailability(b);
  }
  makeBanner(): Banner {
    const v = this.form.getRawValue(),
      source = {
        id: "user-scenario",
        url: "",
        declaredUpdated: null,
        fetchedAt: new Date().toISOString(),
        kind: "editorial" as const,
        edition: "WW",
      };
    const fixed = (itemIds: string[] = [], medals = 0) => ({
      kind: "fixed" as const,
      outcomes: [{ probability: 1, value: { itemIds, medals } }],
    });
    const draws =
      v.rate === null
        ? { kind: "unknown" as const, outcomes: [] }
        : {
            kind: "categorical" as const,
            outcomes: [
              {
                probability: v.rate / 100,
                value: { itemIds: ["custom-target"], medals: 0 },
              },
              {
                probability: 1 - v.rate / 100,
                value: { itemIds: [], medals: 0 },
              },
            ],
          };
    const model = {
      kind: "independent" as const,
      joint: null,
      draws,
      medals: fixed([], v.medalsPerSpawn),
      independenceSource: source,
    };
    const first = {
      id: "prima-spawn",
      costGems: v.firstCost,
      drawCount: v.drawCount,
      outcomeModel: model,
      guarantees: [],
      pity: null,
    };
    const repeat = {
      ...first,
      id: "spawn-successiva",
      costGems: v.costGems,
      pity: v.guaranteeAfter
        ? {
            threshold: v.guaranteeAfter * v.drawCount,
            distribution: fixed(["custom-target"]),
            resetOnTarget: true,
          }
        : null,
    };
    const firstWithPity = { ...first, pity: repeat.pity };
    return {
      id: "custom-scenario",
      revision: 1,
      name: v.targetName || "Scenario personalizzato",
      edition: "WW",
      verifiedAt: new Date().toISOString(),
      startsAt: null,
      endsAt: null,
      availability: "unknown",
      sourceRefs: [source],
      targetItemIds: ["custom-target"],
      steps: [firstWithPity, repeat],
      repeatFrom: 1,
      maxCycles: null,
      exchange: v.exchangeMedals
        ? {
            targetItemId: "custom-target",
            medalsRequired: v.exchangeMedals,
            exchangeLimit: 1,
          }
        : null,
      boxModel: null,
    };
  }
  async analyze() {
    if (this.form.invalid) return;
    this.activeAnalysis = { kind: "custom" };
    this.analyzed = true;
    const v = this.form.getRawValue();
    const profile = {
      ...this.s.profile(),
      availableGems: v.availableGems,
      reserveGems: v.reserveGems,
    };
    void this.s.setProfile({
      availableGems: v.availableGems,
      reserveGems: v.reserveGems,
    });
    await this.run({
      banner: this.makeBanner(),
      profile,
      progress: {
        ownedMedals: v.ownedMedals,
        stepIndex: 0,
        cycleIndex: 0,
        pityCount: 0,
      },
      targetItemId: "custom-target",
      targetAssessment: {
        evaluation: { status: "complete", score: v.useful ? 1 : 0 },
        benefit: v.useful ? "profile-fit" : "irrelevant",
        delta: null,
        requirements: ["Utilità dichiarata dall’utente"],
      },
      risk: {
        enabled: v.risk,
        successThreshold: v.threshold / 100,
        budgetCap: v.riskCap,
      },
      custom: true,
      itemNames: { "custom-target": v.targetName || "il bersaglio scelto" },
    });
  }
  async run(payload: any, epoch = ++this.epoch) {
    if (epoch !== this.epoch) return;
    this.error.set("");
    this.result.set(null);
    this.busy.set(true);
    try {
      const r = await this.controller.run(payload);
      if (epoch === this.epoch) {
        this.result.set(r);
        this.busy.set(false);
      }
    } catch (e) {
      if (epoch === this.epoch) {
        this.error.set((e as Error).message);
        this.busy.set(false);
      }
    }
  }
  async rerun() {
    const active = this.activeAnalysis;
    if (!active || this.form.invalid) return;
    if (active.kind === "custom") await this.analyze();
    else await this.analyzeImported(active.targetItemId);
  }
  invalidate() {
    this.epoch++;
    this.controller.cancel();
    this.result.set(null);
    this.busy.set(false);
  }
  cancel() {
    this.activeAnalysis = null;
    this.analyzed = false;
    this.result.set(null);
    this.epoch++;
    this.controller.cancel();
    this.busy.set(false);
    this.error.set("");
  }
  exportScenario() {
    try {
      const blob = new Blob([JSON.stringify(this.makeBanner(), null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "unisonpedia-scenario.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async importBanner(e: Event) {
    const input = e.target as HTMLInputElement,
      file = input.files?.[0];
    try {
      if (!file || file.size > 1024 * 1024)
        throw new Error("Record mancante o troppo grande");
      const result = validateBanner(JSON.parse(await file.text()));
      if (!result.ok) throw new Error(result.errors.join("; "));
      this.cancel();
      this.imported.set(result.data!);
    } catch (err) {
      this.error.set((err as Error).message);
    }
    input.value = "";
  }
  async analyzeImported(targetItemId: string) {
    const b = this.imported();
    if (!b || this.form.invalid || !b.targetItemIds.includes(targetItemId))
      return;
    this.activeAnalysis = { kind: "imported", targetItemId };
    this.invalidate();
    const epoch = this.epoch;
    this.error.set("");
    this.busy.set(true);
    const v = this.form.getRawValue();
    const state = {
      ...this.s.state(),
      profile: {
        ...this.s.profile(),
        availableGems: v.availableGems,
        reserveGems: v.reserveGems,
      },
    };
    try {
      const build = state.builds.find(
        (b) =>
          normalizeMode(b.mode) === normalizeMode(state.profile.mode) &&
          b.slots.length,
      );
      const ids = new Set([
        targetItemId,
        ...(build?.slots
          .map(
            (slot) =>
              state.copies.find((c) => c.copyId === slot.copyId)?.itemId,
          )
          .filter((id): id is string => !!id) || []),
      ]);
      const loaded = await Promise.allSettled(
        [...ids].map(async (id) => [id, await this.s.getDetail(id)] as const),
      );
      if (epoch !== this.epoch) return;
      const catalogue = new Map(
        loaded
          .filter((r) => r.status === "fulfilled")
          .map(
            (r) =>
              (
                r as PromiseFulfilledResult<
                  readonly [string, Awaited<ReturnType<Store["getDetail"]>>]
                >
              ).value,
          ),
      );
      const item = catalogue.get(targetItemId);
      if (!item) throw new Error("Scheda del bersaglio non disponibile");
      await this.run(
        {
          banner: b,
          profile: state.profile,
          progress: {
            ownedMedals: v.ownedMedals,
            stepIndex: 0,
            cycleIndex: 0,
            pityCount: 0,
          },
          targetItemId,
          targetAssessment: assessTargetNeed(item, state, catalogue),
          risk: {
            enabled: v.risk,
            successThreshold: v.threshold / 100,
            budgetCap: v.riskCap,
          },
          custom: false,
          benchmarkRecords: this.registry()?.benchmarks || [],
          benchmarkTarget: {
            targetItemId,
            kind: item.kind,
            role: state.profile.role,
            element: item.element,
            potentialLevel: 0,
            metric: "guaranteed",
            edition: "WW",
            effectFamilies: item.effects.map((e) => e.family),
          },
          itemNames: { [targetItemId]: item.name },
        },
        epoch,
      );
    } catch (e) {
      if (epoch === this.epoch) {
        this.error.set((e as Error).message);
        this.busy.set(false);
      }
    }
  }
}
