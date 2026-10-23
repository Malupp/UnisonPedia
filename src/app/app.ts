import { Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { Store } from "./core/store";
import { ProfileComponent } from "./shared/profile";
@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ProfileComponent],
  template: `<a class="skip-link" href="#content">Vai al contenuto</a>
    <aside class="sidebar">
      <a class="brand" routerLink="/catalogue"
        ><img class="brand-mark brand-image" src="assets/brand/unisonpedia-icon.jpg" alt="" width="44" height="44" />
        <span
          >Unison<span class="brand-accent">Pedia</span
          ><small>IL TUO PROSSIMO UPGRADE</small></span
        ></a
      >
      <div class="nav-label">ESPLORA</div>
      <nav aria-label="Navigazione principale">
        @for (n of nav; track n.path) {
          <a [routerLink]="n.path" routerLinkActive="active"
            ><span class="nav-icon" aria-hidden="true">{{ n.icon }}</span
            >{{ n.label }}
            @if (n.path === "/inventory" && s.state().copies.length) {
              <span class="nav-count">{{ s.state().copies.length }}</span>
            }
          </a>
        }
      </nav>
      <div class="sidebar-note">
        <span class="eyebrow">UNA GUIDA, IL TUO SET</span>
        <p>Meno dubbi.<br />Più gemme al momento giusto.</p>
        <a routerLink="/guide/gemme"
          >Impara a scegliere <span aria-hidden="true">↗</span></a
        >
      </div>
      <div class="sidebar-bottom">
        <span class="status-dot"></span> Snapshot WW <span>v1.0</span>
      </div>
    </aside>
    <div class="app-main">
      <header class="topbar">
        <a routerLink="/catalogue" class="mobile-brand"
          ><img src="assets/brand/unisonpedia-icon.jpg" alt="" width="28" height="28" />Unison<span>Pedia</span></a
        >
        <span class="breadcrumb"
          >UNISON LEAGUE <span>/</span> COMPANION ITALIANO</span
        ><a routerLink="/guide" class="top-link"
          >Guida <span aria-hidden="true">↗</span></a
        >
        <a routerLink="/account" class="top-link">{{s.auth.session()?"Account":"Accedi / Iscriviti"}}</a>
      </header>
      <app-profile />
      <main id="content" tabindex="-1">
        @if (s.error()) {
          <div class="message error" role="alert">
            {{ s.error() }} <button (click)="s.initialize()">Riprova</button>
          </div>
        }
        @if (s.storageDenied()) {
          <div class="message warning">
            La persistenza non è disponibile. Mantieni una copia con
            <a routerLink="/inventory">Esporta backup</a>.
          </div>
        }
        @if(s.sync().owner && (s.sync().status==='pending'||s.sync().status==='conflict')){
          <div class="message warning" role="status">{{s.syncLabel()}}. <a routerLink="/account">Gestisci sincronizzazione</a></div>
        }
        <router-outlet />
      </main>
      <footer>
        <span>UnisonPedia · Progetto della community</span>
      </footer>
    </div>
    @if (s.notice()) {
      <div class="toast" role="status">
        {{ s.notice() }}
        <button (click)="s.notice.set('')" aria-label="Chiudi notifica">
          ×
        </button>
      </div>
    }`,
})
export class AppComponent {
  s = inject(Store);
  nav = [
    { path: "/catalogue", label: "Catalogo", icon: "◈" },
    { path: "/meta", label: "Meta", icon: "▷" },
    { path: "/guide", label: "Guida", icon: "▤" },
    { path: "/inventory", label: "Inventario", icon: "▣" },
    { path: "/advice", label: "Consigli", icon: "✧" },
    { path: "/spawns", label: "Spawn", icon: "◇" },
    { path: "/account", label: "Account", icon: "◎" },
  ];
}
