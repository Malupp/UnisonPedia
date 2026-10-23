import { Component, inject } from "@angular/core";
import { ReactiveFormsModule, FormControl, FormGroup } from "@angular/forms";
import { Store } from "../core/store";
import { Mode, Role, normalizeMode } from "../domain/contracts";
@Component({
  selector: "app-profile",
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `<div class="context-bar">
    <span class="context-label">IL TUO CONTESTO</span
    ><label
      >Classe<select
        [value]="s.profile().classId || ''"
        (change)="classChange($event)"
      >
        <option value="">Scegli la classe</option>
        @for (c of s.classes(); track c.id) {
          <option [value]="c.id">{{ c.name }}</option>
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
      ><span class="status-dot"></span> Solo nel tuo browser</span
    >
  </div>`,
})
export class ProfileComponent {
  s = inject(Store);
  normalizeMode = normalizeMode;
  classChange(e: Event) {
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
