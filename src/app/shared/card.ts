import { Component, input, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Entry } from "../domain/contracts";
import { Store } from "../core/store";
@Component({
  selector: "app-item-card",
  standalone: true,
  imports: [RouterLink],
  template: `<article class="item-card">
    <div class="card-art" [attr.data-element]="item().element">
      <span class="cost-badge">COST {{ item().cost }}</span
      ><img
        [src]="item().iconPath || 'assets/fallback.svg'"
        (error)="fallback($event)"
        [alt]="item().name"
        width="128"
        height="128"
        loading="lazy"
      /><span class="rarity">UR</span>
    </div>
    <div class="card-info">
      <span class="eyebrow"
        >{{ kindLabels[item().kind] }} ·
        {{ item().element || "Elemento ignoto" }}</span
      ><a class="card-title" [routerLink]="['/item', item().id]">{{
        item().name
      }}</a>
      <div class="card-footer">
        <span>{{ item().gearType || "Tipo da verificare" }}</span
        ><button
          class="icon-button"
          (click)="s.toggleCompare(item().id)"
          [attr.aria-label]="'Confronta ' + item().name"
          [attr.aria-pressed]="s.compared().includes(item().id)"
        >
          {{ s.compared().includes(item().id) ? "✓" : "+" }}
        </button>
      </div>
    </div>
  </article>`,
})
export class ItemCardComponent {
  item = input.required<Entry>();
  s = inject(Store);
  kindLabels = { weapon: "Arma", defence: "Difensivo", monster: "Mostro" };
  fallback(e: Event) {
    const img = e.target as HTMLImageElement;
    if (!img.dataset["fallback"]) {
      img.dataset["fallback"] = "1";
      img.src = "assets/fallback.svg";
    }
  }
}
