import {
  Component,
  inject,
  signal,
  computed,
  effect,
  input,
} from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";
import { Store } from "../core/store";
import { normalizeMode } from "../domain/contracts";
import { Item, Evaluation } from "../domain/contracts";
import { evaluateItem } from "../domain/evaluation";
import { WeaponTalentComponent } from "../shared/weapon-talent";
@Component({
  selector: "app-evaluation",
  standalone: true,
  template: `<div class="evaluation-panel">
    <div class="evaluation-heading">
      <div>
        <span class="eyebrow">UTILITÀ EDITORIALE · {{ value().scenario }}</span>
        <h3>
          {{
            value().score === null
              ? "Dati insufficienti"
              : value().score?.toFixed(1) + " / 100"
          }}
        </h3>
      </div>
      <span class="score-ring">{{
        value().score === null ? "?" : value().score?.toFixed(0)
      }}</span>
    </div>
    <p class="muted">
      Versione regole {{ value().version }}. Il voto misura utilità per il
      contesto selezionato.
    </p>
    <div class="axis-grid">
      @for (a of axes; track a.key) {
        <div>
          <span>{{ a.label }}</span>
          <div class="axis-track">
            <i [style.width.%]="(value().axes[a.key] / 4) * 100"></i>
          </div>
          <small
            >{{ value().axes[a.key] }} / 4 · somma
            {{ value().rawAxes[a.key] }}</small
          >
        </div>
      }
    </div>
    @if (value().conditions.length) {
      <h4>Condizioni e requisiti</h4>
      <ul>
        @for (c of value().conditions; track $index) {
          <li>{{ c }}</li>
        }
      </ul>
    }
    @if (value().missing.length) {
      <details>
        <summary>{{ value().missing.length }} dati da verificare</summary>
        <ul>
          @for (m of value().missing; track $index) {
            <li>{{ m }}</li>
          }
        </ul>
      </details>
    }
    <details>
      <summary>Come viene calcolato</summary>
      <p>
        Danno 40/15/15/30; difesa 15/40/20/25; supporto 10/25/40/25 sui quattro
        assi. Massimo positivo per famiglia, demeriti distinti una volta.
      </p>
      @for (c of value().contributions; track $index) {
        <div class="contribution">
          <strong>{{ c.family }}</strong>
          <p>{{ c.reason }}</p>
        </div>
      }
    </details>
  </div>`,
})
export class EvaluationComponent {
  value = input.required<Evaluation>();
  axes: {
    key: "damage" | "survival" | "support" | "synergy";
    label: string;
  }[] = [
    { key: "damage", label: "Danno" },
    { key: "survival", label: "Sopravvivenza" },
    { key: "support", label: "Supporto" },
    { key: "synergy", label: "Sinergia" },
  ];
}

@Component({
  standalone: true,
  imports: [RouterLink, EvaluationComponent, WeaponTalentComponent],
  template: `<a class="back-link" routerLink="/catalogue"
      >← Torna al catalogo</a
    >
    @if (error()) {
      <div class="empty-state" role="alert">
        <h1>Scheda non disponibile</h1>
        <p>{{ error() }}</p>
        <button (click)="load()">Riprova</button>
        @if (sourceUrl()) {
          <a [href]="sourceUrl()" target="_blank" rel="noopener"
            >Apri Limipedia ↗</a
          >
        }
      </div>
    } @else if (item(); as d) {
      <div class="detail-hero">
        <div class="detail-art" [attr.data-element]="d.element">
          <img
            [src]="d.iconPath || 'assets/fallback.svg'"
            [alt]="d.name"
            width="240"
            height="240"
          />
        </div>
        <div>
          <span class="eyebrow">UR · {{ d.gearType }} · {{ d.element }}</span>
          <h1>{{ d.name }}</h1>
          @if (d.kind === "weapon") {
            <app-weapon-talent [itemId]="d.id" />
          }
          <div class="detail-tags">
            <span>Costo {{ d.cost }}</span
            ><span>{{
              d.kind === "monster"
                ? "Potenziale " + (d.potentialMax ?? "non noto")
                : "Infusioni " + (d.infusionMax ?? "non note")
            }}</span
            ><span>EDIZIONE WW</span>
          </div>
          <div class="actions">
            <button
              class="primary"
              (click)="s.addCopy(d.id)"
              [disabled]="!s.ready()"
            >
              Aggiungi una copia</button
            ><button (click)="compare(d.id)">Confronta</button>
          </div>
        </div>
      </div>
      <div class="detail-layout">
        <div>
          <section class="panel">
            <span class="eyebrow">VALORI UFFICIALI</span>
            <h2>Statistiche, stato per stato</h2>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Stato</th>
                    <th>ATK</th>
                    <th>MATK</th>
                    <th>DEF</th>
                    <th>MDEF</th>
                    @if (d.kind === "monster") {
                      <th>Stats1</th>
                      <th>Stats2</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of d.stats; track row.state) {
                    <tr>
                      <th>{{ states[row.state] || row.state }}</th>
                      @for (key of statKeys; track key) {
                        <td>{{ row.values[key] ?? "—" }}</td>
                      }
                      @if (d.kind === "monster") {
                        <td>{{ row.slots.slot1 ?? "—" }}</td>
                        <td>{{ row.slots.slot2 ?? "—" }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (d.kind === "monster") {
              <p class="muted">
                Stats1 e Stats2: statistiche selezionabili, non automaticamente
                ATK e MATK.
              </p>
            }
          </section>
          <section class="panel">
            <span class="eyebrow">DESCRIZIONE UFFICIALE · ENGLISH</span>
            <h2>Skill ed effetti</h2>
            @for (sec of d.sections; track $index) {
              <details [open]="$index < 2">
                <summary>{{ sec.kind }}</summary>
                <p class="official-text">{{ sec.text }}</p>
              </details>
            }
          </section>
          <section class="panel">
            <h2>Interpretazione degli effetti</h2>
            @for (e of d.effects; track $index) {
              <div class="effect-row">
                <span class="effect-tag">{{ e.family }}</span>
                <p>
                  {{
                    italian[e.family] ||
                      "Effetto da verificare nel contesto della build."
                  }}
                </p>
                @if (e.potential) {
                  <small>Richiede Hidden Potential {{ e.potential }}</small>
                }
                @if (e.condition) {
                  <small>{{ e.condition }}</small>
                }
              </div>
            }
            @if (d.unknownEffects.length) {
              <p class="muted">
                {{ d.unknownEffects.length }} descrizioni richiedono ancora una
                regola verificata. Il testo ufficiale rimane consultabile.
              </p>
            }
          </section>
        </div>
        <aside>
          <app-evaluation [value]="evaluation()!" />
          @if (personal(); as p) {
            <app-evaluation [value]="p" />
          }
        </aside>
      </div>
    } @else {
      <div class="empty-state" role="status"><h1>Caricamento scheda…</h1></div>
    }`,
})
export class DetailComponent {
  s = inject(Store);
  route = inject(ActivatedRoute);
  params = toSignal(this.route.paramMap);
  item = signal<Item | null>(null);
  error = signal("");
  epoch = 0;
  statKeys = ["ATK", "MATK", "DEF", "MDEF"];
  states: Record<string, string> = {
    initial: "Iniziale",
    reforged: "Fully Reforged",
    infused: "Fully Infused",
    "potential-max": "Potenziale massimo",
  };
  italian: Record<string, string> = {
    "ability-power":
      "Aumenta la potenza delle abilità; distinto dall’amplificazione del danno.",
    "damage-amplification":
      "Amplifica il danno delle abilità: controlla il tipo di attacco e lo scaling.",
    concentration:
      "Aumenta l’affidabilità dell’attivazione nelle condizioni descritte.",
    protection:
      "Protezione con immunità e soglia di rimozione: controlla durata e bersaglio.",
    concerto: "Stato che combina benefici e immunità condizionati al team.",
    resource: "Sostiene l’uso delle abilità o il ritmo delle Unison.",
    stats: "Modifica statistiche: lo stacking dipende dalla categoria.",
    "buff-limit": "Alza il limite dei buff, distinto dal buff già applicato.",
    "status-resistance":
      "Aiuta contro gli status indicati; ordinari e speciali vanno distinti.",
    recovery:
      "Recupero o rimozione di effetti negativi, con bersaglio e condizioni.",
    "elemental-attack":
      "Sinergia elementale da verificare con il contenuto affrontato.",
    accuracy: "Aiuta le abilità a colpire nelle condizioni della skill.",
    guard: "Effetto di guardia da contestualizzare.",
    "reflection-reduction":
      "Riduce la minaccia della reflection nelle condizioni indicate.",
  };
  sourceUrl = computed(
    () =>
      this.item()?.sourceRefs[0]?.url ||
      this.s.entries().find((e) => e.id === this.params()?.get("id"))
        ?.sourceRefs[0]?.url ||
      "",
  );
  evaluation = computed(() => {
    const i = this.item();
    return i
      ? evaluateItem(i, { profile: this.s.profile(), scenario: "maximum" })
      : null;
  });
  personal = computed(() => {
    const i = this.item(),
      state = this.s.state(),
      copy = state.copies.find((c) => c.itemId === i?.id);
    if (!i || !copy) return null;
    const build = state.builds.find(
      (b) =>
        normalizeMode(b.mode) === normalizeMode(state.profile.mode) &&
        b.slots.some((s) => s.copyId === copy.copyId),
    );
    const assignment = build?.slots.find((s) => s.copyId === copy.copyId);
    const count: Record<string, number> = {};
    for (const a of build?.slots || []) {
      const c = state.copies.find((c) => c.copyId === a.copyId),
        e = this.s.entries().find((e) => e.id === c?.itemId);
      if (e?.element) {
        const key = e.kind === "weapon" ? e.element : e.element + ":" + e.kind;
        count[key] = (count[key] || 0) + 1;
      }
    }
    return evaluateItem(i, {
      profile: state.profile,
      scenario: "personal",
      ownedCopy: copy,
      slot: assignment?.slot,
      elementCount: count,
    });
  });
  constructor() {
    effect(() => {
      if (this.s.entries().length && this.params()?.get("id")) void this.load();
    });
  }
  async load() {
    const id = this.params()?.get("id");
    if (!id) return;
    const epoch = ++this.epoch;
    this.error.set("");
    this.item.set(null);
    try {
      const d = await this.s.getDetail(id);
      if (epoch === this.epoch) this.item.set(d);
    } catch (e) {
      if (epoch === this.epoch) this.error.set((e as Error).message);
    }
  }
  compare(id: string) {
    this.s.toggleCompare(id);
    this.s.notice.set(
      "Selezione confronto: " +
        this.s.compared().length +
        " / 3. Apri il confronto dal catalogo.",
    );
  }
}
@Component({
  standalone: true,
  imports: [RouterLink, EvaluationComponent],
  template: `<div class="page-heading">
      <span class="eyebrow">FINO A TRE OGGETTI</span>
      <h1>Confronto nel tuo contesto.</h1>
      <p>
        Stesso profilo, stesso scenario massimo. Ogni voto espone le sue
        condizioni.
      </p>
    </div>
    <a class="back-link" routerLink="/catalogue">← Scegli altri oggetti</a>
    @if (error()) {
      <div class="message error">{{ error() }}</div>
    }
    <div class="comparison-grid">
      @for (i of items(); track i.id) {
        <article class="panel">
          <img [src]="i.iconPath" [alt]="i.name" width="128" height="128" /><a
            [routerLink]="['/item', i.id]"
            ><h2>{{ i.name }}</h2></a
          >
          <p>{{ i.gearType }} · {{ i.element }} · COST {{ i.cost }}</p>
          <app-evaluation [value]="score(i)" />
        </article>
      }
    </div>
    @if (!items().length && !error()) {
      <div class="empty-state">
        Seleziona gli oggetti dal catalogo per creare un confronto
        condivisibile.
      </div>
    }`,
})
export class CompareComponent {
  s = inject(Store);
  route = inject(ActivatedRoute);
  params = toSignal(this.route.queryParamMap);
  items = signal<Item[]>([]);
  error = signal("");
  epoch = 0;
  constructor() {
    effect(() => {
      const ids = (this.params()?.get("ids") || "")
        .split(",")
        .filter(Boolean)
        .slice(0, 3);
      if (this.s.entries().length) void this.load(ids);
    });
  }
  async load(ids: string[]) {
    const e = ++this.epoch;
    try {
      const items = await Promise.all(ids.map((id) => this.s.getDetail(id)));
      if (e === this.epoch) this.items.set(items);
    } catch (err) {
      if (e === this.epoch) this.error.set((err as Error).message);
    }
  }
  score(i: Item) {
    return evaluateItem(i, { profile: this.s.profile(), scenario: "maximum" });
  }
}
