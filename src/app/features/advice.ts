import { Component, inject, signal, effect, computed } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { GoalsComponent } from "./goals";
import { normalizeMode } from "../domain/contracts";
import { Copy, Item } from "../domain/contracts";
import { describeEquipment } from "../domain/equipment-similarity";
import { EquipmentAlternativesComponent } from "../shared/equipment-alternatives";
@Component({
  standalone: true,
  imports: [RouterLink, GoalsComponent, EquipmentAlternativesComponent],
  template: `<div class="page-heading">
      <span class="eyebrow">IL TUO EQUIP, I SUOI EFFETTI</span>
      <h1>Consigli, con un perché.</h1>
      <p>
        {{ s.profile().classId || "Seleziona una classe" }} ·
        {{ s.profile().mode.toUpperCase() }} · Effetti e alternative simili
      </p>
    </div>
    <label class="build-choice">Configurazione da analizzare<select [value]="buildId()" (change)="chooseBuild($event)"><option value="">Solo profilo e inventario</option>@for(b of modeBuilds();track b.id){<option [value]="b.id">{{b.name}}</option>}</select></label>
    <app-goals [buildId]="selectedBuild()?.id??null" />
    @if (!s.profile().classId) {
      <div class="message warning">
        Scegli la classe nel contesto per consultare gli equip compatibili.
      </div>
    }
    @if (!s.state().copies.length) {
      <div class="empty-state">
        <span>✧</span>
        <h2>Partiamo da quello che hai</h2>
        <p>
          Aggiungi le tue copie per consultare gli effetti e trovare equip con
          talenti simili.
        </p>
        <a class="button primary" routerLink="/catalogue"
          >Trova i tuoi oggetti →</a
        >
      </div>
    } @else {
      <div class="message">
        Consulta la descrizione in italiano di ogni equip e le alternative che
        condividono effetti o talenti.
      </div>
      @if (loading()) {
        <p role="status">Caricamento delle tue schede…</p>
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
              <p>{{ row.error || description(row.item) }}</p>
              @if (
                row.item && row.copy.potential < (row.item.potentialMax || 0)
              ) {
                <p class="upgrade-hint">
                  Prossimi livelli: controlla effetti sbloccati e requisiti nella scheda.
                </p>
              }
              <a class="text-link" [routerLink]="['/item', row.copy.itemId]"
                >Apri la scheda completa →</a
              >
            </div>
            @if (row.item) {
              <app-equipment-alternatives [item]="row.item" />
            }
          </article>
        }
      </div>
    }`,
})
export class AdviceComponent {
  s = inject(Store);
  buildId = signal("");
  modeBuilds = computed(() => this.s.state().builds.filter(b => normalizeMode(b.mode) === normalizeMode(this.s.profile().mode)));
  selectedBuild = computed(() => this.modeBuilds().find(b => b.id === this.buildId()));
  chooseBuild(e: Event) { this.buildId.set((e.target as HTMLSelectElement).value); }
  rows = signal<{ copy: Copy; item: Item | null; error: string }[]>([]);
  loading = signal(false);
  epoch = 0;

  constructor() {
    effect(() => {
      const state = this.s.state();
      if (this.s.entries().length) void this.analyze(state);
    });
  }

  async analyze(state: ReturnType<typeof this.s.state>) {
    const epoch = ++this.epoch;
    this.loading.set(true);
    const rows = await Promise.all(state.copies.map(async (copy) => {
      try {
        const detail = await this.s.getDetail(copy.itemId);
        const entry = this.s.entries().find(candidate => candidate.id === copy.itemId);
        return { copy, item: entry ? { ...entry, ...detail } : detail, error: "" };
      } catch (error) {
        return { copy, item: null, error: (error as Error).message };
      }
    }));
    if (epoch === this.epoch) {
      this.rows.set(rows);
      this.loading.set(false);
    }
  }

  description(item: Item | null) {
    return item ? describeEquipment(item) : "Scheda non disponibile.";
  }
}
