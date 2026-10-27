import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { VideoMetaStore } from "../core/video-meta";

@Component({
  selector: "app-video-summary",
  standalone: true,
  imports: [RouterLink],
  template: `<section class="video-summary panel" aria-labelledby="video-summary-title">
    <div class="section-heading">
      <div>
        <span class="eyebrow">DALLE BATTAGLIE ALLA BUILD · 22 OTTOBRE 2026</span>
        <h2 id="video-summary-title">Meta</h2>
      </div>
      <a class="text-link" routerLink="/meta">Esplora Meta <span aria-hidden="true">↗</span></a>
    </div>
    <p>Proc e mostri per la tua build: la selezione dell’autore e le alternative con effetti simili.</p>
    @if (v.data()) {
      <div class="video-highlights">
        @for (highlight of v.highlights(); track highlight.title) {
          <div><h3>{{ highlight.title }}</h3><ul>@for (point of highlight.points; track $index) { <li>{{ point }}</li> }</ul></div>
        }
      </div>
      <p class="video-summary-foot">{{ v.counts().equipment }} equip associati · {{ v.counts().monsters }} mostri · {{ v.counts().pending }} talenti da verificare.
        Oggetti osservati e alternative sono distinti nella selezione.</p>
    } @else if (v.error()) {
      <p role="status">{{ v.error() }} <button class="text-link" (click)="v.load()">Riprova</button></p>
    } @else {
      <p role="status">Caricamento della selezione…</p>
    }
  </section>`,
  styles: [`
    .video-summary { border-color: #496055; background: linear-gradient(120deg, #20352f, var(--surface) 65%); margin-bottom: 34px; }
    .video-summary .eyebrow { font-size: 10px; letter-spacing: 1.2px; }
    .video-summary h2 { margin: 8px 0 0; }
    .video-highlights { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; margin: 24px 0; }
    .video-highlights h3 { color: var(--green); font-size: 14px; }
    .video-highlights ul { padding-left: 18px; margin: 0; }
    .video-highlights li { font-size: 12px; line-height: 1.8; margin-bottom: 7px; color: var(--muted); }
    .video-summary-foot { font-size: 12px; line-height: 1.8; }
    .video-summary-foot { border-top: 1px solid var(--border); padding-top: 16px; margin: 0; }
    @media (max-width: 900px) { .video-highlights { grid-template-columns: 1fr; gap: 16px; } }
    @media (max-width: 600px) { .video-summary .section-heading { flex-direction: column; align-items: flex-start; } }
  `],
})
export class VideoSummaryComponent { v = inject(VideoMetaStore); }
