import { Component, inject } from "@angular/core";
import { ReactiveFormsModule, FormControl, FormGroup } from "@angular/forms";
import { Store } from "../core/store";
import { Mode, Role, normalizeMode } from "../domain/contracts";
import { RouterLink } from "@angular/router";
@Component({
  selector: "app-profile",
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `<div class="context-bar">
      <span class="context-label">IL TUO CONTESTO</span
      ><label
        >Classe<select
          [value]="s.profile().classId || ''"
          (change)="classChange($event)"
        >
          <option value="">Scegli la classe</option>
          @for (c of s.classes(); track c.id) {
            <option [value]="c.id" [selected]="s.profile().classId === c.id">
              {{ c.name }}
            </option>
          }
        </select></label
      ><label
        >Modalità<select
          [value]="normalizeMode(s.profile().mode)"
          (change)="modeChange($event)"
        >
          <option value="pve">PvE</option>
          <option value="pvp">PvP (GvG)</option>
        </select></label
      ><label
        >Ruolo<select [value]="s.profile().role" (change)="roleChange($event)">
          <option value="damage">Danno</option>
          <option value="defence">Difesa</option>
          <option value="support">Cura / Supporto</option>
        </select></label
      ><span class="local-note"
        ><span class="status-dot"></span> {{ s.syncLabel() }}</span
      >
    </div>
    @if (s.weaponTypes()) {
      <p class="context-weapons">
        <span
          >Armi della classe <strong>{{ s.profile().classId }}</strong> ·
          {{ s.weaponTypes() }}</span
        ><a routerLink="/guide/classi" fragment="armi-della-classe"
          >Dettagli →</a
        >
      </p>
    }`,
  styles: [
    `
      .context-weapons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 18px;
        margin: 0;
        padding: 9px 44px;
        font-size: 11px;
        background: var(--surface);
        border-bottom: 1px solid var(--border);
      }
      .context-weapons a {
        color: var(--teal);
      }
      @media (max-width: 600px) {
        .context-weapons {
          padding: 9px 19px;
        }
      }
    `,
  ],
})
export class ProfileComponent {
  s = inject(Store);
  normalizeMode = normalizeMode;
  classChange(e: Event) {
    this.s.showAllWeapons.set(false);
    this.s.setProfile({
      classId: (e.target as HTMLSelectElement).value || null,
    });
  }
  modeChange(e: Event) {
    this.s.setProfile({ mode: (e.target as HTMLSelectElement).value as Mode });
  }
  roleChange(e: Event) {
    this.s.setProfile({ role: (e.target as HTMLSelectElement).value as Role });
  }
}
