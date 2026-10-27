import { Component, computed, inject, input } from "@angular/core";
import { normalizeMode } from "../domain/contracts";
import { Store } from "../core/store";
import { talentLabel } from "../domain/weapon-context";

@Component({
  selector: "app-weapon-talent",
  standalone: true,
  template: `@if (talent(); as talent) {
      <details class="weapon-talent">
        <summary>
          <span class="talent-name">{{ talent.name }}</span
          ><span
            class="talent-mode"
            [class.preferred]="talent.affinity === mode(s.profile().mode)"
            >{{ label(talent) }}</span
          >
        </summary>
        <div>
          <ul>
            @for (reason of talent.reasons; track $index) {
              <li>{{ reason }}</li>
            }
          </ul>
          @if (talent.condition) {
            <p>
              <strong>Condizione della skill</strong> · {{ talent.condition }}
            </p>
          }
          @if (!talent.exclusive && talent.affinity !== "unknown") {
            <p>
              La preferenza non è un limite d’uso: contano le abilità
              equipaggiate, lo scaling e le difese del bersaglio.
            </p>
          }
        </div>
      </details>
    } @else {
      <small class="talent-loading">{{
        s.weaponContextError() ||
          (s.weaponContext()
            ? "Modalità da verificare"
            : "Indicazione talento in caricamento…")
      }}</small>
    }`,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        margin: 10px 0;
      }
      .weapon-talent {
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      .weapon-talent > summary {
        cursor: pointer;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        list-style: none;
      }
      .weapon-talent > summary::-webkit-details-marker {
        display: none;
      }
      .weapon-talent > summary::after {
        content: "+";
        color: var(--teal);
        margin-left: auto;
      }
      .weapon-talent[open] > summary::after {
        content: "−";
      }
      .talent-name {
        color: var(--muted);
        font-size: 11px;
      }
      .talent-mode {
        color: var(--teal);
        font-size: 10px;
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 2px 6px;
      }
      .talent-mode.preferred {
        border-color: var(--teal);
      }
      .weapon-talent > div {
        padding: 10px 0 0;
      }
      .weapon-talent ul {
        padding-left: 16px;
        margin: 0 0 8px;
      }
      .weapon-talent li,
      .weapon-talent p {
        font-size: 11px;
        line-height: 1.7;
        color: var(--muted);
        margin: 0 0 8px;
      }
      .talent-loading {
        font-size: 11px;
        color: var(--muted);
      }
    `,
  ],
})
export class WeaponTalentComponent {
  itemId = input.required<string>();
  s = inject(Store);
  label = talentLabel;
  mode = normalizeMode;
  talent = computed(() => this.s.weaponTalents()[this.itemId()]);
}
