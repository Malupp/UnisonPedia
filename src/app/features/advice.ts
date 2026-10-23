import { Component, inject, signal, effect, computed } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { GoalsComponent } from "./goals";
import { normalizeMode } from "../domain/contracts";
import { EvaluationComponent } from "./detail";
import { evaluateItem, evaluateBuildReplacement } from "../domain/evaluation";
import { Item, Evaluation, Copy } from "../domain/contracts";
@Component({
  standalone: true,
  imports: [RouterLink, EvaluationComponent, GoalsComponent],
  template: `<div class="page-heading">
      <span class="eyebrow">IL VALORE DIPENDE DAL TUO SET</span>
      <h1>Consigli, con un perché.</h1>
      <p>
        {{ s.profile().classId || "Seleziona una classe" }} ·
        {{ s.profile().mode.toUpperCase() }} ·
        {{ roleLabels[s.profile().role] }}
      </p>
    </div>
    <label class="build-choice">Configurazione da analizzare<select [value]="buildId()" (change)="chooseBuild($event)"><option value="">Solo profilo e inventario</option>@for(b of modeBuilds();track b.id){<option [value]="b.id">{{b.name}}</option>}</select></label>
    <app-goals [buildId]="selectedBuild()?.id??null" />
    @if (!s.profile().classId) {
      <div class="message warning">
        Scegli la classe nel contesto qui sopra per una valutazione specifica.
      </div>
    }
    @if (!s.state().copies.length) {
      <div class="empty-state">
        <span>✧</span>
        <h2>Partiamo da quello che hai</h2>
        <p>
          Aggiungi le tue copie per ricevere consigli sui potenziali e sulle
          sostituzioni. Nel catalogo trovi già la valutazione generale per il
          profilo.
        </p>
        <a class="button primary" routerLink="/catalogue"
          >Trova i tuoi oggetti →</a
        >
      </div>
    } @else {
      <div class="message">
        Queste valutazioni usano lo stato delle copie e la configurazione
        selezionata. Senza una build selezionata il riferimento è il solo profilo. Senza una sostituzione dichiarata non viene
        inventato un miglioramento numerico.
      </div>
      @if (loading()) {
        <p role="status">Analisi delle tue copie…</p>
      }
      <div class="advice-list">
        @for (row of rows(); track row.copy.copyId) {
          <article class="panel advice-card">
            <div>
              <span class="eyebrow"
                >{{ row.item?.gearType || "NON DISPONIBILE" }} · POTENZIALE
                {{ row.copy.potential }}</span
              ><a [routerLink]="['/item', row.copy.itemId]"
                ><h2>{{ row.item?.name || row.copy.itemId }}</h2></a
              >
              <p>{{ row.error || reason(row) }}</p>
              @if (
                row.item && row.copy.potential < (row.item.potentialMax || 0)
              ) {
                <p class="upgrade-hint">
                  Prossimi livelli: controlla effetti sbloccati e Restrictions
                  nella scheda prima di investire materiali.
                </p>
              }
              <a class="text-link" [routerLink]="['/item', row.copy.itemId]"
                >Effetti e requisiti →</a
              >
            </div>
            @if (row.evaluation) {
              <app-evaluation [value]="row.evaluation" />
            }
          </article>
        }
      </div>
      <section class="panel">
        <h2>Confronta una sostituzione</h2>
        <p>
          Seleziona una copia assegnata e una candidata. Confronto editoriale
          della configurazione: non una previsione DPS.
        </p>
        <div class="assign-row">
          <label
            >Copia da sostituire<select #oldCopy>
              <option value="">Scegli</option>
              @for (c of assigned(); track c.copyId) {
                <option [value]="c.copyId">
                  {{ name(c.itemId) }} · {{ c.copyId.slice(0, 6) }}
                </option>
              }
            </select></label
          ><label
            >Copia candidata<select #newCopy>
              <option value="">Scegli</option>
              @for (c of s.state().copies; track c.copyId) {
                <option [value]="c.copyId">
                  {{ name(c.itemId) }} · {{ c.copyId.slice(0, 6) }}
                </option>
              }
            </select></label
          ><button (click)="replace(oldCopy.value, newCopy.value)">
            Valuta sostituzione
          </button>
        </div>
        @if (replacement(); as r) {
          <div class="message">
            {{
              r.delta === null
                ? "Dati insufficienti per verificare il miglioramento"
                : "Variazione di utilità: " +
                  (r.delta > 0 ? "+" : "") +
                  r.delta.toFixed(1) +
                  " punti"
            }}. Le famiglie duplicate non vengono sommate.
          </div>
        }
      </section>
    }`,
})
export class AdviceComponent {
  s = inject(Store);
  buildId=signal("");
  modeBuilds=computed(()=>this.s.state().builds.filter(b=>normalizeMode(b.mode)===normalizeMode(this.s.profile().mode)));
  selectedBuild=computed(()=>this.modeBuilds().find(b=>b.id===this.buildId()));
  chooseBuild(e:Event){this.buildId.set((e.target as HTMLSelectElement).value);}
  rows = signal<
    {
      copy: Copy;
      item: Item | null;
      evaluation: Evaluation | null;
      error: string;
    }[]
  >([]);
  loading = signal(false);
  replacement = signal<any>(null);
  epoch = 0;
  roleLabels = {
    damage: "Danno",
    defence: "Difesa",
    support: "Cura / Supporto",
  };
  assigned = computed(() => {
    const b = this.selectedBuild();
    return this.s
      .state()
      .copies.filter((c) => b?.slots.some((s) => s.copyId === c.copyId));
  });
  constructor() {
    effect(() => {
      const state = this.s.state();
      if (this.s.entries().length) void this.analyze(state);
    });
  }
  async analyze(state: ReturnType<typeof this.s.state>) {
    const epoch = ++this.epoch;
    this.loading.set(true);
    this.replacement.set(null);
    const build = this.selectedBuild(),
      counts: Record<string, number> = {};
    for (const a of build?.slots || []) {
      const c = state.copies.find((c) => c.copyId === a.copyId),
        e = this.s.entries().find((e) => e.id === c?.itemId);
      if (e?.element) {
        const key = e.kind === "weapon" ? e.element : e.element + ":" + e.kind;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    const rows = await Promise.all(
      state.copies.map(async (copy) => {
        try {
          const item = await this.s.getDetail(copy.itemId);
          const slot = build?.slots.find((s) => s.copyId === copy.copyId)?.slot;
          return {
            copy,
            item,
            evaluation: evaluateItem(item, {
              profile: state.profile,
              scenario: "personal",
              ownedCopy: copy,
              slot,
              elementCount: counts,
            }),
            error: "",
          };
        } catch (e) {
          return {
            copy,
            item: null,
            evaluation: null,
            error: (e as Error).message,
          };
        }
      }),
    );
    if (epoch === this.epoch) {
      this.rows.set(
        rows.sort(
          (a, b) => (b.evaluation?.score ?? -1) - (a.evaluation?.score ?? -1),
        ),
      );
      this.loading.set(false);
    }
  }
  name(id: string) {
    return this.s.entries().find((e) => e.id === id)?.name || id;
  }
  reason(row: any) {
    return row.evaluation?.score === null
      ? "La copia richiede dati o condizioni aggiuntive; consulta i contributi riconosciuti."
      : row.evaluation?.score === 0
        ? "Nessun contributo utile attivabile nel contesto selezionato."
        : "Utilità nel contesto attuale: verifica il bisogno che risolve e lo stacking con la configurazione.";
  }
  async replace(oldId: string, newId: string) {
    const state = this.s.state(),
      build = this.selectedBuild();
    const old = state.copies.find((c) => c.copyId === oldId),
      candidate = state.copies.find((c) => c.copyId === newId);
    if (!build || !old || !candidate) {
      this.s.notice.set("Seleziona due copie e una configurazione");
      return;
    }
    if (build.slots.some((s) => s.copyId === newId) && oldId !== newId) {
      this.s.notice.set("La candidata è già nella configurazione");
      return;
    }
    try {
      const items = await Promise.all(
        build.slots.map((a) =>
          this.s.getDetail(
            state.copies.find((c) => c.copyId === a.copyId)!.itemId,
          ),
        ),
      );
      const replacement = await this.s.getDetail(candidate.itemId);
      const oldItem = await this.s.getDetail(old.itemId);
      if (
        replacement.kind !== oldItem.kind ||
        replacement.gearType !== oldItem.gearType
      ) {
        this.s.notice.set("Confronta sostituzioni dello stesso tipo");
        return;
      }
      this.replacement.set(
        evaluateBuildReplacement(
          state,
          build.id,
          oldId,
          newId,
          new Map([...items, replacement].map((i) => [i.id, i])),
        ),
      );
    } catch (e) {
      this.s.notice.set((e as Error).message);
    }
  }
}
