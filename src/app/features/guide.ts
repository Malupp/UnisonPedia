import { Component, inject, computed, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";
import { Store } from "../core/store";
import { NgTemplateOutlet } from "@angular/common";
import { guideSectionId, searchGuide } from "../domain/guide-search";
@Component({
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  template: `<div class="page-heading">
      <span class="eyebrow">CAPIRE, PRIMA DI INVESTIRE</span>
      <h1>La guida italiana.</h1>
      <p>
        Una guida unica, frutto degli studi dell’autore: le basi, gli effetti e
        le scelte che fanno crescere il tuo set.
      </p>
      <label class="description-language">
        Lingua delle spiegazioni
        <select
          [value]="language()"
          (change)="setLanguage($any($event.target).value)"
        >
          <option value="it">Italiano</option>
          <option value="en">English</option>
        </select>
      </label>
    </div>
    <div class="guide-tools">
      <label
        >Cerca nella guida<input
          type="search"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
          placeholder="Aura, bubble, potenziali, Cost…" /></label
      ><a class="button" routerLink="/guide/aure-bubble"
        >Atlante Aura e Bubble ↗</a
      ><a class="text-link" routerLink="/inventory/import"
        >Carica il tuo equipaggiamento →</a
      >
    </div>
    @if (query().trim()) {
      <section
        class="guide-search-results panel"
        aria-label="Risultati nella guida"
      >
        <div class="section-heading">
          <h2>{{ matches().length }} argomenti trovati</h2>
          <button class="text-link" (click)="query.set('')">
            Cancella ricerca
          </button>
        </div>
        @for (
          result of matches().slice(0, 30);
          track result.chapterId + "-" + result.sectionId
        ) {
          <a
            [routerLink]="['/guide', result.chapterId]"
            [fragment]="result.sectionId"
            (click)="query.set('')"
            ><span class="eyebrow">{{ result.chapterTitle }}</span
            ><strong>{{ result.heading }}</strong>
            <p>{{ result.excerpt }}</p></a
          >
        } @empty {
          <p>
            Nessun argomento trovato. Prova un nome ufficiale o una parola più
            breve.
          </p>
        }
      </section>
    }
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
            <details class="guide-chapter-index">
              <summary>
                In questo capitolo · {{ c.sections.length }} argomenti
              </summary>
              <nav aria-label="Argomenti del capitolo">
                @for (section of c.sections; track $index) {
                  <a
                    [routerLink]="['/guide', c.id]"
                    [fragment]="sectionId(section, $index)"
                    >{{ section.heading }}</a
                  >
                }
              </nav>
            </details>
            @for (section of c.sections; track $index; let i = $index) {
              @if (c.id === "aure-bubble" && section.images.length) {
                <details
                  class="guide-topic-card"
                  [id]="sectionId(section, i)"
                  [open]="fragment() === sectionId(section, i)"
                >
                  <summary>
                    <img
                      [src]="section.images[0].path"
                      alt=""
                      width="58"
                      height="58"
                      loading="lazy"
                    /><span>{{ section.heading }}</span
                    ><span class="guide-topic-toggle" aria-hidden="true"></span>
                  </summary>
                  <div class="guide-topic-body">
                    <ng-container
                      [ngTemplateOutlet]="topicContent"
                      [ngTemplateOutletContext]="{ $implicit: section }"
                    />
                  </div>
                </details>
              } @else {
                <section class="guide-topic" [id]="sectionId(section, i)">
                  <h3>{{ section.heading }}</h3>
                  <ng-container
                    [ngTemplateOutlet]="topicContent"
                    [ngTemplateOutletContext]="{ $implicit: section }"
                  />
                </section>
              }
            }
            <ng-template #topicContent let-section>
              @if (language() === "en" && !section.paragraphsEn) {
                <p class="muted">
                  Traduzione inglese non ancora disponibile: descrizione in
                  italiano.
                </p>
              }
              @for (
                p of language() === "en" && section.paragraphsEn
                  ? section.paragraphsEn
                  : section.paragraphs;
                track $index
              ) {
                <p
                  [attr.lang]="
                    language() === 'en' && section.paragraphsEn ? 'en' : 'it'
                  "
                >
                  {{ p }}
                </p>
              }
              @for (table of section.tables || []; track table.caption) {
                <div class="guide-table-wrap">
                  <table class="guide-table">
                    <caption>
                      {{
                        language() === "en" && table.captionEn
                          ? table.captionEn
                          : table.caption
                      }}
                    </caption>
                    <thead>
                      <tr>
                        @for (
                          header of language() === "en" && table.headersEn
                            ? table.headersEn
                            : table.headers;
                          track $index
                        ) {
                          <th scope="col">{{ header }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (
                        row of language() === "en" && table.rowsEn
                          ? table.rowsEn
                          : table.rows;
                        track $index
                      ) {
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
              <div class="guide-images">
                @for (img of section.images; track img.path) {
                  <figure>
                    <img [src]="img.path" [alt]="img.alt" loading="lazy" />
                    <figcaption>{{ img.caption }}</figcaption>
                  </figure>
                }
              </div>
              @for (id of section.itemIds; track id) {
                <a class="text-link" [routerLink]="['/item', id]"
                  >Apri la scheda collegata →</a
                >
              }
            </ng-template>
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
              <div>
                <dt>{{ g.term }}</dt>
                <dd>{{ g.definition }}</dd>
              </div>
            }
          </dl>
        </details>
      </div>
    </div>`,
  styleUrl: "./guide.css",
})
export class GuideComponent {
  language = signal<"it" | "en">(this.readLanguage());
  query = signal("");
  sectionId = guideSectionId;
  s = inject(Store);
  route = inject(ActivatedRoute);
  params = toSignal(this.route.paramMap);
  fragment = toSignal(this.route.fragment);
  matches = computed(() => searchGuide(this.s.chapters(), this.query()));
  chapter = computed(() =>
    this.s.chapters().find((c) => c.id === this.params()?.get("id")),
  );

  private readLanguage(): "it" | "en" {
    try {
      return localStorage.getItem("unisonpedia-description-language") === "en"
        ? "en"
        : "it";
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
