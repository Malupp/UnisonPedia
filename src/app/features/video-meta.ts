import { Component, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../core/store";
import { VideoCategory, VideoMetaStore, VideoObservation } from "../core/video-meta";
import { Entry } from "../domain/contracts";
import { filterVideoObservations, groupVideoObservations, videoFamilyIdentity } from "../domain/video-meta-grouping";

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<header class="page-heading">
    <span class="eyebrow">PROC, MOSTRI E SINERGIE · PvP (GvG)</span>
    <h1>Meta</h1>
    <p>La selezione dell’autore e le alternative con effetti simili. Apri una famiglia o un mostro per vedere varianti, consigli, oggetti e schede.</p>
  </header>
  @if (v.error()) {
    <div class="message error" role="alert">{{ v.error() }} <button (click)="v.load()">Riprova</button></div>
  } @else if (v.data()) {
    <div class="meta-highlights">
      @for (highlight of v.highlights(); track highlight.title) {
        <section class="panel"><h2>{{ highlight.title }}</h2>
          <ul>@for (point of highlight.points; track $index) { <li>{{ point }}</li> }</ul>
        </section>
      }
    </div>
    <div class="meta-controls">
      <label>Cerca nella selezione
        <input type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Talento, mostro, equip o ID…" />
      </label>
      <label>Categoria della selezione
        <select [value]="category()" (change)="category.set($any($event.target).value)">
          <option value="all">Tutte le categorie</option>
          <option value="weapon">Proc offensivi</option>
          <option value="defence">Proc difensivi</option>
          <option value="monster">Mostri</option>
          <option value="healing">Proc di cura</option>
          <option value="setup">Opening e Constant</option>
          <option value="pending">Da verificare</option>
        </select>
      </label>
    </div>
    <p class="meta-count" role="status">{{ groupCount() }} famiglie e mostri · {{ visible().length }} varianti e voci · {{ v.counts().equipment }} equip associati · {{ v.counts().monsters }} mostri · {{ v.counts().pending }} talenti da verificare</p>
    @if (!visible().length) {
      <div class="empty-state"><h2>Nessuna corrispondenza</h2><p>Prova un altro nome o cambia i filtri.</p><button (click)="reset()">Azzera filtri</button></div>
    } @else {
      <div class="meta-columns">
        @for (column of columns(); track column.id) {
          <section class="meta-column" [class.meta-equipment]="column.id !== 'monsters'" [class.meta-offensive]="column.id === 'offensive'" [class.meta-defensive]="column.id === 'defensive'" [class.meta-monsters]="column.id === 'monsters'" [attr.aria-labelledby]="'meta-column-' + column.id">
            <h2 [id]="'meta-column-' + column.id">{{ column.title }} <span>{{ column.groups.length }}</span></h2>
            <div class="meta-list">
              @for (group of column.groups; track group.id) {
                <details class="meta-entry" [id]="'meta-family-' + group.id">
                  <summary><span>{{ group.name }}</span><span class="meta-toggle" aria-hidden="true">+</span></summary>
                  <div class="meta-entry-body">
                    @for (row of group.variants; track row.id) {
                    <section class="meta-variant" [id]="'meta-' + row.id" [attr.aria-label]="row.name">
                    @if (row.category !== 'monster') { <h3 class="meta-variant-title">@if (row.variantElement) { <span>{{ row.variantElement }} · </span> }<span class="meta-variant-name">{{ row.name }}</span></h3> }
                    <div class="meta-entry-labels"><span class="eyebrow">{{ labels[row.category] }}</span>
                      <span class="effect-tag" [class.meta-pending]="row.status === 'pending'">{{ row.status === 'pending' ? 'Da verificare' : row.priority }}</span>
                    </div>
                    <p class="meta-origin">{{ row.origin === 'similar' ? 'Alternativa simile' : 'Selezione dell’autore' }}
                      @if (row.origin === 'similar') { · {{ similarNames(row) }} }
                    </p>
                    <p>{{ row.summary }}</p>
                    <p class="meta-condition"><strong>{{ row.status === 'pending' ? 'Dato mancante' : 'Da considerare' }}</strong> · {{ row.conditions }}</p>
                    @if (row.items.length) {
                      @if (row.category !== 'monster') { <p class="meta-variant-note">{{ row.items.length }} equip con questo talento.</p> }
                      <div class="meta-items">
                        @for (item of row.items; track item.id) {
                          <div class="meta-item">
                            <img [src]="item.iconPath || 'assets/fallback.svg'" (error)="fallback($event)" alt="" width="52" height="52" loading="lazy" />
                            <div><h3>{{ item.name }}</h3><p>{{ item.gearType }} · {{ item.element }} · Cost {{ item.cost }}</p>
                              <a class="text-link" [routerLink]="['/item', item.id]">Scheda nel catalogo <span class="sr-only">di {{ item.name }}</span> →</a>
                            </div>
                          </div>
                        }
                      </div>
                    }
                    </section>
                    }
                  </div>
                </details>
              } @empty { <p class="meta-column-empty">Nessuna voce con questi filtri.</p> }
            </div>
          </section>
        }
      </div>
    }
  } @else { <div class="empty-state" role="status">Caricamento della selezione…</div> }`,
  styles: [`
    :host { display: block; }
    .meta-highlights { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
    .meta-highlights .panel { padding: 20px; }
    .meta-highlights h2 { font-size: 16px; color: var(--green); }
    .meta-highlights ul { padding-left: 18px; margin-bottom: 0; }
    .meta-highlights li { color: var(--muted); font-size: 13px; margin: 0 0 9px; }
    .meta-controls { display: grid; grid-template-columns: minmax(0, 1.35fr) repeat(2, minmax(0, 1fr)); gap: 14px; }
    .meta-count { margin: 16px 0 26px; font-size: 12px; }
    .meta-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 26px; align-items: start; }
    .meta-column { min-width: 0; }
    .meta-column > h2 { font-size: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .meta-column > h2 > span { font-size: 12px; color: var(--muted); font-weight: 400; }
    .meta-list { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .meta-entry { padding: 0; border-bottom: 0; background: var(--surface); overflow-wrap: anywhere; }
    .meta-entry + .meta-entry { border-top: 1px solid var(--border); }
    .meta-entry > summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; min-height: 56px; cursor: pointer; list-style: none; font-size: 14px; font-weight: 550; }
    .meta-entry > summary::-webkit-details-marker { display: none; }
    .meta-entry > summary:hover { color: var(--green); background: var(--raised); }
    .meta-entry[open] > summary { color: var(--green); }
    .meta-toggle { flex-shrink: 0; color: var(--teal); font-size: 20px; font-weight: 400; }
    .meta-entry[open] > summary .meta-toggle { transform: rotate(45deg); }
    .meta-entry-body { padding: 0 18px 20px; }
    .meta-variant + .meta-variant { margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border); }
    .meta-variant-title { font-size: 15px; margin: 4px 0 14px; color: var(--text); }
    .meta-variant-title > span:not(.meta-variant-name) { color: var(--teal); }
    .meta-entry-labels { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 4px 0 12px; }
    .meta-entry .eyebrow { font-size: 10px; }
    .meta-entry-body p { font-size: 13px; margin: 0 0 14px; }
    .meta-entry-body .meta-origin { font-size: 11px; color: var(--gold); }
    .meta-condition { padding: 12px; border-left: 2px solid var(--teal); background: var(--bg); }
    .meta-condition strong { color: var(--text); font-weight: 550; }
    .meta-pending { color: var(--gold); background: #3a3226; }
    .meta-evidence { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 11px; color: var(--muted); margin: 16px 0; }
    .meta-entry-body .meta-variant-note { font-size: 11px; }
    .meta-items { display: grid; gap: 14px; }
    .meta-item { display: flex; gap: 12px; align-items: flex-start; border-top: 1px solid var(--border); padding-top: 14px; }
    .meta-item > img { object-fit: contain; flex-shrink: 0; }
    .meta-item > div { min-width: 0; }
    .meta-item h3 { font-size: 13px; margin: 0 0 4px; }
    .meta-item p { font-size: 11px; margin: 0 0 5px; }
    .meta-column-empty { font-size: 13px; padding: 18px; margin: 0; }
    @media (max-width: 1100px) { .meta-highlights { grid-template-columns: 1fr; gap: 0; } }
    @media (max-width: 1000px) { .meta-columns { grid-template-columns: 1fr; } }
    @media (max-width: 700px) { .meta-controls { grid-template-columns: 1fr; } .meta-entry > summary { padding: 15px; } .meta-entry-body { padding: 0 15px 18px; } }
  `],
})
export class VideoMetaComponent {
  v = inject(VideoMetaStore);
  s = inject(Store);
  query = signal("");
  category = signal("all");
  origin = signal("all");
  labels: Record<VideoCategory, string> = { weapon: "Proc offensivo", defence: "Proc difensivo", monster: "Mostro", healing: "Proc di cura", opening: "Opening", constant: "Constant" };
  rows = computed(() => {
    const entries = new Map(this.s.entries().map((e) => [e.id, e]));
    return (this.v.data()?.observations ?? []).map((o) => ({ ...o, variantElement: videoFamilyIdentity(o).element, items: o.itemIds.map((id) => entries.get(id)).filter((e): e is Entry => !!e) }));
  });
  visible = computed(() => filterVideoObservations(this.rows(), {
    query: this.query(), category: this.category(), origin: this.origin(),
  }));
  groups = computed(() => groupVideoObservations(this.visible()));
  groupCount = computed(() => this.groups().length);
  columns = computed(() => {
    const groups = this.groups();
    const offensive = groups.filter(g => g.variants.some(row =>
      row.category === "weapon" || row.category === "healing" || row.items.some(item => item.kind === "weapon")));
    const offensiveIds = new Set(offensive.map(g => g.id));
    return [
      { id: "offensive", title: "Offensivi", groups: offensive },
      { id: "defensive", title: "Difensivi", groups: groups.filter(g =>
        g.variants[0].category !== "monster" && !offensiveIds.has(g.id)) },
      { id: "monsters", title: "Mostri", groups: groups.filter(g => g.variants[0].category === "monster") },
    ];
  });
  similarNames(row: VideoObservation) { return (row.similarTo ?? []).map((id) => this.v.data()?.observations.find((o) => o.id === id)?.name).filter(Boolean).join(", "); }
  reset() { this.query.set(""); this.category.set("all"); this.origin.set("all"); }
  fallback(event: Event) { const img = event.target as HTMLImageElement; if (!img.dataset["fallback"]) { img.dataset["fallback"] = "1"; img.src = "assets/fallback.svg"; } }
}
