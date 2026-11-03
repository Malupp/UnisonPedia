import { Component, computed, inject, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import type { Entry } from "../domain/contracts";
import { describeEquipment, findSimilarEquipment } from "../domain/equipment-similarity";
import { isClassWeapon } from "../domain/class-weapons";
import { Store } from "../core/store";

@Component({
  selector: "app-equipment-alternatives",
  standalone: true,
  imports: [RouterLink],
  template: `<section class="equipment-alternatives">
    <h3>Equip simili</h3>
    <p class="muted">Alternative con effetti o talenti in comune.</p>
    @for (entry of alternatives(); track entry.id) {
      <article>
        <img [src]="entry.iconPath || 'assets/fallback.svg'" [alt]="entry.name" width="56" height="56" />
        <div>
          <a [routerLink]="['/item', entry.id]">{{ entry.name }}</a>
          <p>{{ description(entry) }}</p>
          <small>{{ entry.gearType }} · {{ entry.element || 'Elemento ignoto' }}</small>
        </div>
      </article>
    } @empty {
      <p>Non ci sono alternative simili verificate per questo equip.</p>
    }
  </section>`,
  styles: [`
    :host { display: block; }
    .equipment-alternatives { border: 1px solid var(--border); border-radius: 14px; padding: 20px; background: var(--surface); }
    h3 { margin: 0 0 6px; font-size: 18px; }
    article { display: flex; align-items: flex-start; gap: 12px; border-top: 1px solid var(--border); padding: 14px 0; }
    article:first-of-type { margin-top: 12px; }
    img { flex: 0 0 56px; object-fit: contain; }
    article > div { min-width: 0; }
    a { font-weight: 600; }
    p { margin: 5px 0; font-size: 13px; }
    small { color: var(--muted); }
  `],
})
export class EquipmentAlternativesComponent {
  item = input.required<Entry>();
  store = inject(Store);
  alternatives = computed(() => findSimilarEquipment(
    this.store.entries().filter(entry => isClassWeapon(entry, this.store.weaponClass())),
    this.item(),
  ));
  description = describeEquipment;
}
