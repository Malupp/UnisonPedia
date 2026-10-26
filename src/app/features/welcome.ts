import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { AuthService } from "../core/auth";
import { AuthFormComponent } from "../shared/auth-form";
import { guestDestination } from "../domain/entry";
@Component({selector:"app-welcome",standalone:true,imports:[AuthFormComponent],template:
`<div class="entry-page">
 <header class="entry-header"><a href="/" class="entry-brand" aria-label="UnisonPedia, pagina iniziale"><img src="assets/brand/unisonpedia-icon.jpg" alt="" width="44" height="44" /><span>Unison<span class="brand-accent">Pedia</span><small>IL TUO PROSSIMO UPGRADE</small></span></a><span class="entry-community"><span class="status-dot"></span> Una wiki, fatta per i giocatori.</span></header>
 <main class="entry-layout" id="welcome-main">
  <section class="entry-story" aria-labelledby="welcome-title"><span class="eyebrow entry-kicker">UNISON LEAGUE · COMPANION ITALIANO</span><h1 id="welcome-title">Il META cambia.<br /><em>Il tuo personaggio<br class="entry-desktop-break" /> può crescere.</em></h1><p class="entry-intro">Capisci quali equipaggiamenti fanno la differenza, valorizza ciò che possiedi e scegli il tuo prossimo obiettivo. UnisonPedia ti aiuta a costruire un set migliore, una scelta alla volta.</p>
   <div class="entry-benefits"><article><span class="entry-feature-icon" aria-hidden="true">✧</span><div><h2>Trova gli equip giusti per te</h2><p>Armi, difensivi e mostri del META, con effetti e condizioni spiegati.</p></div></article><article><span class="entry-feature-icon" aria-hidden="true">▣</span><div><h2>Parti dal tuo inventario</h2><p>Registra le tue copie e costruisci build per classe, PvE e PvP.</p></div></article><article><span class="entry-feature-icon" aria-hidden="true">↗</span><div><h2>Dai una direzione alla crescita</h2><p>Segui obiettivi concreti e controlla cosa manca al tuo prossimo upgrade.</p></div></article></div>
   <p class="entry-editorial-note"><span aria-hidden="true">◇</span> Consigli motivati, fonti e requisiti visibili. Il valore di un oggetto dipende dal tuo set.</p>
  </section>
  <section class="entry-card" aria-label="Accesso a UnisonPedia"><app-auth-form />
   @if(!auth.recovery()){
    <div class="entry-divider"><span>oppure, inizia a esplorare</span></div><button class="entry-guest" [disabled]="auth.busy()" type="button" (click)="enterGuest()">Entra come ospite <span aria-hidden="true">↗</span></button><p class="entry-guest-note">La wiki è aperta a tutti. Come ospite, inventario e progressi restano in questo browser; con un account li ritrovi anche sugli altri dispositivi.</p>
   }
  </section>
 </main>
 <footer class="entry-footer"><span>UnisonPedia · Un progetto della community</span><span>Nomi e immagini del gioco appartengono ai rispettivi titolari.</span></footer>
</div>`})
export class WelcomeComponent {
 auth=inject(AuthService);router=inject(Router);
 enterGuest(){this.auth.enterGuest();const destination=guestDestination(this.router.url);if(destination!==this.router.url)void this.router.navigateByUrl(destination,{replaceUrl:true});}
}
