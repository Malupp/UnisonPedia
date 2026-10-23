import { Component, inject, computed, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";
import { Store } from "../core/store";
@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<div class="page-heading">
      <span class="eyebrow">CAPIRE, PRIMA DI INVESTIRE</span>
      <h1>La guida italiana.</h1>
      <p>Le basi, gli effetti e le scelte che fanno crescere il tuo set.</p>
      <label class="description-language">
        Lingua delle spiegazioni
        <select [value]="language()" (change)="setLanguage($any($event.target).value)">
          <option value="it">Italiano</option>
          <option value="en">English</option>
        </select>
      </label>
    </div>
    <div class="guide-layout">
      <nav class="chapter-nav" aria-label="Capitoli della guida">
        @for (c of s.chapters(); track c.id; let i = $index) {
          <a
            [routerLink]="['/guide', c.id]"
            [class.selected]="chapter()?.id === c.id"
            ><span>{{ (i + 1).toString().padStart(2, "0") }}</span
            >{{ c.title }}</a
          >
        }
</nav>
      <div>
        @if (chapter(); as c) {
          <article class="guide-article">
            <span class="eyebrow"
              >GUIDA ·
              {{ c.historical ? "BASE STORICA" : "CONTESTO E REGOLE" }}</span
            >
            <h2>{{ c.title }}</h2>
            <p class="article-lead">{{ c.summary }}</p>
            @for (section of c.sections; track $index) {
              <h3>{{ section.heading }}</h3>
              @if (language() === 'en' && !section.paragraphsEn) {
                <p class="muted">Traduzione inglese non ancora disponibile: descrizione in italiano.</p>
              }
              @for (p of language() === 'en' && section.paragraphsEn ? section.paragraphsEn : section.paragraphs; track $index) {
                <p [attr.lang]="language() === 'en' && section.paragraphsEn ? 'en' : 'it'">{{ p }}</p>
              }
              @for (table of section.tables || []; track table.caption) {
                <div class="guide-table-wrap">
                  <table class="guide-table">
                    <caption>{{ table.caption }}</caption>
                    <thead><tr>
                      @for (header of table.headers; track $index) {
                        <th scope="col">{{ header }}</th>
                      }
                    </tr></thead>
                    <tbody>
                      @for (row of table.rows; track $index) {
                        <tr>
                          @for (cell of row; track $index) {
                            <td>{{ cell }}</td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
              @for (img of section.images; track img.path) {
                <figure>
                  <img [src]="img.path" [alt]="img.alt" loading="lazy" />
                  <figcaption>{{ img.caption }}</figcaption>
                </figure>
              }
              @for (id of section.itemIds; track id) {
                <a class="text-link" [routerLink]="['/item', id]"
                  >Apri la scheda collegata →</a
                >
              }
}
          </article>
        } @else {
          <div class="guide-cards">
            @for (c of s.chapters(); track c.id; let i = $index) {
              <a class="guide-card" [routerLink]="['/guide', c.id]"
                ><span class="chapter-number">{{
                  (i + 1).toString().padStart(2, "0")
                }}</span>
                <h2>{{ c.title }}</h2>
                <p>{{ c.summary }}</p>
                <span class="text-link">Leggi il capitolo →</span></a
              >
            }
          </div>
        }
        <details class="guide-legend">
          <summary>Legenda rapida</summary>
          <dl>
            @for (g of s.glossary(); track g.term) {
              <div><dt>{{ g.term }}</dt><dd>{{ g.definition }}</dd></div>
            }
          </dl>
        </details>
      </div>
    </div>`,
})
export class GuideComponent {
  language = signal<"it" | "en">(this.readLanguage());
  s = inject(Store);
  route = inject(ActivatedRoute);
  params = toSignal(this.route.paramMap);
  chapter = computed(() =>
    this.s.chapters().find((c) => c.id === this.params()?.get("id")),
  );

  private readLanguage(): "it" | "en" {
    try {
      return localStorage.getItem("unisonpedia-description-language") === "en" ? "en" : "it";
    } catch {
      return "it";
    }
  }

  setLanguage(value: string): void {
    if (value !== "it" && value !== "en") return;
    this.language.set(value);
    try {
      localStorage.setItem("unisonpedia-description-language", value);
    } catch {
      // The current selection remains usable when browser storage is unavailable.
    }
  }
}
