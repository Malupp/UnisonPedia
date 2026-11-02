import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store } from '../core/store';
import { Entry, normalizeMode } from '../domain/contracts';
import { RankingCategory, RankingGuide, RankingFamily, RankedFamily, rankedFamilies, originalEffectText } from '../domain/meta-rankings';

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
      <div class="ranking-categories" role="group" aria-label="Tipo di proc">
        @for (option of categories; track option.id) {
          <button type="button" [attr.aria-pressed]="category() === option.id" (click)="category.set(option.id)">{{ option.label }}</button>
        }
      </div>
      <div class="ranking-toolbar">
        <label>Cerca nelle classifiche
          <input type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Regent, Translucent, Frenzy, nome equip o ID…" />
        </label>
        <a routerLink="/guide/armi" fragment="talenti-pve-pvp">Come funzionano i talenti →</a>
      </div>
      <p class="ranking-count" role="status">{{ rows().length }} famiglie · {{ categoryLabel() }} · {{ mode() === 'pve' ? 'PvE' : 'PvP (GvG)' }}@if (s.weaponTypes() && (category() === 'weapon' || category() === 'healing')) { · {{ s.showAllWeapons() ? 'Tutte le armi' : s.profile().classId }} }</p>
      @if (rows().length) {
        <table class="ranking-table">
          <caption class="sr-only">Priorità consigliate {{ categoryLabel() }} in {{ mode() === 'pve' ? 'PvE' : 'PvP (GvG)' }}, a requisiti soddisfatti</caption>
          <thead><tr><th scope="col">Priorità e proc</th><th scope="col">Effetti</th><th scope="col">Note guida · quando sceglierlo</th><th scope="col">Requisiti ed equip</th></tr></thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr [attr.data-family]="row.id">
                <th scope="row" class="ranking-family"><span class="ranking-position" [class.ranking-top]="row.position <= 3">{{ row.position }}</span><strong>{{ row.name }}</strong>
                  <div class="ranking-previews">
                    @for (item of previews(row); track item.id) {
                      <a class="ranking-preview" [routerLink]="['/item', item.id]" [attr.aria-label]="item.name" [title]="item.name">
                        <img [src]="item.iconPath || 'assets/fallback.svg'" (error)="fallback($event)" alt="" width="48" height="48" loading="lazy" />
                      </a>
                    }
                  </div>
                </th>
                <td data-label="Effetti">
                  <ul class="ranking-effects" lang="it">@for (effect of row.effects; track $index) { <li>{{ effect }}</li> }</ul>
                  @if (englishVariant(row); as variant) {
                    <div class="ranking-english" lang="en">
                      <span class="ranking-language">English</span>
                      @if (row.variants.length > 1) {
                        <select [attr.aria-label]="'Original English effects for ' + row.name" [title]="variant.skillName" [value]="variant.skillName" (change)="selectEnglish(row.id, $any($event.target).value)">
                          @for (option of row.variants; track option.skillName) { <option [value]="option.skillName">{{ option.skillName }}</option> }
                        </select>
                      } @else { <span class="ranking-english-variant">{{ variant.skillName }}</span> }
                      <p class="ranking-english-text">{{ originalEffectText(variant.rawEffect) }}</p>
                    </div>
                  }
                </td>
                <td data-label="Note guida"><p>{{ row.advice[mode()] }}</p>
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
    </section>
  }`,
  styleUrl: './meta-rankings.css',
})
export class MetaRankingsComponent {
  s = inject(Store);
  guide = input<RankingGuide | undefined>();
  category = signal<RankingCategory>('defence');
  query = signal('');
  englishSelections = signal<Record<string, string>>({});
  originalEffectText = originalEffectText;
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
  englishVariant(row: RankedFamily) {
    return row.variants.find(variant => variant.skillName === this.englishSelections()[row.id]) ?? row.variants[0];
  }
  selectEnglish(id: string, skillName: string) {
    this.englishSelections.update(selected => ({ ...selected, [id]: skillName }));
  }
  previews(row: RankedFamily): Entry[] {
    const items: Entry[] = [];
    const add = (item: Entry | undefined) => {
      if (item && items.length < 4 && !items.some(existing => existing.id === item.id)) items.push(item);
    };
    for (const variant of row.variants) add(variant.items[0]);
    for (const variant of row.variants) for (const item of variant.items) add(item);
    return items;
  }
  date(value: string): string { return value.slice(0, 10).split('-').reverse().join('/'); }
  expand(id: string, open: boolean) { this.expanded.update(state => ({ ...state, [id]: open })); }
  fallback(event: Event) {
    const image = event.target as HTMLImageElement;
    if (!image.dataset['fallback']) { image.dataset['fallback'] = '1'; image.src = 'assets/fallback.svg'; }
  }
}
