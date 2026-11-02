import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../core/store';
import { normalizeMode } from '../domain/contracts';
import { RankingCategory, RankingGuide, RankingFamily, rankedFamilies } from '../domain/meta-rankings';

@Component({
  selector: 'app-meta-rankings',
  standalone: true,
  imports: [RouterLink],
  template: `@if (guide(); as guide) {
    <section class="rankings" aria-labelledby="ranking-title">
      <div class="ranking-heading">
        <div><span class="eyebrow">SCEGLI IL PROC DA USARE</span><h2 id="ranking-title">Classifiche dei proc</h2></div>
        <span class="ranking-mode">{{ mode() === 'pve' ? 'PvE' : 'PvP (GvG)' }} · ordine consigliato</span>
      </div>
      <p class="ranking-intro">Parti dalle prime posizioni, poi confronta requisiti e note con il tuo set. La priorità cambia con la modalità selezionata in alto.</p>
      <p class="ranking-count">Priorità editoriali · revisione {{ date(guide.reviewedAt) }} · catalogo {{ date(guide.catalogueAsOf) }} · requisiti soddisfatti e livello skill comparabile.</p>
      <div class="ranking-categories" role="group" aria-label="Tipo di proc">
        @for (option of categories; track option.id) {
          <button type="button" [attr.aria-pressed]="category() === option.id" (click)="category.set(option.id)">{{ option.label }}</button>
        }
      </div>
      <div class="ranking-toolbar">
        <label>Cerca nelle classifiche
          <input type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Regent, Translucent, Frenzy, nome equip o ID…" />
        </label>
        <a routerLink="/guide/armi" fragment="talenti-pve-pvp">Guida ai talenti →</a>
      </div>
      @if (category() === 'defence') {
        <p class="ranking-callout"><strong>Regent, Translucent o Phantasm?</strong> Regent combina riduzione danni, riduzione AP e scudo per un colpo; Translucent offre due livelli di riduzione e scala sull’elemento; Phantasm offre riduzione e scudo. Confronta le note delle tre famiglie e il numero di pezzi richiesti.</p>
      }
      <p class="ranking-count" role="status">{{ rows().length }} famiglie · {{ categoryLabel() }} · {{ mode() === 'pve' ? 'PvE' : 'PvP (GvG)' }}@if (s.weaponTypes() && (category() === 'weapon' || category() === 'healing')) { · {{ s.showAllWeapons() ? 'Tutte le armi' : s.profile().classId }} }</p>
      @if (rows().length) {
        <table class="ranking-table">
          <caption class="sr-only">Priorità consigliate {{ categoryLabel() }} in {{ mode() === 'pve' ? 'PvE' : 'PvP (GvG)' }}, a requisiti soddisfatti</caption>
          <thead><tr><th scope="col">Priorità e proc</th><th scope="col">Effetti</th><th scope="col">Note guida · quando sceglierlo</th><th scope="col">Requisiti ed equip</th></tr></thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr [attr.data-family]="row.id">
                <th scope="row" class="ranking-family"><span class="ranking-position" [class.ranking-top]="row.position <= 3">{{ row.position }}</span><strong>{{ row.name }}</strong>
                  @if (row.authorRank) { <small>Ordine guida 2024/25: {{ row.authorRank }}</small> }
                </th>
                <td data-label="Effetti"><ul class="ranking-effects">@for (effect of row.effects; track $index) { <li>{{ effect }}</li> }</ul></td>
                <td data-label="Note guida"><p>{{ row.advice[mode()] }}</p>
                  @for (source of row.additionalSources ?? []; track source.url) { <a class="ranking-source" [href]="source.url" target="_blank" rel="noopener noreferrer">{{ source.label }} ↗</a> }
                </td>
                <td data-label="Requisiti ed equip">
                  @for (condition of requirements(row); track condition) { <p class="ranking-requirement">{{ condition }}</p> }
                  <details class="ranking-variants" (toggle)="expand(row.id, $any($event.target).open)">
                    <summary>Varianti ed equip ({{ row.variants.length }})</summary>
                    @if (expanded()[row.id]) {
                      @for (variant of row.variants; track variant.skillName) {
                        <details class="ranking-variant">
                          <summary>{{ variant.skillName }} · {{ variant.items.length }} equip</summary>
                          <ul>@for (condition of variant.requirements; track condition) { <li>{{ condition }}</li> }</ul>
                          <div class="ranking-items">@for (item of variant.items; track item.id) {
                            <a [routerLink]="['/item', item.id]" class="ranking-item"><img [src]="item.iconPath || 'assets/fallback.svg'" (error)="fallback($event)" alt="" width="36" height="36" loading="lazy" /><span>{{ item.name }}<small>{{ item.gearType }} · {{ item.element }} · Cost {{ item.cost }}</small></span></a>
                          }</div>
                          <details class="ranking-original"><summary>Descrizione originale e fonte</summary><p class="ranking-raw">{{ variant.rawEffect }}</p><a [href]="variant.source.url" target="_blank" rel="noopener noreferrer">Scheda ufficiale · {{ date(variant.source.declaredUpdated || guide.catalogueAsOf) }} ↗</a></details>
                        </details>
                      }
                    }
                  </details>
                </td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <div class="ranking-empty"><h3>Nessun proc con questi filtri</h3><p>Cambia ricerca o categoria. Per i proc offensivi e di cura puoi anche includere le armi delle altre classi dal filtro in alto.</p><button type="button" (click)="query.set('')">Cancella ricerca</button></div>
      }
      <details class="ranking-method"><summary>Criteri della classifica, fonti e date</summary>
        <p>{{ guide.methodology }}</p><p><strong>Revisione:</strong> {{ date(guide.reviewedAt) }} · <strong>Catalogo:</strong> {{ date(guide.catalogueAsOf) }}</p>
        <p>Base storica: {{ guide.authorGuide }}. Gli effetti sono documentati dalle schede ufficiali; la priorità e le note di scelta sono valutazioni editoriali.</p>
        <ul>@for (note of guide.notes; track $index) { <li>{{ note }}</li> }</ul>
      </details>
    </section>
  }`,
  styleUrl: './meta-rankings.css',
})
export class MetaRankingsComponent {
  s = inject(Store);
  guide = input<RankingGuide | undefined>();
  category = signal<RankingCategory>('defence');
  query = signal('');
  expanded = signal<Record<string, boolean>>({});
  categories: { id: RankingCategory; label: string }[] = [
    { id: 'defence', label: 'Difensivi' }, { id: 'weapon', label: 'Offensivi' },
    { id: 'healing', label: 'Cura' }, { id: 'opening', label: 'Opening' }, { id: 'constant', label: 'Constant' },
  ];
  mode = computed(() => normalizeMode(this.s.profile().mode));
  categoryLabel = computed(() => this.categories.find(option => option.id === this.category())!.label);
  rows = computed(() => rankedFamilies(this.guide(), this.s.entries(), {
    mode: this.mode(), classId: this.s.profile().classId, includeOtherWeapons: this.s.showAllWeapons(), category: this.category(), query: this.query(),
  }));
  requirements(row: RankingFamily): string[] {
    // Summarize only matching requirement templates; preserve Neutral, counts and caps.
    return [...new Set(row.variants.flatMap(variant => variant.requirements).map(condition => condition
      .replace(/Helm\/Hat\/Armor\/Clothing/g, 'difensivi')
      .replace(/\b(?:Fire|Water|Wind|Light|Dark|Time|Star)\b/g, 'dell’elemento richiesto')
      .replace(/\b(?:Sword|Axe|Lance|Scythe|Bow|Gun|Staff|Book|Relic|Hat|Helm|Armor|Clothing)(?:\/(?:Sword|Axe|Lance|Scythe|Bow|Gun|Staff|Book|Relic|Hat|Helm|Armor|Clothing))*\b/g, 'del tipo richiesto')
      .replace(/(\d+) pezzi dell’elemento richiesto (difensivi|armi)/g, '$1 $2 dell’elemento richiesto')
    ))];
  }
  date(value: string): string { return value.slice(0, 10).split('-').reverse().join('/'); }
  expand(id: string, open: boolean) { this.expanded.update(state => ({ ...state, [id]: open })); }
  fallback(event: Event) {
    const image = event.target as HTMLImageElement;
    if (!image.dataset['fallback']) { image.dataset['fallback'] = '1'; image.src = 'assets/fallback.svg'; }
  }
}
