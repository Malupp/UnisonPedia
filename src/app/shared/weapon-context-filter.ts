import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Store } from "../core/store";

@Component({
  selector: "app-weapon-context-filter",
  standalone: true,
  imports: [RouterLink],
  template: `@if (s.weaponTypes()) {
      <div class="weapon-context-filter">
        <p>
          <strong>{{ s.profile().classId }}</strong> · {{ s.weaponTypes() }}
        </p>
        <label
          ><input
            type="checkbox"
            [checked]="s.showAllWeapons()"
            (change)="s.showAllWeapons.set($any($event.target).checked)"
          />Mostra anche le armi delle altre classi</label
        >
      </div>
    }
    <p class="weapon-mode-note">
      {{ s.profile().mode === "pve" ? "PvE" : "PvP (GvG)" }} · priorità in base
      al talento. I proc versatili restano visibili.
      <a routerLink="/guide/armi" fragment="talenti-pve-pvp"
        >Come leggere le indicazioni →</a
      >
    </p>`,
  styles: [
    `
      :host {
        display: block;
        margin: 16px 0;
      }
      .weapon-context-filter {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 24px;
        padding: 14px 16px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
      }
      .weapon-context-filter p {
        margin: 0;
        flex: 1;
        min-width: 150px;
        font-size: 12px;
      }
      .weapon-context-filter label {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }
      .weapon-context-filter input {
        flex: none;
      }
      .weapon-mode-note {
        font-size: 12px;
        margin: 10px 0 0;
      }
      .weapon-mode-note a {
        color: var(--teal);
      }
    `,
  ],
})
export class WeaponContextFilterComponent {
  s = inject(Store);
}
